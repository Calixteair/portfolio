import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindDragSpin, bindSpaceStrike } from '../../src/three/pendant/dragSpin';
import { SPIN, createSpin } from '../../src/three/pendant/spin';

/** Minimal stand-in for the canvas: an event target that accepts pointer capture. */
class FakeCanvas extends EventTarget {
  setPointerCapture() {}
}

function pointer(type: string, clientX: number, timeStamp: number): Event {
  const event = Object.assign(new Event(type), { clientX, pointerId: 1 });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp }); // read-only on Event
  return event;
}

describe('bindDragSpin', () => {
  it('keeps the spin going during a long, still press (a click, not a drag)', () => {
    const canvas = new FakeCanvas();
    const spin = { ...createSpin(0), velocity: 5 };
    const drag = bindDragSpin(canvas as unknown as HTMLElement, spin);
    canvas.dispatchEvent(pointer('pointerdown', 100, 0));
    canvas.dispatchEvent(pointer('pointermove', 100 + SPIN.clickSlop, 400));
    expect(drag.isDragging()).toBe(false);
    canvas.dispatchEvent(pointer('pointerup', 100 + SPIN.clickSlop, 2000));
    expect(spin.velocity).toBe(5);
    expect(spin.angle).toBe(0);
  });

  it('turns into a drag past the click slop', () => {
    const canvas = new FakeCanvas();
    const spin = createSpin(0);
    const drag = bindDragSpin(canvas as unknown as HTMLElement, spin);
    canvas.dispatchEvent(pointer('pointerdown', 100, 0));
    canvas.dispatchEvent(pointer('pointermove', 140, 20));
    expect(drag.isDragging()).toBe(true);
    expect(spin.angle).toBeGreaterThan(0);
    drag.dispose();
  });
});

describe('bindSpaceStrike', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('strikes once per Space press, ignoring key repeat and other keys', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const strike = vi.fn();
    const unbind = bindSpaceStrike(strike);
    const key = (code: string, repeat = false) =>
      target.dispatchEvent(
        Object.assign(new Event('keydown', { cancelable: true }), { code, repeat }),
      );
    key('Space');
    key('Space', true);
    key('KeyA');
    expect(strike).toHaveBeenCalledTimes(1);
    unbind();
    key('Space');
    expect(strike).toHaveBeenCalledTimes(1);
  });
});
