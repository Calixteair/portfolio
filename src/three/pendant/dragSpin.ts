import { SPIN, dragSpin, type SpinState } from './spin';

/** Held still this long before release: no fling, the pendant just stays where it was let go. */
const RELEASE_STILL_MS = 100;

export interface DragController {
  isDragging: () => boolean;
  dispose: () => void;
}

interface Press {
  startX: number;
  x: number;
  t: number;
  /** Becomes a drag only past the click slop: a press, even a long one, stays a click. */
  dragging: boolean;
}

/**
 * Horizontal drags anywhere on the canvas turn the pendant; the release speed becomes its
 * inertia. A press that does not move is a click (handled by the raycast on the pendant):
 * it never stops the spin, however long it is held.
 */
export function bindDragSpin(element: HTMLElement, spin: SpinState): DragController {
  let press: Press | null = null;

  const down = (e: PointerEvent) => {
    press = { startX: e.clientX, x: e.clientX, t: e.timeStamp, dragging: false };
    element.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!press) return;
    if (!press.dragging && Math.abs(e.clientX - press.startX) <= SPIN.clickSlop) return;
    press.dragging = true;
    dragSpin(spin, e.clientX - press.x, (e.timeStamp - press.t) / 1000);
    press.x = e.clientX;
    press.t = e.timeStamp;
  };
  const up = (e: PointerEvent) => {
    if (press?.dragging && e.timeStamp - press.t > RELEASE_STILL_MS) spin.velocity = 0;
    press = null;
  };

  const events: [string, (e: PointerEvent) => void][] = [
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', up],
    ['pointercancel', up],
  ];
  for (const [name, handler] of events) element.addEventListener(name, handler as EventListener);
  return {
    isDragging: () => press?.dragging === true,
    dispose: () => {
      for (const [name, handler] of events)
        element.removeEventListener(name, handler as EventListener);
    },
  };
}

/** Typing in a field (e.g. the dev panel) must not strike the pendant. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as Partial<HTMLElement> | null;
  return (
    !!el &&
    (el.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName ?? ''))
  );
}

/** Space acts as a click on the pendant: one strike per press (key repeat ignored). */
export function bindSpaceStrike(strike: () => void): () => void {
  const keydown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || isTyping(e.target)) return;
    e.preventDefault(); // no page scroll
    if (!e.repeat) strike();
  };
  window.addEventListener('keydown', keydown);
  return () => window.removeEventListener('keydown', keydown);
}
