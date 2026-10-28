import { Box3, type BufferGeometry, type Matrix4, Vector3 } from 'three/webgpu';

/**
 * What the sparks bounce on beyond the flat ground under the pendant (SPEC §5.4): the
 * real relief of the cirque floor, and the nearest rocks as upright truncated cones.
 * Pure data, built on the CPU once, read by the spark compute shader.
 */

/** The ground mesh's lattice: a PlaneGeometry of SIZE m, SEGMENTS × SEGMENTS quads. */
export const GROUND_MESH = { size: 140, segments: 180 } as const;

/** Sparks never fly further than ~5.5 m (measured at full spin): the field covers 7 m. */
const FIELD_REACH = 7;

/**
 * The drawn ground's own vertices around the pendant, so a spark bounces on the very
 * facets that are drawn (same lattice, same triangle split), not on a smoother copy.
 */
export interface GroundField {
  /** Heights (world y), row-major, `size` × `size`; row = z index, column = x index. */
  heights: Float32Array;
  size: number;
  /** World x and z of the first vertex. */
  origin: number;
  step: number;
  /** Highest point: sparks above it need no lookup. */
  top: number;
}

/**
 * Window of the ground mesh (a GROUND_MESH PlaneGeometry laid flat: vertex (i, j) at
 * x = -size/2 + i·step, z = -size/2 + j·step) within FIELD_REACH of the pendant.
 */
export function groundField(ground: BufferGeometry): GroundField {
  const { size: extent, segments } = GROUND_MESH;
  const step = extent / segments;
  const first = Math.ceil((extent / 2 - FIELD_REACH) / step);
  const size = Math.floor((extent / 2 + FIELD_REACH) / step) - first + 1;
  const pos = ground.getAttribute('position');
  const heights = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      heights[j * size + i] = pos.getY((first + j) * (segments + 1) + first + i);
    }
  }
  const origin = pos.getX(first);
  return { heights, size, origin, step, top: Math.max(...heights) };
}

/**
 * Height of the drawn ground at (x, z): PlaneGeometry splits each quad along the diagonal
 * from (i, j+1) to (i+1, j). CPU twin of the shader's lookup, for the tests.
 */
export function sampleGround(field: GroundField, x: number, z: number): number {
  const { heights, size, origin, step } = field;
  const gx = Math.min(Math.max((x - origin) / step, 0), size - 1.001);
  const gz = Math.min(Math.max((z - origin) / step, 0), size - 1.001);
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const fx = gx - i;
  const fz = gz - j;
  const at = (di: number, dj: number) => heights[(j + dj) * size + i + di] ?? 0;
  if (fx + fz <= 1) return at(0, 0) + fx * (at(1, 0) - at(0, 0)) + fz * (at(0, 1) - at(0, 0));
  return at(1, 1) + (1 - fx) * (at(0, 1) - at(1, 1)) + (1 - fz) * (at(1, 0) - at(1, 1));
}

/** An upright truncated cone: centre of its base, height, base and top radii. */
export interface Cone {
  x: number;
  y: number;
  z: number;
  height: number;
  bottom: number;
  top: number;
}

/** Share of the height at each end whose vertices set the base and top radii. */
const BAND = 0.25;
/**
 * The rocks are 5-7-sided prisms: their widest vertices are corners. A cone through the
 * corners would bounce sparks off thin air before the faces; this one cuts between them.
 */
const HULL = 0.9;

/**
 * Upright cone around a rock's vertices (after `matrix`): the footprint's centre, its
 * widest point near the base and near the top. The rocks lean by a few degrees at most.
 */
export function fitCone(geometry: BufferGeometry, matrix?: Matrix4): Cone {
  const pos = geometry.getAttribute('position');
  const points = Array.from({ length: pos.count }, (_, i) => {
    const p = new Vector3().fromBufferAttribute(pos, i);
    return matrix ? p.applyMatrix4(matrix) : p;
  });
  const box = new Box3().setFromPoints(points);
  const { x, z } = box.getCenter(new Vector3());
  const y0 = box.min.y;
  const y1 = box.max.y;
  const height = y1 - y0;
  const widest = (keep: (y: number) => boolean) =>
    HULL * Math.max(0, ...points.filter((p) => keep(p.y)).map((p) => Math.hypot(p.x - x, p.z - z)));
  const bottom = widest((y) => y <= y0 + BAND * height);
  const top = Math.min(
    bottom,
    widest((y) => y >= y1 - BAND * height),
  );
  return { x, y: y0, z, height, bottom, top };
}

/** At most this many rocks are tested by every spark. */
export const MAX_ROCKS = 32;

/** Horizontal distance from the pendant to the foot of a rock. */
export const rockGap = (c: Cone) => Math.hypot(c.x, c.z) - c.bottom;

/** Rocks a spark can reach, nearest first. */
export function reachableRocks(cones: Cone[]): Cone[] {
  return cones
    .filter((c) => rockGap(c) < FIELD_REACH)
    .sort((a, b) => rockGap(a) - rockGap(b))
    .slice(0, MAX_ROCKS);
}

export interface SparkColliders {
  ground: GroundField;
  rocks: Cone[];
}
