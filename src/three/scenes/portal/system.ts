import {
  color,
  hash,
  instanceIndex,
  instancedArray,
  mx_noise_float,
  positionLocal,
  uv,
  shapeCircle,
  sin,
  time,
  vec3,
  float,
} from 'three/tsl';
import {
  AdditiveBlending,
  AmbientLight,
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PointLight,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Sprite,
  SpriteNodeMaterial,
  type Node,
} from 'three/webgpu';
import { PALETTE_B, createNebulaMaterial } from '../../../shaders/nebula';
import { disposeMeshes } from '../../dispose';
import { mulberry32 } from '../../random';
import { layoutSystem, type SystemEntry } from '../../../system/layout';
import { createBodies, type SystemBodies } from './bodies';

/**
 * The planetary system on the other side (SPEC §5.7), palette B, built from the content:
 * the star at the origin, planets, moons, belt asteroids and stations around it.
 */

/** A few hundred embers (≈ 50 % red, SPEC §1) and blue motes drifting in the void. */
function motes(count: number): Sprite {
  const rand = mulberry32(41);
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 6 + rand() * 26;
    const a = rand() * Math.PI * 2;
    data.set([Math.cos(a) * r, (rand() - 0.5) * 10, Math.sin(a) * r], i * 3);
  }
  const positions = instancedArray(data, 'vec3').toAttribute() as Node<'vec3'>;
  const seed = hash(instanceIndex);
  const twinkle = sin(time.mul(1.7).add(seed.mul(60)))
    .mul(0.4)
    .add(0.6);
  const ember = seed.lessThan(0.5);
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  material.positionNode = positions.add(vec3(0, sin(time.mul(0.2).add(seed.mul(9))).mul(0.3), 0));
  material.scaleNode = float(0.06);
  material.colorNode = ember
    .select(color(PALETTE_B.ember).mul(2.2), color(PALETTE_B.core))
    .mul(twinkle);
  material.opacityNode = shapeCircle() as Node<'float'>;
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return sprite;
}

/** Soft glow around the star: a camera-facing sprite fading out, breathing slowly. */
function corona(): Sprite {
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const d = uv().sub(0.5).length().mul(2);
  const breathe = sin(time.mul(0.5)).mul(0.08).add(1);
  material.colorNode = color(PALETTE_B.core).mul(float(0.9).mul(breathe));
  material.opacityNode = float(1).sub(d).clamp(0, 1).pow(3);
  const sprite = new Sprite(material);
  sprite.scale.setScalar(7);
  return sprite;
}

/**
 * The ring the visitor came through (SPEC §5.7): dark metal with a liquid, rippling surface
 * and a faint blue glow. It stays behind the arrival point, visible when looking back.
 */
function arrivalRing(): Mesh {
  const material = new MeshStandardNodeMaterial({ metalness: 0.95 });
  // Liquid dark metal: slow ripples running around the ring vary its sheen and glow.
  const flow = mx_noise_float(positionLocal.mul(6).add(vec3(0, 0, time.mul(0.35))));
  material.colorNode = color(0x07090d);
  material.roughnessNode = flow.mul(0.12).add(0.18);
  material.emissiveNode = color(PALETTE_B.filament).mul(flow.mul(0.5).add(0.5).pow(4).mul(0.6));
  const ring = new Mesh(new TorusGeometry(2.2, 0.16, 32, 160), material);
  ring.position.set(0, 2.5, 47.5);
  return ring;
}

export interface PortalSystem {
  scene: Scene;
  bodies: SystemBodies;
  /** Per frame: orbits. */
  update: (elapsed: number) => void;
  dispose: () => void;
}

export function createPortalSystem(entries: SystemEntry[]): PortalSystem {
  const scene = new Scene();
  const sky = new Mesh(new SphereGeometry(200, 48, 24), createNebulaMaterial());
  const starMaterial = new MeshBasicNodeMaterial();
  // HDR core: blooms through the main pipeline once displayed in the portal.
  starMaterial.colorNode = color(PALETTE_B.core).mul(2.5);
  const star = new Mesh(new SphereGeometry(0.9, 48, 24), starMaterial);
  star.add(corona());
  // Gentle falloff: the outer planets (≈ 40 m) must stay lit; a faint blue fill keeps their
  // night side readable.
  const light = new PointLight(PALETTE_B.core, 30, 0, 0.9);
  const fill = new AmbientLight(PALETTE_B.filament, 0.4);
  const bodies = createBodies(layoutSystem(entries));
  const embers = motes(600);
  scene.add(sky, star, light, fill, bodies.group, embers, arrivalRing());
  scene.background = new Color(PALETTE_B.void);
  const dispose = () => disposeMeshes(scene);
  return { scene, bodies, update: bodies.update, dispose };
}
