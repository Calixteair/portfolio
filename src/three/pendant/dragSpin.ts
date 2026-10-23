import { dragSpin, type SpinState } from './spin';

/** Held still this long before release: no fling, the pendant just stays where it was let go. */
const RELEASE_STILL_MS = 100;

export interface DragController {
  isDragging: () => boolean;
  dispose: () => void;
}

/**
 * Horizontal drags anywhere on the canvas turn the pendant; the release speed becomes its
 * inertia. Clicks are handled separately (raycast on the pendant).
 */
export function bindDragSpin(element: HTMLElement, spin: SpinState): DragController {
  let last: { x: number; t: number } | null = null;

  const down = (e: PointerEvent) => {
    last = { x: e.clientX, t: e.timeStamp };
    element.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!last) return;
    dragSpin(spin, e.clientX - last.x, (e.timeStamp - last.t) / 1000);
    last = { x: e.clientX, t: e.timeStamp };
  };
  const up = (e: PointerEvent) => {
    if (last && e.timeStamp - last.t > RELEASE_STILL_MS) spin.velocity = 0;
    last = null;
  };

  const events: [string, (e: PointerEvent) => void][] = [
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', up],
    ['pointercancel', up],
  ];
  for (const [name, handler] of events) element.addEventListener(name, handler as EventListener);
  return {
    isDragging: () => last !== null,
    dispose: () => {
      for (const [name, handler] of events)
        element.removeEventListener(name, handler as EventListener);
    },
  };
}
