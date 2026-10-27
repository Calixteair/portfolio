import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/three/random';
import {
  FIELD,
  HOLE,
  PLATE,
  bakeEdgeFields,
  decodeSigned,
  fieldTexelToPlate,
  holeOutline,
  isInside,
  outerOutline,
  polygonDistance,
  type EdgeFields,
} from '../../src/three/pendant/shape';

const outer = outerOutline();
const hole = holeOutline(mulberry32(7));

function texel(fields: EdgeFields, x: number, y: number) {
  const i = Math.floor(((x - fields.min.x) / fields.size.x) * fields.width);
  const j = Math.floor(((y - fields.min.y) / fields.size.y) * fields.height);
  const k = (j * fields.width + i) * 4;
  const sdf = decodeSigned(fields.data[k + 2] ?? 0, fields.range);
  return { hole: fields.data[k], outer: fields.data[k + 1], sdf, inside: fields.data[k + 3] };
}

describe('mulberry32', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('outlines', () => {
  it('matches the real pendant: 26 × 18 × 4 mm, two opposite corners cut', () => {
    expect(PLATE.hh / PLATE.hw).toBeCloseTo(26 / 18, 3);
    expect((PLATE.depth + 2 * PLATE.bevel) / (2 * PLATE.hw)).toBeCloseTo(4 / 18, 3);
    expect(outer).toHaveLength(6);
    // Square top-left and bottom-right corners, cut top-right and bottom-left.
    expect(outer).toContainEqual({ x: -PLATE.hw, y: PLATE.hh });
    expect(outer).toContainEqual({ x: PLATE.hw, y: -PLATE.hh });
  });

  it('places the whole eroded hole inside the plate, away from the outer edge', () => {
    for (const p of hole) {
      expect(isInside(p, outer)).toBe(true);
      expect(polygonDistance(p, outer)).toBeGreaterThan(0.03);
    }
  });

  it('is reproducible for a given seed', () => {
    expect(holeOutline(mulberry32(7))).toEqual(hole);
  });
});

describe('isInside / polygonDistance', () => {
  it('handle a unit square', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(isInside({ x: 0.5, y: 0.5 }, square)).toBe(true);
    expect(isInside({ x: 1.5, y: 0.5 }, square)).toBe(false);
    expect(polygonDistance({ x: 0.5, y: 0.25 }, square)).toBeCloseTo(0.25);
    expect(polygonDistance({ x: 2, y: 0.5 }, square)).toBeCloseTo(1);
  });
});

describe('bakeEdgeFields', () => {
  const fields = bakeEdgeFields(hole, outer);

  it('covers the plate plus a margin at the configured resolution', () => {
    expect(fields.data).toHaveLength(FIELD.width * FIELD.height * 4);
    expect(fieldTexelToPlate(0, 0, fields).x).toBeLessThan(-PLATE.hw);
    expect(fieldTexelToPlate(FIELD.width - 1, FIELD.height - 1, fields).y).toBeGreaterThan(
      PLATE.hh,
    );
  });

  it('marks the hole centre as inside and the solid metal as outside', () => {
    expect(texel(fields, HOLE.cx, HOLE.cy).inside).toBe(255);
    expect(texel(fields, -0.27, -0.4).inside).toBe(0);
  });

  it('grows the hole distance away from the hole and saturates far from it', () => {
    const near = texel(fields, HOLE.cx + HOLE.hw + 0.01, HOLE.cy).hole ?? 0;
    const far = texel(fields, -0.29, -0.43).hole ?? 0;
    expect(near).toBeLessThan(far);
    expect(far).toBeGreaterThan(100);
  });

  it('measures the outer edge distance near zero on the rim', () => {
    expect(texel(fields, PLATE.hw, 0).outer).toBeLessThan(10);
  });

  it('stores a signed distance to the plate shape: negative in the metal only', () => {
    const metal = texel(fields, -0.25, -0.35);
    expect(metal.sdf).toBeLessThan(-0.01);
    expect(texel(fields, HOLE.cx, HOLE.cy).sdf).toBeGreaterThan(0.05);
    expect(texel(fields, PLATE.hw + 0.015, 0).sdf).toBeGreaterThan(0);
    // Magnitude: the nearest edge, within a texel of quantization error (range / 127).
    const quantum = fields.range / 127 + 0.005;
    expect(Math.abs(texel(fields, PLATE.hw - 0.02, 0).sdf + 0.02)).toBeLessThan(quantum);
  });
});
