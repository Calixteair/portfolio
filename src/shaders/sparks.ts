import {
  Fn,
  If,
  exp,
  float,
  floor,
  hash,
  instanceIndex,
  int,
  uint,
  instancedArray,
  ivec2,
  mix,
  textureLoad,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';
import {
  DataTexture,
  FloatType,
  Matrix4,
  NearestFilter,
  RGBAFormat,
  type Node,
  type WebGPURenderer,
} from 'three/webgpu';
import { PLATE } from '../three/pendant/shape';

/** Physics of molten-metal sparks (scene units ≈ metres, the pendant is ~0.9 tall). */
export const SPARK_PHYSICS = {
  gravity: -2.4,
  /** Air drag rate (1/s). */
  drag: 0.6,
  lifetime: [0.9, 1.9] as const,
  /** Bounce on the ground: kept vertical speed, kept horizontal speed (slide). */
  restitution: 0.32,
  friction: 0.55,
  /** Share of sparks born on the outer edge (the rest from the hole, SPEC §5.4). */
  outerShare: 0.25,
  /** Births per second at full heat, per simulated spark. */
  birthRate: 0.8,
  maxDt: 1 / 30,
} as const;

export interface SparkEmitters {
  hole: Float32Array;
  outer: Float32Array;
}

/** Emitters (x, y, nx, ny) in a float texture: row 0 hole, row 1 outer edge. */
function emitterTexture({ hole, outer }: SparkEmitters): DataTexture {
  const width = Math.max(hole.length, outer.length) / 4;
  const data = new Float32Array(width * 2 * 4);
  data.set(hole, 0);
  data.set(outer, width * 4);
  const tex = new DataTexture(data, width, 2, RGBAFormat, FloatType);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Per-frame inputs of the simulation. */
export function createSparkUniforms() {
  return {
    dt: uniform(0),
    /** Changes every frame, so births draw fresh random numbers. */
    epoch: uniform(0),
    /** Probability for a dead spark to be reborn this frame. */
    birth: uniform(0),
    /** Pendant local → world. */
    model: uniform(new Matrix4()),
    groundY: uniform(0),
  };
}

export type SparkUniforms = ReturnType<typeof createSparkUniforms>;

/**
 * Uniform random number in [0, 1) for an integer seed and a salt. TSL's hash() converts its
 * argument to uint anyway (typed float only): the cast lives here.
 */
function random(seed: Node<'uint'>, salt = 0): Node<'float'> {
  return hash(seed.add(salt) as unknown as Node<'float'>);
}

/** Random emitter on an edge, in pendant space: position and initial velocity. */
function emitter(seed: Node<'uint'>, emitters: DataTexture, holeCount: number, outerCount: number) {
  const outer = random(seed, 3).lessThan(SPARK_PHYSICS.outerShare);
  const count = outer.select(float(outerCount), float(holeCount));
  const index = floor(random(seed, 5).mul(count)).toInt();
  const e = textureLoad(emitters, ivec2(index, outer.select(int(1), int(0))));
  const z = random(seed, 7)
    .sub(0.5)
    .mul(PLATE.depth + 2 * PLATE.bevel);
  const speed = random(seed, 11).mul(0.6).add(0.3);
  const lateral = random(seed, 13).sub(0.5).mul(1.4);
  const velocity = vec3(e.z.mul(0.6), e.w.mul(0.6).add(0.5), lateral).mul(speed);
  return { position: vec3(e.x, e.y, z), velocity };
}

/**
 * GPU sparks (SPEC §5.4): storage buffers updated by a TSL compute shader, the same one on
 * WebGPU and on the WebGL 2 fallback (transform feedback). Dead sparks wait, then are
 * reborn on a hot edge at a rate set by the heat.
 */
export function createSparkSimulation(count: number, emitters: SparkEmitters, u: SparkUniforms) {
  const body = instancedArray(count, 'vec4'); // xyz position (world), w age
  const motion = instancedArray(count, 'vec4'); // xyz velocity (world), w lifetime
  const emitterTex = emitterTexture(emitters);
  const holeCount = emitters.hole.length / 4;
  const outerCount = emitters.outer.length / 4;

  const init = Fn(() => {
    body.element(instanceIndex).assign(vec4(0, -100, 0, 1e3));
    motion.element(instanceIndex).assign(vec4(0, 0, 0, 1));
  })().compute(count);

  const update = Fn(() => {
    const b = body.element(instanceIndex);
    const m = motion.element(instanceIndex);
    b.w.addAssign(u.dt);
    If(b.w.greaterThan(m.w), () => {
      // Integer seed per spark and per frame: TSL's hash() truncates its input to uint, so
      // fractional seeds would collapse and many sparks would share one trajectory.
      const seed = instanceIndex.add(u.epoch.toUint().mul(uint(2654435761)));
      If(random(seed).lessThan(u.birth), () => {
        const e = emitter(seed, emitterTex, holeCount, outerCount);
        b.xyz.assign(u.model.mul(vec4(e.position, 1)).xyz);
        m.xyz.assign(u.model.mul(vec4(e.velocity, 0)).xyz);
        const [shortest, longest] = SPARK_PHYSICS.lifetime;
        m.w.assign(mix(float(shortest), float(longest), random(seed, 17)));
        b.w.assign(0);
      });
    }).Else(() => {
      integrate(b, m, u);
    });
  })().compute(count);

  return { body, motion, init, update, dispose: () => emitterTex.dispose() };
}

/** Gravity, air drag, ground bounce and slide. */
function integrate(b: Node<'vec4'>, m: Node<'vec4'>, u: SparkUniforms) {
  m.y.addAssign(u.dt.mul(SPARK_PHYSICS.gravity));
  m.xyz.mulAssign(exp(u.dt.mul(-SPARK_PHYSICS.drag)));
  b.xyz.addAssign(m.xyz.mul(u.dt));
  If(b.y.lessThan(u.groundY), () => {
    b.y.assign(u.groundY);
    m.y.assign(m.y.abs().mul(SPARK_PHYSICS.restitution));
    m.x.mulAssign(SPARK_PHYSICS.friction);
    m.z.mulAssign(SPARK_PHYSICS.friction);
  });
}

/** Per frame: birth probability from the heat, pendant pose, and one compute step. */
export function stepSparks(
  renderer: WebGPURenderer,
  sim: ReturnType<typeof createSparkSimulation>,
  u: SparkUniforms,
  frame: { dt: number; heat: number; model: Matrix4 },
): void {
  const dt = Math.min(frame.dt, SPARK_PHYSICS.maxDt);
  u.dt.value = dt;
  u.epoch.value = (u.epoch.value + 1) % 1e6;
  // Each dead spark is reborn with this probability: births/s ≈ heat² × birthRate × pool.
  u.birth.value = Math.min(1, frame.heat ** 2 * SPARK_PHYSICS.birthRate * dt);
  u.model.value.copy(frame.model);
  renderer.compute(sim.update);
}
