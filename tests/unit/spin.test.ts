import { describe, expect, it } from 'vitest';
import {
  SPIN,
  breathingTilt,
  createSpin,
  dragSpin,
  impulseSpin,
  stepSpin,
} from '../../src/three/pendant/spin';

function simulate(state: ReturnType<typeof createSpin>, seconds: number, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepSpin(state, dt);
}

describe('spin', () => {
  it('starts at rest', () => {
    expect(createSpin()).toEqual({ angle: 0.35, velocity: 0, turns: 0 });
  });

  it('keeps turning after a click and slows down without stopping abruptly', () => {
    const s = createSpin(0);
    impulseSpin(s);
    simulate(s, 0.5);
    const mid = s.velocity;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(SPIN.impulse);
    simulate(s, 5);
    expect(s.velocity).toBeLessThan(mid * 0.01);
    expect(s.angle).toBeGreaterThan(0);
  });

  it('decays exponentially, independent of the frame rate', () => {
    const a = createSpin(0);
    const b = createSpin(0);
    impulseSpin(a);
    impulseSpin(b);
    simulate(a, 1, 1 / 30);
    simulate(b, 1, 1 / 144);
    expect(a.velocity).toBeCloseTo(b.velocity, 1);
    expect(a.velocity).toBeCloseTo(SPIN.impulse * Math.exp(-SPIN.damping), 1);
  });

  it('stacks clicks in the current direction, up to the speed cap', () => {
    const s = createSpin(0);
    dragSpin(s, -20, 0.016);
    impulseSpin(s);
    expect(s.velocity).toBeLessThan(0);
    for (let i = 0; i < 20; i++) impulseSpin(s);
    expect(s.velocity).toBe(-SPIN.maxSpeed);
  });

  it('turns a drag into angle and release velocity, guarding tiny intervals', () => {
    const s = createSpin(0);
    dragSpin(s, 20, 0.02);
    expect(s.angle).toBeCloseTo(20 * SPIN.dragSensitivity);
    expect(s.velocity).toBeCloseTo((20 * SPIN.dragSensitivity) / 0.02);
    dragSpin(s, 50, 0);
    expect(Number.isFinite(s.velocity)).toBe(true);
    expect(Math.abs(s.velocity)).toBeLessThanOrEqual(SPIN.maxSpeed);
  });

  it('counts full turns in both directions', () => {
    const s = createSpin(0);
    for (let i = 0; i < 100; i++) dragSpin(s, ((Math.PI * 2) / SPIN.dragSensitivity) * 0.01, 0.1);
    for (let i = 0; i < 100; i++) dragSpin(s, -((Math.PI * 2) / SPIN.dragSensitivity) * 0.01, 0.1);
    expect(s.turns).toBeCloseTo(2);
  });

  it('breathes only without reduced motion', () => {
    expect(breathingTilt(2, true)).toBe(0.06);
    expect(breathingTilt(2, false)).not.toBe(0.06);
  });
});
