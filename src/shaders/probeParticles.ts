import {
  Fn,
  If,
  color,
  float,
  hash,
  instanceIndex,
  instancedArray,
  shapeCircle,
  step,
  uniform,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  Sprite,
  SpriteNodeMaterial,
  type Node,
  type WebGPURenderer,
} from 'three/webgpu';

const LIFE = 2.5; // seconds before respawn
const GROUND = -0.9;
const GRAVITY = -2.4;
const MAX_DT = 1 / 30; // avoid huge steps after a tab switch

/** Upward cone, deterministic per seed. */
function randomVelocity(seed: Node<'float'>) {
  return vec3(
    hash(seed).sub(0.5).mul(1.2),
    hash(seed.add(1)).mul(1.5).add(1.2),
    hash(seed.add(2)).sub(0.5).mul(0.6),
  );
}

/**
 * M0 probe: a GPU-simulated spark fountain (gravity + ground bounce + respawn).
 * Proves that one TSL compute shader runs on both WebGPU and the WebGL 2 fallback
 * (transform feedback). Replaced by the real sparks in M3.
 */
export function createProbeParticles(count: number) {
  const positions = instancedArray(count, 'vec3');
  const velocities = instancedArray(count, 'vec3');
  const ages = instancedArray(count, 'float');

  const dt = uniform(0);
  const epoch = uniform(0); // changes every frame so respawns get fresh randomness

  const init = Fn(() => {
    const seed = float(instanceIndex);
    positions.element(instanceIndex).assign(vec3(0));
    velocities.element(instanceIndex).assign(randomVelocity(seed));
    ages.element(instanceIndex).assign(hash(seed.add(7)).mul(-LIFE)); // staggered start
  })().compute(count);

  const update = Fn(() => {
    const p = positions.element(instanceIndex);
    const v = velocities.element(instanceIndex);
    const age = ages.element(instanceIndex);

    age.addAssign(dt);

    If(age.greaterThan(LIFE), () => {
      p.assign(vec3(0));
      v.assign(randomVelocity(float(instanceIndex).add(epoch)));
      age.assign(0);
    });

    If(age.greaterThanEqual(0), () => {
      v.y.addAssign(dt.mul(GRAVITY));
      p.addAssign(v.mul(dt));

      If(p.y.lessThan(GROUND), () => {
        p.y.assign(GROUND);
        v.y.assign(v.y.negate().mul(0.45));
        v.x.mulAssign(0.8);
        v.z.mulAssign(0.8);
      });
    });
  })().compute(count);

  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  material.positionNode = positions.toAttribute();
  // Hidden until its staggered start (age < 0).
  material.scaleNode = float(0.02).mul(step(0, ages.toAttribute()));
  material.colorNode = color(0xff5a1a);
  material.opacityNode = shapeCircle();

  const object = new Sprite(material);
  object.count = count;
  object.frustumCulled = false;

  return {
    object,
    /** Run once before the first step. */
    init(renderer: WebGPURenderer) {
      return renderer.computeAsync(init);
    },
    /** Advance the simulation by one frame. */
    step(renderer: WebGPURenderer, delta: number) {
      dt.value = Math.min(delta, MAX_DT);
      epoch.value += 1;
      renderer.compute(update);
    },
    // Sprite geometry is shared module-wide by three: only the material is ours.
    dispose() {
      material.dispose();
    },
  };
}

export type ProbeParticles = ReturnType<typeof createProbeParticles>;
