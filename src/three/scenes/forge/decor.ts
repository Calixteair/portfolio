import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  type BufferGeometry,
  ConeGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  type Color,
  type UniformNode,
} from 'three/webgpu';
import { createRockMaterial } from '../../../shaders/rock';
import { createSkyMaterial } from '../../../shaders/sky';
import { disposeMeshes } from '../../dispose';
import { mulberry32 } from '../../random';
import { fbm2, ridgeProfile, valueNoise2 } from './terrainNoise';
import { glowIntensity } from './uniforms';

/** Ground height: sparks bounce on this plane (M3), the pendant floats above it. */
export const GROUND_Y = -0.9;

type Range = [number, number];

interface PeakLayer {
  count: number;
  distance: Range;
  height: Range;
  radius: Range;
  glow: number;
  color: number;
}

/** Near → far: rocks and small peaks, mid-distance peaks, large mountains (SPEC §5.1). */
const PEAK_LAYERS: PeakLayer[] = [
  {
    count: 5,
    distance: [4.5, 8],
    height: [0.5, 1.2],
    radius: [0.35, 0.8],
    glow: 1,
    color: 0x4a4b50,
  },
  {
    count: 9,
    distance: [11, 18],
    height: [1.4, 3.2],
    radius: [1, 2.2],
    glow: 0.5,
    color: 0x3a3b40,
  },
  {
    count: 12,
    distance: [24, 36],
    height: [3, 6.5],
    radius: [2.5, 4.5],
    glow: 0.2,
    color: 0x3a3b40,
  },
];

/** Distant chains, readable only as silhouettes in the haze. */
const RIDGES = [
  { z: -50, width: 240, height: 8 },
  { z: -80, width: 340, height: 14 },
];

type Rand = () => number;
const pick = (rand: Rand, [a, b]: Range) => a + rand() * (b - a);

/** Sharp faceted peak: low-sided cone jagged by position-hashed noise (facets stay watertight). */
function peakGeometry(rand: Rand, radius: number, height: number, lean: number): BufferGeometry {
  const geometry = new ConeGeometry(radius, height, 4 + Math.floor(rand() * 4), 5);
  const pos = geometry.getAttribute('position');
  const seed = rand() * 100;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const f = y / height + 0.5;
    const n = valueNoise2(x * 3 + seed, z * 3 + y * 2) - 0.5;
    pos.setXYZ(
      i,
      x * (1 + n * 0.5) + lean * f * f * height,
      y + n * height * 0.08 * (1 - f),
      z * (1 + n * 0.5),
    );
  }
  geometry.translate(0, height / 2 + GROUND_Y - 0.05, 0);
  return geometry;
}

/** A main peak and two smaller ones around it, placed in front of the camera at `distance`. */
function peakCluster(rand: Rand, layer: PeakLayer): BufferGeometry[] {
  const angle = (rand() - 0.5) * 2.6;
  const distance = pick(rand, layer.distance);
  const height = pick(rand, layer.height);
  const radius = pick(rand, layer.radius);
  const cx = Math.sin(angle) * distance;
  const cz = -Math.cos(angle) * distance - 1;
  return [0, 1, 2].map((k) => {
    const scale = k === 0 ? 1 : 0.45 + rand() * 0.35;
    const geometry = peakGeometry(rand, radius * scale, height * scale, (rand() - 0.5) * 0.25);
    geometry.rotateY(rand() * 6.28);
    const dx = k === 0 ? 0 : (rand() - 0.5) * radius * 2.2;
    const dz = k === 0 ? 0 : (rand() - 0.5) * radius * 1.5;
    geometry.translate(cx + dx, 0, cz + dz);
    return geometry;
  });
}

function ridgeGeometry({ z, width, height }: (typeof RIDGES)[number]): BufferGeometry {
  const segments = 260;
  const geometry = new PlaneGeometry(width, 1, segments, 1);
  const pos = geometry.getAttribute('position');
  for (let i = 0; i <= segments; i++) {
    pos.setY(i, GROUND_Y + height * ridgeProfile(pos.getX(i), z));
    pos.setY(i + segments + 1, GROUND_Y - 1);
  }
  geometry.translate(0, 0, z);
  return geometry;
}

/** Almost flat under the pendant, broken rock further out. */
function groundGeometry(): BufferGeometry {
  // ~0.9 m cells: the relief is 1.5 cm near the pendant and the haze hides detail far out.
  const geometry = new PlaneGeometry(140, 140, 160, 160);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const amplitude = 0.015 + 0.6 * Math.min(1, Math.max(0, (Math.hypot(x, z) - 2) / 25));
    const rocks = fbm2(x * 0.9, z * 0.9) + 0.5 * fbm2(x * 4, z * 4);
    pos.setY(i, GROUND_Y + (rocks - 0.7) * amplitude);
  }
  // No computeVertexNormals: rock is flat-shaded from screen-space derivatives.
  return geometry;
}

export interface ForgeWorld {
  group: Group;
  /** Per-frame: glow intensity follows the heat. */
  update: (heat: number) => void;
  dispose: () => void;
}

/** One merged mesh per layer: a handful of draw calls for the whole world. */
function buildPeaks(rand: Rand, heat: UniformNode<'float', number>): Mesh[] {
  const layers = PEAK_LAYERS.map((layer, i) => {
    const parts = Array.from({ length: layer.count }, () => peakCluster(rand, layer)).flat();
    const material = createRockMaterial(heat, {
      color: layer.color,
      bands: i === 0,
      glow: layer.glow,
    });
    return new Mesh(mergeGeometries(parts), material);
  });
  const ridges = mergeGeometries(RIDGES.map(ridgeGeometry));
  const far = createRockMaterial(heat, { color: 0x3a3b40, bands: false, glow: 0 });
  return [...layers, new Mesh(ridges, far)];
}

export function createForgeWorld(heat: UniformNode<'float', number>, horizon: Color): ForgeWorld {
  const rand = mulberry32(11);
  const ground = new Mesh(
    groundGeometry(),
    createRockMaterial(heat, { color: 0x1c1c1f, bands: false, glow: 0.35 }),
  );
  const sky = new Mesh(new SphereGeometry(140, 48, 24), createSkyMaterial(heat, horizon));
  const glow = new PointLight(0xff6a2a, 0.3, 40, 1.25);
  glow.position.set(0, GROUND_Y + 0.15, -0.4);
  const group = new Group();
  group.add(ground, sky, glow, ...buildPeaks(rand, heat));
  const dispose = () => disposeMeshes(group);
  const update = (value: number) => {
    glow.intensity = glowIntensity(value);
  };
  return { group, update, dispose };
}
