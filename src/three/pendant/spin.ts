/**
 * Rotation of the pendant around its vertical axis: angular velocity with exponential
 * damping (inertia), driven by drags and click impulses. Pure state, no rendering.
 */

export const SPIN = {
  /** Velocity decay rate (1/s): v *= exp(-damping * dt). */
  damping: 1.3,
  /** Radians per dragged pixel. */
  dragSensitivity: 0.008,
  /** Angular velocity added by a click (rad/s). */
  impulse: 5.5,
  /** Cap, so a fast flick or a stalled event stream cannot fling the pendant. */
  maxSpeed: 14,
  /** Shortest interval used to turn a drag into a velocity (s). */
  minDt: 0.008,
  /** Pointer travel (px) below which a press counts as a click, not a drag. */
  clickSlop: 6,
} as const;

export interface SpinState {
  angle: number;
  velocity: number;
  /** Cumulated full turns, in either direction (the portal needs N of them, SPEC §2). */
  turns: number;
}

const clampSpeed = (v: number) => Math.max(-SPIN.maxSpeed, Math.min(SPIN.maxSpeed, v));

export function createSpin(angle = 0.35): SpinState {
  return { angle, velocity: 0, turns: 0 };
}

function rotate(state: SpinState, delta: number): void {
  state.angle += delta;
  state.turns += Math.abs(delta) / (Math.PI * 2);
}

/** Advance by dt seconds. */
export function stepSpin(state: SpinState, dt: number): void {
  rotate(state, state.velocity * dt);
  state.velocity *= Math.exp(-SPIN.damping * dt);
}

/** The pendant follows the pointer; the release speed becomes its inertia. */
export function dragSpin(state: SpinState, dxPixels: number, dtSeconds: number): void {
  const delta = dxPixels * SPIN.dragSensitivity;
  rotate(state, delta);
  state.velocity = clampSpeed(delta / Math.max(dtSeconds, SPIN.minDt));
}

/** A click pushes the pendant further in the direction it already turns. */
export function impulseSpin(state: SpinState): void {
  const direction = state.velocity >= 0 ? 1 : -1;
  state.velocity = clampSpeed(state.velocity + SPIN.impulse * direction);
}

/** Resting three-quarter view of the pendant (it starts face-on under the loader). */
export const REST_ANGLE = 0.35;

/** Coast to `target` and stop there: the velocity damping alone carries it (v / damping). */
export function settleSpin(state: SpinState, target: number): void {
  state.velocity = clampSpeed((target - state.angle) * SPIN.damping);
}

/** Small idle "breathing" tilt; none with prefers-reduced-motion. */
export function breathingTilt(time: number, reducedMotion: boolean): number {
  return 0.06 + (reducedMotion ? 0 : Math.sin(time * 0.6) * 0.03);
}
