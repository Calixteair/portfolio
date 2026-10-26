import { HOLE, type Point } from './shape';

/**
 * Spark emitters: points spread along an outline, each with its 2D unit normal pointing
 * out of the metal: into the hole for the hole's outline (`inward`), away from the hole
 * centre for the outer edge. Sparks then fly off the surface instead of into it.
 * Packed as vec4 (x, y, nx, ny) for a GPU float texture.
 */
export function sampleEdge(
  poly: readonly Point[],
  count: number,
  rand: () => number,
  inward = false,
): Float32Array {
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rand() * poly.length);
    const a = poly[k] as Point;
    const b = poly[(k + 1) % poly.length] as Point;
    const t = rand();
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let nx = -(b.y - a.y) / len;
    let ny = (b.x - a.x) / len;
    const away = (x - HOLE.cx) * nx + (y - HOLE.cy) * ny >= 0;
    if (away === inward) {
      nx = -nx;
      ny = -ny;
    }
    out.set([x, y, nx, ny], i * 4);
  }
  return out;
}
