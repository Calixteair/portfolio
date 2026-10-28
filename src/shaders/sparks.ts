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
  length,
  mix,
  normalize,
  textureLoad,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';
import { type DataTexture, Matrix4, Vector3, type Node, type WebGPURenderer } from 'three/webgpu';
import { PLATE } from '../three/pendant/shape';
import type { SparkColliders } from '../three/scenes/forge/colliders';
import { contact } from './contact';
import { floatTexture } from './dataTexture';
import { plateNormal, plateSdf } from './plateSdf';
import { createSceneryCollision } from './scenery';
import type { EdgeMaskInfo } from './steel';

/** Physics of molten-metal sparks (scene units ≈ metres, the pendant is ~0.9 tall). */
export const SPARK_PHYSICS = {
  gravity: -2.4,
  /** Air drag rate (1/s). */
  drag: 0.6,
  lifetime: [0.9, 1.9] as const,
  /** Bounce on the ground and rocks: shares of the normal and tangential speeds kept. */
  restitution: 0.32,
  slide: 0.55,
  /** Share of sparks born on the outer edge (the rest from the hole, SPEC §5.4). */
  outerShare: 0.25,
  /** Bounce on the pendant: shares of the normal and tangential speeds kept. */
  pendant: { restitution: 0.4, slide: 0.75 },
  /** Sparks are born and pushed this far off the surface (avoids instant re-collision). */
  skin: 0.003,
  /** Beyond this distance from the pendant's centre, no collision test (broad phase). */
  reach: 0.62,
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
  return floatTexture(data, width, 2);
}

/**
 * Spark births per second at full heat (heat² curve below it). Absolute, so the look does
 * not depend on the pool size or the backend. Mutable: tuned in the dev panel.
 */
export const SPARK_RATE = { perSecond: 260 };

/** Per-frame inputs of the simulation. */
export function createSparkUniforms() {
  return {
    dt: uniform(0),
    /** Changes every frame, so births draw fresh random numbers. */
    epoch: uniform(0),
    /** Probability for a dead spark to be reborn this frame. */
    birth: uniform(0),
    /** Pendant local → world, and back (collisions are tested in pendant space). */
    model: uniform(new Matrix4()),
    modelInverse: uniform(new Matrix4()),
    /** Pendant centre (world) and spin around the vertical axis (rad/s). */
    center: uniform(new Vector3()),
    spin: uniform(0),
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
  // Out of the faces, forwards or backwards: sparks leave the hole instead of rattling in it.
  const side = random(seed, 13).lessThan(0.5).select(float(-1), float(1));
  const lateral = side.mul(random(seed, 19).mul(0.9).add(0.5));
  const velocity = vec3(e.z.mul(0.6), e.w.mul(0.6).add(0.5), lateral).mul(speed);
  const position = vec3(e.xy.add(e.zw.mul(SPARK_PHYSICS.skin)), z);
  return { position, velocity };
}

/**
 * GPU sparks (SPEC §5.4): storage buffers updated by a TSL compute shader, the same one on
 * WebGPU and on the WebGL 2 fallback (transform feedback). Dead sparks wait, then are
 * reborn on a hot edge at a rate set by the heat.
 */
export function createSparkSimulation(
  count: number,
  emitters: SparkEmitters,
  mask: EdgeMaskInfo,
  colliders: SparkColliders,
  u: SparkUniforms,
) {
  const body = instancedArray(count, 'vec4'); // xyz position (world), w age
  const motion = instancedArray(count, 'vec4'); // xyz velocity (world), w lifetime
  const emitterTex = emitterTexture(emitters);
  const holeCount = emitters.hole.length / 4;
  const outerCount = emitters.outer.length / 4;
  const scenery = createSceneryCollision(colliders, SPARK_PHYSICS);

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
        // The spinning pendant throws its sparks: add the surface velocity at birth.
        m.xyz.assign(u.model.mul(vec4(e.velocity, 0)).xyz.add(surfaceVelocity(b.xyz, u)));
        const [shortest, longest] = SPARK_PHYSICS.lifetime;
        m.w.assign(mix(float(shortest), float(longest), random(seed, 17)));
        b.w.assign(0);
      });
    }).Else(() => {
      integrate(b, m, u);
      scenery.collide(b, m);
      collidePendant(b, m, u, mask);
    });
  })().compute(count);

  const dispose = () => {
    emitterTex.dispose();
    scenery.dispose();
  };
  return { body, motion, init, update, dispose };
}

/** Gravity and air drag. */
function integrate(b: Node<'vec4'>, m: Node<'vec4'>, u: SparkUniforms) {
  m.y.addAssign(u.dt.mul(SPARK_PHYSICS.gravity));
  m.xyz.mulAssign(exp(u.dt.mul(-SPARK_PHYSICS.drag)));
  b.xyz.addAssign(m.xyz.mul(u.dt));
}

/** Velocity of the pendant's surface at a world point: ω × r, ω = (0, spin, 0). */
function surfaceVelocity(point: Node<'vec3'>, u: SparkUniforms): Node<'vec3'> {
  const r = point.sub(u.center);
  return vec3(r.z.mul(u.spin), 0, r.x.mul(u.spin).negate());
}

/**
 * Bounce off the spinning pendant (SPEC §5.4): exact SDF tested in pendant space, the
 * spark pushed back to the surface, its velocity reflected relative to the moving surface
 * (restitution, slide), so the rotation is transmitted to it.
 */
function collidePendant(b: Node<'vec4'>, m: Node<'vec4'>, u: SparkUniforms, mask: EdgeMaskInfo) {
  If(length(b.xyz.sub(u.center)).lessThan(SPARK_PHYSICS.reach), () => {
    const local = u.modelInverse.mul(vec4(b.xyz, 1)).xyz;
    const normal = () => normalize(u.model.mul(vec4(plateNormal(local, mask), 0)).xyz);
    const surface = (p: Node<'vec4'>) => surfaceVelocity(p.xyz, u);
    const k = { ...SPARK_PHYSICS.pendant, skin: SPARK_PHYSICS.skin };
    contact(b, m, plateSdf(local, mask), normal, surface, k);
  });
}

/** Per frame: birth probability from the heat, pendant pose, and one compute step. */
export function stepSparks(
  renderer: WebGPURenderer,
  sim: ReturnType<typeof createSparkSimulation>,
  u: SparkUniforms,
  frame: { dt: number; heat: number; calm: number; model: Matrix4; spin: number; pool: number },
): void {
  const dt = Math.min(frame.dt, SPARK_PHYSICS.maxDt);
  u.dt.value = dt;
  u.epoch.value = (u.epoch.value + 1) % 1e6;
  // The pool is much larger than the live sparks: almost all are dead, so each one is
  // reborn with probability births-this-frame / pool.
  // `calm` (0-1) thins the sparks out while the portal opens, so the eye goes to it.
  const births = frame.heat ** 2 * SPARK_RATE.perSecond * dt * (1 - 0.85 * frame.calm);
  u.birth.value = Math.min(1, births / frame.pool);
  u.model.value.copy(frame.model);
  u.modelInverse.value.copy(frame.model).invert();
  u.center.value.setFromMatrixPosition(frame.model);
  u.spin.value = frame.spin;
  renderer.compute(sim.update);
}
