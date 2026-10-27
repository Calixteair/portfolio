import { describe, expect, it } from 'vitest';
import {
  FLIGHT,
  aroundStar,
  arrivalHandle,
  bezier,
  bezierTangent,
  flightDuration,
  length,
  normalize,
  orbitEntry,
  startFlight,
  upCross,
  type V3,
} from '../../src/system/flightPath';

const path = (from: V3, heading: V3, to: V3, arrival: V3) => {
  const start = startFlight(from, heading, to);
  const [p1, p2] = aroundStar(start.p0, start.p1, arrivalHandle(start, to, arrival), to);
  return { start, p1, p2 };
};

describe('shuttle flight path', () => {
  it('starts where the camera is, along its motion, and ends on the destination', () => {
    const from: V3 = [10, 2, 0];
    const to: V3 = [0, 1, 12];
    const { start, p1, p2 } = path(from, [0, 0, 1], to, [-1, 0, 0]);
    expect(bezier(start.p0, p1, p2, to, 0)).toEqual(from);
    const end = bezier(start.p0, p1, p2, to, 1);
    expect(length([end[0] - to[0], end[1] - to[1], end[2] - to[2]])).toBeCloseTo(0);
    const t0 = normalize(bezierTangent(start.p0, p1, p2, to, 0));
    expect(t0[2]).toBeGreaterThan(0.8); // leaves forwards (with a slight upward swing)
  });

  it('swings around the star instead of flying through it', () => {
    const from: V3 = [-20, 0, 0];
    const to: V3 = [20, 0, 0];
    const { start, p1, p2 } = path(from, [1, 0, 0], to, [1, 0, 0]);
    for (let i = 0; i <= 50; i++) {
      const p = bezier(start.p0, p1, p2, to, i / 50);
      expect(length(p)).toBeGreaterThan(FLIGHT.starClearance);
    }
  });

  it('joins the orbit tangentially, along the route', () => {
    const center: V3 = [0, 0, 10];
    const from: V3 = [0, 0, -10];
    const entry = orbitEntry(center, from);
    const tangent = upCross(entry);
    // The orbit tangent at the entry point heads away from where we come from.
    expect(tangent[2]).toBeCloseTo(1);
  });

  it('takes longer for longer trips, within bounds', () => {
    expect(flightDuration(0)).toBe(FLIGHT.minDuration);
    expect(flightDuration(20)).toBeGreaterThan(flightDuration(5));
    expect(flightDuration(1e4)).toBe(FLIGHT.maxDuration);
  });
});
