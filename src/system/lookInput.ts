import { dragLook, type LookState } from './look';

/** Pointer travel (px) below which a press is a click (pick a body), not a drag. */
export const CLICK_SLOP = 6;

/** Held arrow keys as -1, 0 or 1 on each axis. */
export interface LookKeys {
  yaw: number;
  pitch: number;
}

const ARROWS: Record<string, [keyof LookKeys, number]> = {
  ArrowLeft: ['yaw', 1],
  ArrowRight: ['yaw', -1],
  ArrowUp: ['pitch', 1],
  ArrowDown: ['pitch', -1],
};

/**
 * Drag anywhere to look around (with inertia), arrow keys to turn. A press that does not
 * move stays a click. Returns the held keys (read each frame) and the cleanup.
 */
export function bindLook(element: HTMLElement, look: LookState) {
  const keys: LookKeys = { yaw: 0, pitch: 0 };
  let press: {
    x: number;
    y: number;
    t: number;
    startX: number;
    startY: number;
    moving: boolean;
  } | null = null;

  const down = (e: PointerEvent) => {
    press = {
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      startX: e.clientX,
      startY: e.clientY,
      moving: false,
    };
    element.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!press) return;
    const travel = Math.hypot(e.clientX - press.startX, e.clientY - press.startY);
    if (!press.moving && travel <= CLICK_SLOP) return;
    press.moving = true;
    dragLook(look, e.clientX - press.x, e.clientY - press.y, (e.timeStamp - press.t) / 1000);
    Object.assign(press, { x: e.clientX, y: e.clientY, t: e.timeStamp });
  };
  const up = () => {
    press = null;
  };
  const key = (pressed: boolean) => (e: KeyboardEvent) => {
    const arrow = ARROWS[e.key];
    if (!arrow) return;
    e.preventDefault();
    keys[arrow[0]] = pressed ? arrow[1] : 0;
  };
  const keydown = key(true);
  const keyup = key(false);

  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', up);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  const dispose = () => {
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', up);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
  };
  return { keys, isDragging: () => press?.moving === true, dispose };
}
