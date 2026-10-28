import { type DataTexture, SpriteNodeMaterial, type Node, type WebGPURenderer } from 'three/webgpu';
import {
  Fn,
  If,
  color,
  dot,
  exp,
  float,
  floor,
  hash,
  instanceIndex,
  instancedArray,
  int,
  ivec2,
  mix,
  mx_noise_vec3,
  pow,
  normalize,
  shapeCircle,
  sin,
  smoothstep,
  texture,
  textureLoad,
  time,
  uint,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { HOLE, PLATE } from '../three/pendant/shape';
import { floatTexture } from './dataTexture';
import { plateNormal, plateSdf } from './plateSdf';
import type { EdgeMaskInfo } from './steel';

/** Protomolecule swarm (SPEC §5.4), in pendant space: it crawls on the spinning pendant. */
export const SWARM = {
  lifetime: [2.5, 5] as const,
  /** Births per second at full swarm level, per simulated particle. */
  birthRate: 0.5,
  /** Height above the metal the particles cling to. */
  hover: 0.004,
  /** How strongly they are pulled back to that layer, and drift speed along it. */
  cling: 7,
  drift: 0.15,
  /** Beyond this distance from the hole edge, they creep back towards the crust. */
  crustReach: 0.12,
  size: 0.008,
  maxDt: 1 / 30,
} as const;

function random(seed: Node<'uint'>, salt = 0): Node<'float'> {
  return hash(seed.add(salt) as unknown as Node<'float'>);
}

/** Hole-edge emitters (x, y, nx, ny) in a float texture, one row. */
function crustEmitters(hole: Float32Array): DataTexture {
  return floatTexture(hole, hole.length / 4, 1);
}

export function createSwarmUniforms() {
  return {
    dt: uniform(0),
    epoch: uniform(0),
    birth: uniform(0),
    /** 0 = none, rising when the pendant overheats, 1 when the portal is open. */
    level: uniform(0),
  };
}

export type SwarmUniforms = ReturnType<typeof createSwarmUniforms>;

/** Born on the crust, just off the hole edge, anywhere through the plate's thickness. */
function birth(seed: Node<'uint'>, emitters: DataTexture, count: number) {
  const index = floor(random(seed, 3).mul(count)).toInt();
  const e = textureLoad(emitters, ivec2(index, int(0)));
  const z = random(seed, 5)
    .sub(0.5)
    .mul(PLATE.depth + 2 * PLATE.bevel);
  return vec3(e.xy.add(e.zw.mul(SWARM.hover)), z);
}

/** Cling to the surface, drift along it in a noise field, creep back towards the crust. */
function crawl(p: Node<'vec4'>, v: Node<'vec4'>, mask: EdgeMaskInfo, u: SwarmUniforms) {
  const local = p.xyz;
  const d = plateSdf(local, mask);
  const n = plateNormal(local, mask);
  const flow = mx_noise_vec3(local.mul(7).add(vec3(time.mul(0.25))));
  const along = flow.sub(n.mul(dot(flow, n))).mul(SWARM.drift);
  const uv = local.xy.sub(vec2(mask.min.x, mask.min.y)).div(vec2(mask.size.x, mask.size.y));
  const toHoleEdge = texture(mask.texture, uv).level(float(0)).r.mul(mask.range);
  const home = normalize(vec3(vec2(HOLE.cx, HOLE.cy).sub(local.xy), 0));
  const creep = home.mul(smoothstep(SWARM.crustReach, SWARM.crustReach * 2, toHoleEdge).mul(0.05));
  const target = along.add(creep).sub(n.mul(d.sub(SWARM.hover).mul(SWARM.cling)));
  v.xyz.assign(mix(target, v.xyz, exp(u.dt.mul(-4))));
  p.xyz.addAssign(v.xyz.mul(u.dt));
}

export function createSwarmSimulation(
  count: number,
  hole: Float32Array,
  mask: EdgeMaskInfo,
  u: SwarmUniforms,
) {
  const body = instancedArray(count, 'vec4'); // xyz position (pendant space), w age
  const motion = instancedArray(count, 'vec4'); // xyz velocity, w lifetime
  const emitters = crustEmitters(hole);
  const emitterCount = hole.length / 4;

  const init = Fn(() => {
    body.element(instanceIndex).assign(vec4(0, 0, 0, 1e3));
    motion.element(instanceIndex).assign(vec4(0, 0, 0, 1));
  })().compute(count);

  const update = Fn(() => {
    const p = body.element(instanceIndex);
    const v = motion.element(instanceIndex);
    p.w.addAssign(u.dt);
    If(p.w.greaterThan(v.w), () => {
      const seed = instanceIndex.add(u.epoch.toUint().mul(uint(2654435761)));
      If(random(seed).lessThan(u.birth), () => {
        p.xyz.assign(birth(seed, emitters, emitterCount));
        v.assign(
          vec4(0, 0, 0, mix(float(SWARM.lifetime[0]), float(SWARM.lifetime[1]), random(seed, 7))),
        );
        p.w.assign(0);
      });
    }).Else(() => crawl(p, v, mask, u));
  })().compute(count);

  return { body, motion, init, update, dispose: () => emitters.dispose() };
}

/**
 * Bioluminescent dots, #2f6bff → #b4e0ff, fading in and out, pulsing. Normal blending, not
 * additive: they cling to the white-hot crust, where added blue would just read as white.
 */
export function createSwarmMaterial(
  sim: ReturnType<typeof createSwarmSimulation>,
  u: SwarmUniforms,
) {
  const state = sim.body.toAttribute() as Node<'vec4'>;
  const life = (sim.motion.toAttribute() as Node<'vec4'>).w;
  const t = state.w.div(life);
  const alive = state.w.lessThan(life).select(float(1), float(0));
  const fade = smoothstep(0, 0.15, t).mul(float(1).sub(smoothstep(0.7, 1, t)));
  const pulse = sin(time.mul(3).add(float(instanceIndex).mul(1.7)))
    .mul(0.3)
    .add(0.7);
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  material.positionNode = state.xyz;
  material.scaleNode = float(SWARM.size).mul(alive).mul(fade.add(0.3));
  // HDR-bright blue (blooms a little); presence goes through the opacity, so a fading or
  // sparse swarm thins out instead of turning into dark dots.
  material.colorNode = mix(color(0x2f6bff), color(0xb4e0ff), pow(pulse, 4)).mul(pulse.mul(3));
  material.opacityNode = fade.mul(u.level.min(1)).mul(shapeCircle() as Node<'float'>);
  material.fog = false;
  return material;
}

export function stepSwarm(
  renderer: WebGPURenderer,
  sim: ReturnType<typeof createSwarmSimulation>,
  u: SwarmUniforms,
  frame: { dt: number; level: number },
): void {
  const dt = Math.min(frame.dt, SWARM.maxDt);
  u.dt.value = dt;
  u.epoch.value = (u.epoch.value + 1) % 1e6;
  u.level.value = frame.level;
  u.birth.value = Math.min(1, frame.level * SWARM.birthRate * dt);
  renderer.compute(sim.update);
}
