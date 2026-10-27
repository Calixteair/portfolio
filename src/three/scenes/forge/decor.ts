import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  type BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  CylinderGeometry,
  DodecahedronGeometry,
  InstancedMesh,
  Object3D,
  Group,
  Mesh,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  type Color,
  type UniformNode,
  Vector3,
} from 'three/webgpu';
import { createRockMaterial } from '../../../shaders/rock';
import { createSkyMaterial } from '../../../shaders/sky';
import { disposeMeshes } from '../../dispose';
import { mulberry32 } from '../../random';
import { fbm2, ridgeProfile } from './terrainNoise';
import { glowIntensity } from './uniforms';

/** Ground height: sparks bounce on this plane (M3), the pendant floats above it. */
export const GROUND_Y = -0.9;

type Range = [number, number];

/**
 * A cirque (SPEC §5.1, revised): the mountains stand on half-ellipses around the pendant,
 * open towards the camera, their arms reaching forward on both sides. `a` is the
 * half-width, `b` the depth radius, `center` how far behind the pendant the ellipse sits;
 * `span` the angle covered either side of straight behind (radians, > π/2: arms forward).
 */
interface Arc {
  a: number;
  b: number;
  center: number;
  span: number;
}

/** Point on an arc at `phi` (0 = straight behind the pendant), scaled by `k`. */
function onArc(arc: Arc, phi: number, k = 1): [number, number] {
  return [Math.sin(phi) * arc.a * k, -arc.center - Math.cos(phi) * arc.b * k];
}

interface PeakLayer {
  count: number;
  /** Null: scattered rocks close by, not on a wall. */
  arc: Arc | null;
  distance: Range;
  height: Range;
  radius: Range;
  glow: number;
  color: number;
}

/** Near → far: scattered rocks, the inner cirque wall, the great mountains (SPEC §5.1). */
const PEAK_LAYERS: PeakLayer[] = [
  {
    count: 14,
    arc: null,
    distance: [4.5, 12],
    height: [0.35, 1.1],
    radius: [0.3, 0.9],
    glow: 1,
    color: 0x4a4b50,
  },
  {
    count: 13,
    arc: { a: 13, b: 15, center: 5, span: 2.1 },
    distance: [0.92, 1.08],
    height: [1.2, 2.6],
    radius: [1, 2.2],
    glow: 0.5,
    color: 0x3a3b40,
  },
  {
    count: 16,
    arc: { a: 28, b: 28, center: 10, span: 2.2 },
    distance: [0.92, 1.1],
    height: [3, 5.5],
    radius: [2.5, 4.5],
    glow: 0.2,
    color: 0x3a3b40,
  },
];

/** Distant chains, readable only as silhouettes in the haze: continuous curved walls. */
const RIDGES: { arc: Arc; height: number }[] = [
  { arc: { a: 50, b: 48, center: 14, span: 2.25 }, height: 8 },
  { arc: { a: 70, b: 66, center: 14, span: 2.3 }, height: 13 },
];

type Rand = () => number;
const pick = (rand: Rand, [a, b]: Range) => a + rand() * (b - a);

/** Bring every vertex beyond the plane (normal n, through point c) back onto it. */
function cutWithPlane(pos: BufferAttribute, n: Vector3, c: Vector3): void {
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const d = p.sub(c).dot(n);
    if (d > 0) pos.setXYZ(i, pos.getX(i) - n.x * d, pos.getY(i) - n.y * d, pos.getZ(i) - n.z * d);
  }
}

/**
 * One cut block: a truncated prism of 5-7 sides, its top split along a slanted plane, as
 * rock breaks along its cleavage. Leaning a little, standing on the ground (y = 0).
 */
function block(rand: Rand, radius: number, height: number, spire: boolean): BufferGeometry {
  const sides = 5 + Math.floor(rand() * 3);
  // A spire keeps a sharp, chiselled tip; shoulders are blunt blocks.
  const top = radius * (spire ? 0.04 + rand() * 0.08 : 0.15 + rand() * 0.35);
  const geometry = new CylinderGeometry(top, radius, height, sides, 1);
  geometry.translate(0, height / 2, 0);
  const pos = geometry.getAttribute('position') as BufferAttribute;
  const slant = new Vector3(rand() - 0.5, 1.4 + rand(), rand() - 0.5).normalize();
  const cut = spire ? 0.84 + rand() * 0.1 : 0.65 + rand() * 0.25;
  cutWithPlane(pos, slant, new Vector3(0, height * cut, 0));
  geometry.rotateZ((rand() - 0.5) * 0.25);
  geometry.rotateX((rand() - 0.5) * 0.25);
  geometry.rotateY(rand() * Math.PI * 2);
  return geometry;
}

/**
 * Cut rock massif (SPEC §5.1, "roche taillée"): 3-5 overlapping blocks of varied sizes,
 * the tallest in the middle, for a broken, stepped silhouette instead of a smooth cone.
 * Flat-shaded; built once.
 */
function peakGeometry(layout: Rand, radius: number, height: number, lean: number): BufferGeometry {
  // Its own generator: the layout draws exactly 2 numbers, as the previous peaks did,
  // so the composition of the scene does not move.
  const rand = mulberry32(Math.floor(layout() * 2 ** 31));
  layout();
  const count = 3 + Math.floor(rand() * 3);
  const parts = Array.from({ length: count }, (_, k) => {
    const main = k === 0;
    const h = height * (main ? 1 : 0.35 + rand() * 0.45);
    const r = radius * (main ? 0.8 : 0.35 + rand() * 0.35);
    const g = block(rand, r, h, main);
    const a = rand() * Math.PI * 2;
    const off = main ? 0 : radius * (0.35 + rand() * 0.45);
    g.translate(Math.cos(a) * off + lean * height * 0.3, 0, Math.sin(a) * off);
    return g;
  });
  const geometry = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  for (const g of parts) g.dispose();
  geometry.translate(0, GROUND_Y - 0.05, 0);
  return geometry;
}

/**
 * Where a cluster stands: scattered close by, or the i-th of n along its layer's cirque
 * wall (evenly spread, jittered), taller on the arms so the walls frame the pendant.
 */
function clusterSpot(
  rand: Rand,
  layer: PeakLayer,
  i: number,
): { x: number; z: number; tall: number } {
  if (!layer.arc) {
    // Spread wide (±110°): the sides of the frame need rocks too, not only the back.
    const angle = (rand() - 0.5) * 3.8;
    const distance = pick(rand, layer.distance);
    return { x: Math.sin(angle) * distance, z: -Math.cos(angle) * distance - 1, tall: 1 };
  }
  const { span } = layer.arc;
  const phi = -span + ((i + 0.5 + (rand() - 0.5) * 0.7) / layer.count) * 2 * span;
  const [x, z] = onArc(layer.arc, phi, pick(rand, layer.distance));
  return { x, z, tall: 1 + 0.35 * Math.abs(Math.sin(phi)) };
}

/** A main peak and two smaller ones around it, at its spot (see clusterSpot). */
function peakCluster(rand: Rand, layer: PeakLayer, i: number): BufferGeometry[] {
  const spot = clusterSpot(rand, layer, i);
  const height = pick(rand, layer.height) * spot.tall;
  const radius = pick(rand, layer.radius);
  const cx = spot.x;
  const cz = spot.z;
  const base = groundHeight(cx, cz);
  return [0, 1, 2].map((k) => {
    const scale = k === 0 ? 1 : 0.45 + rand() * 0.35;
    const geometry = peakGeometry(rand, radius * scale, height * scale, (rand() - 0.5) * 0.25);
    geometry.rotateY(rand() * 6.28);
    const dx = k === 0 ? 0 : (rand() - 0.5) * radius * 2.2;
    const dz = k === 0 ? 0 : (rand() - 0.5) * radius * 1.5;
    geometry.translate(cx + dx, base, cz + dz);
    return geometry;
  });
}

/**
 * A distant chain as a continuous curved wall along its arc: a ribbon whose top follows a
 * ridged profile (sharp crests), taller on the arms, its foot sunk below the ground.
 */
function ridgeGeometry({ arc, height }: (typeof RIDGES)[number], seed: number): BufferGeometry {
  const segments = 320;
  const positions: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const phi = -arc.span + (i / segments) * 2 * arc.span;
    const [x, z] = onArc(arc, phi);
    const top = height * ridgeProfile(phi * arc.a, seed) * (1 + 0.4 * Math.abs(Math.sin(phi)));
    positions.push(x, GROUND_Y + groundHeight(x, z) + top, z, x, GROUND_Y - 2, z);
    if (i < segments) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return geometry;
}

/** Radius kept flat around the pendant: sparks bounce on the GROUND_Y plane there. */
const FLAT = 2.4;

/**
 * Height of the ground above GROUND_Y at (x, z): flat under the pendant, then mounds and
 * hollows of broken rock, the floor rising towards the cirque walls like a bowl.
 */
export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const rough = Math.min(1, Math.max(0, (r - FLAT) / 6));
  const mounds =
    fbm2(x * 0.18, z * 0.18) * 2.2 + fbm2(x * 0.9, z * 0.9) * 0.5 + fbm2(x * 4, z * 4) * 0.12;
  const bowl = Math.hypot(x / 1.1, (z + 6) / 1.2);
  const rise = Math.min(1, Math.max(0, (bowl - 12) / 35)) ** 1.6 * 2.5;
  return (mounds - 1.1) * rough * 0.9 + rise;
}

/** Ground: the cirque floor (see groundHeight). */
function groundGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(140, 140, 180, 180);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, GROUND_Y + groundHeight(pos.getX(i), pos.getZ(i)));
  }
  // No computeVertexNormals: rock is flat-shaded from screen-space derivatives.
  return geometry;
}

/** One cut pebble shape, every instance a scaled, turned copy of it. */
function pebbleGeometry(): BufferGeometry {
  const rand = mulberry32(5);
  const geometry = new DodecahedronGeometry(1, 0);
  const pos = geometry.getAttribute('position') as BufferAttribute;
  // Squashed and cut: a chip of rock, not a ball.
  geometry.scale(1, 0.6, 0.85);
  cutWithPlane(pos, new Vector3(0.3, 1, 0.2).normalize(), new Vector3(0, 0.35, 0));
  for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * (0.9 + rand() * 0.2));
  return geometry;
}

/**
 * Pebbles and chips of cut rock strewn on the ground, denser near the pendant (where its
 * glow lights them), half sunk in the relief. One instanced draw call.
 */
function pebbles(rand: Rand, count: number, heat: UniformNode<'float', number>): InstancedMesh {
  const material = createRockMaterial(heat, { color: 0x2c2c31, grain: true, glow: 0 });
  const mesh = new InstancedMesh(pebbleGeometry(), material, count);
  const dummy = new Object3D();
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const r = 1.3 + 22 * rand() ** 2.2;
    const x = Math.sin(angle) * r;
    const z = -Math.cos(angle) * r;
    // Between the pendant and the camera, pebbles loom large: keep those small.
    const near = z > 0 ? 0.45 : 1;
    // Mostly gravel, some stones.
    const base = rand() < 0.65 ? 0.01 + rand() * 0.025 : 0.035 + rand() * 0.07;
    const size = base * (1 + r * 0.06) * near;
    dummy.position.set(x, GROUND_Y + groundHeight(x, z) + size * 0.25, z);
    dummy.rotation.set((rand() - 0.5) * 0.6, rand() * Math.PI * 2, (rand() - 0.5) * 0.6);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  return mesh;
}

/**
 * Boulders: cut blocks (25-70 cm) between the pebbles and the peaks, so the ground is
 * not bare between them. Kept off the line between the camera and the pendant.
 */
function boulders(rand: Rand, count: number, heat: UniformNode<'float', number>): InstancedMesh {
  const material = createRockMaterial(heat, { color: 0x34353a, grain: true, glow: 0.6 });
  const mesh = new InstancedMesh(block(mulberry32(9), 1, 1, false), material, count);
  const dummy = new Object3D();
  for (let i = 0; i < count; i++) {
    const angle = (rand() - 0.5) * Math.PI * 1.25; // ±112°: never in front of the pendant
    const r = 3 + 24 * rand() ** 1.4;
    const x = Math.sin(angle) * r;
    const z = -Math.cos(angle) * r;
    const w = 0.25 + rand() * 0.45;
    const h = w * (0.6 + rand() * 0.8);
    dummy.position.set(x, GROUND_Y + groundHeight(x, z) - h * 0.15, z);
    dummy.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
    dummy.scale.set(w, h, w * (0.8 + rand() * 0.4));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  return mesh;
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
    const parts = Array.from({ length: layer.count }, (_, k) => peakCluster(rand, layer, k)).flat();
    const material = createRockMaterial(heat, {
      color: layer.color,
      grain: i === 0,
      glow: layer.glow,
    });
    return new Mesh(mergeGeometries(parts), material);
  });
  const ridges = mergeGeometries(RIDGES.map((r, i) => ridgeGeometry(r, 50 + i * 30)));
  const far = createRockMaterial(heat, { color: 0x3a3b40, grain: false, glow: 0 });
  return [...layers, new Mesh(ridges, far)];
}

export function createForgeWorld(
  heat: UniformNode<'float', number>,
  horizon: Color,
  strewn: { pebbles: number; boulders: number },
): ForgeWorld {
  const rand = mulberry32(11);
  const ground = new Mesh(
    groundGeometry(),
    createRockMaterial(heat, { color: 0x1c1c1f, grain: true, glow: 0.35, patches: true }),
  );
  const sky = new Mesh(new SphereGeometry(140, 48, 24), createSkyMaterial(heat, horizon));
  const glow = new PointLight(0xff6a2a, 0.3, 40, 1.25);
  glow.position.set(0, GROUND_Y + 0.15, -0.4);
  const group = new Group();
  group.add(
    ground,
    sky,
    glow,
    ...buildPeaks(rand, heat),
    pebbles(rand, strewn.pebbles, heat),
    boulders(rand, strewn.boulders, heat),
  );
  const dispose = () => disposeMeshes(group);
  const update = (value: number) => {
    glow.intensity = glowIntensity(value);
  };
  return { group, update, dispose };
}
