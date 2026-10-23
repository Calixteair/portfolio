import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/three/random';
import {
  FIELD,
  HOLE,
  PLATE,
  bakeEdgeFields,
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
  return { hole: fields.data[k], outer: fields.data[k + 1], inside: fields.data[k + 3] };
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
  it('keeps the pendant ratio of about 1.45 with chamfered corners', () => {
    expect(PLATE.hh / PLATE.hw).toBeCloseTo(1.45, 1);
    expect(outer).toHaveLength(8);
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
});
