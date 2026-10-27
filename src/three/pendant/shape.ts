/**
 * 2D outlines of the placeholder pendant and the distance fields baked from them.
 * Pure math, no Three.js: the same data drives the mesh, the crust, the heat (M3)
 * and the spark emitters and collisions (M3). Units are metres-ish scene units.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * The real pendant: 26 × 18 × 4 mm, sterling silver (maker's dimensions), no bail.
 * Scene units: 18 mm wide = 0.62, so 1 mm ≈ 0.0344. Thickness = depth + 2 × bevel = 4 mm.
 */
const MM = 0.62 / 18;
export const PLATE = {
  hw: 9 * MM,
  hh: 13 * MM,
  chamfer: 2.6 * MM,
  bevel: 0.35 * MM,
  depth: (4 - 0.7) * MM,
} as const;

/** Eroded hole: off-centre rounded rectangle. */
export const HOLE = { cx: 0.015, cy: 0.035, hw: 0.165, hh: 0.245 } as const;

/** Margin around the plate in the loader SVG viewBox (plate units). */
export const WIRE_PAD = 0.02;

/** edgeMask resolution and the distance (scene units) mapped to 1 in the texture. */
export const FIELD = { width: 160, height: 232, range: 0.2, margin: 0.02 } as const;

/**
 * Plate outline, clockwise from the top left: as on the real pendant, only two
 * opposite corners are cut (top right, bottom left), the other two are square.
 */
export function outerOutline(): Point[] {
  const { hw, hh, chamfer: c } = PLATE;
  const corners: [number, number][] = [
    [-hw, hh],
    [hw - c, hh],
    [hw, hh - c],
    [hw, -hh],
    [-hw + c, -hh],
    [-hw, -hh + c],
  ];
  return corners.map(([x, y]) => ({ x, y }));
}

const HOLE_WAVES: [frequency: number, amplitude: number][] = [
  [3, 0.012],
  [7, 0.009],
  [13, 0.006],
  [29, 0.004],
  [53, 0.0025],
];

/** Superellipse (rounded rectangle) pushed in and out along its radius by periodic noise. */
export function holeOutline(rand: () => number, samples = 180): Point[] {
  const waves = HOLE_WAVES.map(([f, a]) => ({ f, a, phase: rand() * Math.PI * 2 }));
  const points: Point[] = [];
  for (let i = 0; i < samples; i++) {
    const angle = (i / samples) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x = Math.sign(c) * Math.abs(c) ** 0.25 * HOLE.hw;
    const y = Math.sign(s) * Math.abs(s) ** 0.25 * HOLE.hh;
    const wave = waves.reduce((sum, w) => sum + w.a * Math.sin(w.f * angle + w.phase), 0);
    const offset = wave + (rand() - 0.5) * 0.006;
    const len = Math.hypot(x, y) || 1;
    points.push({ x: HOLE.cx + x + (x / len) * offset, y: HOLE.cy + y + (y / len) * offset });
  }
  return points;
}

/**
 * Unsigned distance from p to the closed polygon's edges. Hot loop of the bake (~37k texels ×
 * ~190 edges): plain loop on squared distances, a single sqrt at the end.
 */
export function polygonDistance(p: Point, poly: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j] as Point;
    const b = poly[i] as Point;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const px = p.x - a.x;
    const py = p.y - a.y;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
    const ex = px - t * dx;
    const ey = py - t * dy;
    best = Math.min(best, ex * ex + ey * ey);
  }
  return Math.sqrt(best);
}

/** Even-odd ray casting. */
export function isInside(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Point;
    const b = poly[j] as Point;
    const crosses =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export interface EdgeFields {
  /**
   * RGBA8. R: distance to the hole edge, G: distance to the outer edge (0-1 over `range`).
   * B: signed distance to the plate's 2D shape (metal < 0.5 < hole or outside, ±range).
   * A: 255 inside the hole.
   */
  data: Uint8Array;
  width: number;
  height: number;
  /** Bottom-left corner and size of the area covered by the texture, in plate space. */
  min: Point;
  size: Point;
  range: number;
}

/** Signed distance (±range) to a byte, 128 ≈ on the surface. */
export function encodeSigned(d: number, range: number): number {
  return Math.round((Math.max(-1, Math.min(1, d / range)) * 0.5 + 0.5) * 255);
}

/** Inverse of encodeSigned (what the shaders do with the sampled 0-1 value). */
export function decodeSigned(byte: number, range: number): number {
  return (byte / 255 - 0.5) * 2 * range;
}

/** Texel centre (i, j) to plate-space coordinates. */
export function fieldTexelToPlate(i: number, j: number, fields: Omit<EdgeFields, 'data'>): Point {
  return {
    x: fields.min.x + ((i + 0.5) / fields.width) * fields.size.x,
    y: fields.min.y + ((j + 0.5) / fields.height) * fields.size.y,
  };
}

/** Where the fields lie in plate space and their resolution (everything but the data). */
export function fieldLayout(): Omit<EdgeFields, 'data'> {
  const { width, height, range, margin } = FIELD;
  const min = { x: -PLATE.hw - margin, y: -PLATE.hh - margin };
  const size = { x: 2 * (PLATE.hw + margin), y: 2 * (PLATE.hh + margin) };
  return { width, height, min, size, range };
}

export function bakeEdgeFields(hole: readonly Point[], outer: readonly Point[]): EdgeFields {
  const layout = fieldLayout();
  const { width, height, range } = layout;
  const fields: EdgeFields = { ...layout, data: new Uint8Array(width * height * 4) };
  const quantize = (d: number) => Math.round(Math.min(1, d / range) * 255);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const p = fieldTexelToPlate(i, j, fields);
      const k = (j * width + i) * 4;
      const toHole = polygonDistance(p, hole);
      const toOuter = polygonDistance(p, outer);
      const inHole = isInside(p, hole);
      const inMetal = !inHole && isInside(p, outer);
      fields.data[k] = quantize(toHole);
      fields.data[k + 1] = quantize(toOuter);
      fields.data[k + 2] = encodeSigned((inMetal ? -1 : 1) * Math.min(toHole, toOuter), range);
      fields.data[k + 3] = inHole ? 255 : 0;
    }
  }
  return fields;
}
