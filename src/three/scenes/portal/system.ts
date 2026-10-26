import {
  color,
  hash,
  instanceIndex,
  instancedArray,
  mx_noise_float,
  positionLocal,
  shapeCircle,
  sin,
  time,
  vec3,
  mix,
  float,
} from 'three/tsl';
import {
  AdditiveBlending,
  Color,
  Group,
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

/**
 * Provisional planetary system seen through the portal (SPEC §5.7), palette B. M6 replaces
 * it with the real, content-driven system; it only has to sell the "other side" for now.
 */

interface PlanetSpec {
  radius: number;
  orbit: number;
  speed: number;
  phase: number;
  hue: number;
}

const PLANETS: PlanetSpec[] = [
  { radius: 0.35, orbit: 4.5, speed: 0.07, phase: 0.6, hue: 0.58 },
  { radius: 0.6, orbit: 7, speed: 0.045, phase: 2.4, hue: 0.62 },
  { radius: 0.45, orbit: 10, speed: 0.03, phase: 4.1, hue: 0.04 },
  { radius: 0.8, orbit: 14, speed: 0.02, phase: 5.3, hue: 0.55 },
];

/** Banded, noisy procedural planet (placeholder for the M6 content-driven planets). */
function planetMaterial(hue: number): MeshStandardNodeMaterial {
  const base = new Color().setHSL(hue, 0.55, 0.35);
  const band = new Color().setHSL(hue, 0.4, 0.12);
  const p = positionLocal.normalize();
  const n = mx_noise_float(vec3(p.y.mul(9), p.x.mul(2), p.z.mul(2)))
    .mul(0.5)
    .add(0.5);
  const material = new MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 });
  material.colorNode = mix(color(band), color(base), n);
  return material;
}

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

/**
 * The ring the visitor came through (SPEC §5.7), provisional: dark metal with a faint blue
 * inner glow. M6 replaces it with the real ring (dark, liquid surface).
 */
function arrivalRing(): Mesh {
  const material = new MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.9 });
  material.colorNode = color(0x0b0d12);
  material.emissiveNode = color(PALETTE_B.filament).mul(0.15);
  const ring = new Mesh(new TorusGeometry(2.2, 0.16, 24, 128), material);
  ring.position.set(0, 2.5, 47.5);
  return ring;
}

export interface PortalSystem {
  scene: Scene;
  /** Per frame: orbits. */
  update: (elapsed: number) => void;
  dispose: () => void;
}

export function createPortalSystem(): PortalSystem {
  const scene = new Scene();
  const sky = new Mesh(new SphereGeometry(200, 48, 24), createNebulaMaterial());
  const starMaterial = new MeshBasicNodeMaterial();
  // HDR core: blooms through the main pipeline once displayed in the portal.
  starMaterial.colorNode = color(PALETTE_B.core).mul(2.5);
  const star = new Mesh(new SphereGeometry(0.9, 48, 24), starMaterial);
  const light = new PointLight(PALETTE_B.core, 60, 0, 1.4);
  const orbits = new Group();
  const planets = PLANETS.map((spec) => {
    const mesh = new Mesh(new SphereGeometry(spec.radius, 48, 24), planetMaterial(spec.hue));
    orbits.add(mesh);
    return { mesh, spec };
  });
  const embers = motes(600);
  scene.add(sky, star, light, orbits, embers, arrivalRing());
  scene.background = new Color(PALETTE_B.void);

  const update = (elapsed: number) => {
    for (const { mesh, spec } of planets) {
      const a = spec.phase + elapsed * spec.speed;
      mesh.position.set(
        Math.cos(a) * spec.orbit,
        Math.sin(a * 0.7) * 0.4,
        Math.sin(a) * spec.orbit,
      );
      mesh.rotation.y = elapsed * 0.1;
    }
  };
  update(0);
  const dispose = () => disposeMeshes(scene);
  return { scene, update, dispose };
}
