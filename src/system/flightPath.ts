/**
 * Shuttle flight between bodies (SPEC §5.7): a cubic Bézier that leaves along the current
 * motion, swings up and around the star, and joins the destination orbit tangentially.
 * Pure maths on [x, y, z] tuples: the 3D side evaluates it every frame.
 */
export type V3 = readonly [number, number, number];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: V3) => Math.sqrt(dot(a, a));
export const normalize = (a: V3): V3 => {
  const l = length(a);
  return l > 1e-9 ? scale(a, 1 / l) : [0, 0, 0];
};
/** Cross product with the up axis (0, 1, 0): a horizontal vector turned by +90°. */
export const upCross = (a: V3): V3 => [a[2], 0, -a[0]];

export const FLIGHT = {
  /** The star and its corona: the flight never passes closer to the origin. */
  starClearance: 3.5,
  /** Handles as a share of the distance: how long the departure and arrival curves are. */
  handle: 0.4,
  /** Upward swing at mid-flight, as a share of the distance. */
  swing: 0.06,
  minDuration: 2.5,
  maxDuration: 5,
  /** Seconds per unit of distance, on top of the minimum. */
  pace: 0.05,
} as const;

/** The fixed half of a flight, decided at departure. */
export interface FlightStart {
  p0: V3;
  p1: V3;
  duration: number;
}

/** Flight time grows with the distance, within bounds. */
export function flightDuration(distance: number): number {
  return Math.min(FLIGHT.maxDuration, FLIGHT.minDuration + distance * FLIGHT.pace);
}

/** Leave from `from`, along `heading` (the current motion), towards `to`. */
export function startFlight(from: V3, heading: V3, to: V3): FlightStart {
  const distance = length(sub(to, from));
  const lift: V3 = [0, distance * FLIGHT.swing, 0];
  const p1 = add(add(from, scale(normalize(heading), distance * FLIGHT.handle)), lift);
  return { p0: from, p1, duration: flightDuration(distance) };
}

/** The moving half: arrive at `to` along `arrival` (the destination orbit's tangent). */
export function arrivalHandle(start: FlightStart, to: V3, arrival: V3): V3 {
  const distance = length(sub(to, start.p0));
  const lift: V3 = [0, distance * FLIGHT.swing, 0];
  return add(sub(to, scale(normalize(arrival), distance * FLIGHT.handle)), lift);
}

/**
 * Push both handles away from the star when the straight route passes too close: the
 * curve then swings around it instead of through it.
 */
export function aroundStar(p0: V3, p1: V3, p2: V3, p3: V3): [V3, V3] {
  const chord = sub(p3, p0);
  const t = Math.max(0, Math.min(1, -dot(p0, chord) / Math.max(dot(chord, chord), 1e-9)));
  const closest = add(p0, scale(chord, t));
  const miss = length(closest);
  const need = FLIGHT.starClearance * 2.2 - miss;
  if (need <= 0) return [p1, p2];
  // Away from the star, sideways to the route (up if the route goes right through it).
  const away = miss > 1e-3 ? normalize(closest) : normalize(upCross(chord));
  const push = scale(away, need * 1.6);
  return [add(p1, push), add(p2, push)];
}

/** Point on the cubic Bézier at t (0-1). */
export function bezier(p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 {
  const u = 1 - t;
  return add(
    add(scale(p0, u * u * u), scale(p1, 3 * u * u * t)),
    add(scale(p2, 3 * u * t * t), scale(p3, t * t * t)),
  );
}

/** Its derivative (the velocity direction) at t. */
export function bezierTangent(p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 {
  const u = 1 - t;
  return add(
    add(scale(sub(p1, p0), 3 * u * u), scale(sub(p2, p1), 6 * u * t)),
    scale(sub(p3, p2), 3 * t * t),
  );
}

/**
 * Where to join a circular orbit around `center` when arriving from `from`: the point
 * whose tangent (direction of increasing angle) points along the route, so the shuttle
 * slides into orbit instead of braking head-on. Returns the horizontal radial direction.
 */
export function orbitEntry(center: V3, from: V3): V3 {
  const incoming = normalize([from[0] - center[0], 0, from[2] - center[2]]);
  return upCross(incoming);
}

/** Ease in and out (sine): gentle start and braking. */
export const easeFlight = (t: number) =>
  0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
