/**
 * 360° look from the arrival point (SPEC §5.7): rotation only, with inertia, no zoom nor
 * lateral move. Pure state: yaw and pitch offsets from the initial view of the star.
 */

export const LOOK = {
  /** Radians per dragged pixel. */
  sensitivity: 0.004,
  damping: 4,
  maxSpeed: 4,
  /** Pitch stays within ±70°: no flipping over the poles. */
  maxPitch: (70 * Math.PI) / 180,
  /** Keyboard: angular speed while an arrow key is held (rad/s). */
  keySpeed: 1.2,
} as const;

export interface LookState {
  yaw: number;
  pitch: number;
  yawSpeed: number;
  pitchSpeed: number;
}

export function createLook(): LookState {
  return { yaw: 0, pitch: 0, yawSpeed: 0, pitchSpeed: 0 };
}

const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

function turn(state: LookState, dYaw: number, dPitch: number): void {
  state.yaw += dYaw;
  state.pitch = clamp(state.pitch + dPitch, LOOK.maxPitch);
}

/** Dragging the view: it follows the pointer, the release speed becomes inertia. */
export function dragLook(state: LookState, dx: number, dy: number, dtSeconds: number): void {
  const dYaw = -dx * LOOK.sensitivity;
  const dPitch = -dy * LOOK.sensitivity;
  turn(state, dYaw, dPitch);
  const dt = Math.max(dtSeconds, 0.008);
  state.yawSpeed = clamp(dYaw / dt, LOOK.maxSpeed);
  state.pitchSpeed = clamp(dPitch / dt, LOOK.maxSpeed);
}

/** Advance by dt seconds: coast, damped. `keys` adds held arrow keys (-1, 0 or 1 each). */
export function stepLook(state: LookState, dt: number, keys = { yaw: 0, pitch: 0 }): void {
  if (keys.yaw || keys.pitch) {
    state.yawSpeed = keys.yaw * LOOK.keySpeed;
    state.pitchSpeed = keys.pitch * LOOK.keySpeed;
  }
  turn(state, state.yawSpeed * dt, state.pitchSpeed * dt);
  const decay = Math.exp(-LOOK.damping * dt);
  state.yawSpeed *= decay;
  state.pitchSpeed *= decay;
}

/** Unit view direction from a base yaw/pitch (looking at the star) plus the offsets. */
export function viewDirection(
  state: LookState,
  base: { yaw: number; pitch: number },
): [number, number, number] {
  const yaw = base.yaw + state.yaw;
  const pitch = clamp(base.pitch + state.pitch, LOOK.maxPitch);
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}
