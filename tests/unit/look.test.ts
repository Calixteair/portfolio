import { describe, expect, it } from 'vitest';
import {
  LOOK,
  createLook,
  dragLook,
  lookTowards,
  stepLook,
  viewDirection,
} from '../../src/system/look';

describe('look', () => {
  it('looks straight ahead (-z) with no offset', () => {
    const [x, y, z] = viewDirection(createLook(), { yaw: 0, pitch: 0 });
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1);
  });

  it('turns around fully: dragging half a turn looks behind', () => {
    const s = createLook();
    dragLook(s, -Math.PI / LOOK.sensitivity, 0, 1);
    const [, , z] = viewDirection(s, { yaw: 0, pitch: 0 });
    expect(z).toBeCloseTo(1);
  });

  it('never pitches over the poles', () => {
    const s = createLook();
    dragLook(s, 0, -1e6, 1);
    expect(s.pitch).toBeCloseTo(LOOK.maxPitch);
    stepLook(s, 1);
    expect(s.pitch).toBeLessThanOrEqual(LOOK.maxPitch);
  });

  it('keeps turning after a flick, then settles', () => {
    const s = createLook();
    dragLook(s, -50, 0, 0.02);
    const after = s.yaw;
    stepLook(s, 0.1);
    expect(s.yaw).toBeGreaterThan(after);
    for (let i = 0; i < 300; i++) stepLook(s, 1 / 60);
    expect(Math.abs(s.yawSpeed)).toBeLessThan(1e-3);
  });

  it('turns while an arrow key is held', () => {
    const s = createLook();
    stepLook(s, 0.5, { yaw: 1, pitch: 0 });
    expect(s.yaw).toBeCloseTo(LOOK.keySpeed * 0.5);
  });

  it('can be pointed back at a direction (round trip with viewDirection)', () => {
    const s = createLook();
    const base = { yaw: 0.2, pitch: -0.1 };
    lookTowards(s, [Math.SQRT1_2, 0.3, -Math.SQRT1_2], base);
    const [x, y, z] = viewDirection(s, base);
    expect(Math.atan2(-x, -z)).toBeCloseTo(Math.atan2(-Math.SQRT1_2, Math.SQRT1_2));
    expect(y).toBeCloseTo(0.3);
  });
});
