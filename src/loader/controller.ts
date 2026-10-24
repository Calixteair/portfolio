import {
  createLoader,
  enter,
  fail,
  reach,
  tick,
  type LoaderPhase,
  type LoaderState,
  type Stage,
} from './progress';

/** Bridge between the 3D island and the static loader markup (Loader.astro). */
export interface LoaderController {
  reach: (stage: Stage) => void;
  fail: () => void;
  /** Called on every phase change (ready, entered, unsupported, timeout). */
  onPhase: (listener: (phase: LoaderPhase) => void) => void;
  dispose: () => void;
}

function readCssProgress(el: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(el).getPropertyValue('--p'));
  return Number.isFinite(value) ? value / 100 : 0;
}

function paint(el: HTMLElement, state: LoaderState): void {
  const percent = state.shown * 100;
  el.style.setProperty('--p', percent.toFixed(2));
  el.setAttribute('aria-valuenow', String(Math.round(percent)));
}

/**
 * Takes over from the CSS creep (reads the current `--p`), then animates the progress
 * every frame until the loader leaves the "loading" phase.
 */
export function createLoaderController(el: HTMLElement | null): LoaderController {
  if (!el) return { reach: () => {}, fail: () => {}, onPhase: () => {}, dispose: () => {} };
  const state = createLoader(readCssProgress(el));
  const button = el.querySelector<HTMLButtonElement>('#loader-enter');
  const listeners: ((phase: LoaderPhase) => void)[] = [];
  el.dataset.driven = '';
  let raf = 0;
  let last = performance.now();

  const setPhase = (phase: LoaderPhase) => {
    el.dataset.phase = phase;
    if (phase === 'ready' && button) {
      button.disabled = false;
      button.focus({ preventScroll: true });
    }
    for (const listener of listeners) listener(phase);
  };
  const frame = (now: number) => {
    const before = state.phase;
    tick(state, (now - last) / 1000, now);
    last = now;
    paint(el, state);
    if (state.phase !== before) setPhase(state.phase);
    if (state.phase === 'loading') raf = requestAnimationFrame(frame);
  };
  const onEnter = () => {
    enter(state);
    if (state.phase === 'entered') setPhase('entered');
  };

  raf = requestAnimationFrame(frame);
  button?.addEventListener('click', onEnter);
  return {
    reach: (stage) => reach(state, stage),
    fail: () => {
      fail(state);
      if (state.phase === 'unsupported') setPhase('unsupported');
    },
    onPhase: (listener) => listeners.push(listener),
    dispose: () => {
      cancelAnimationFrame(raf);
      button?.removeEventListener('click', onEnter);
    },
  };
}
