/**
 * Loader state (SPEC §4), pure: no DOM, no rendering. The full journey state machine
 * (SPEC §2) arrives in M3 and starts where this one ends ("entered").
 */

export type LoaderPhase = 'loading' | 'ready' | 'entered' | 'unsupported' | 'timeout';

export const LOADER = {
  /** Loaded this fast (cache warm): skip the tracing and go straight to "Entrer". */
  warmCacheMs: 300,
  /** Still loading after this: offer the classic version instead. */
  timeoutMs: 10_000,
  /** Exponential smoothing rate of the displayed progress (1/s). */
  smoothing: 5,
} as const;

/**
 * Real milestones and the progress they unlock (0-1). The last 10 % is reserved for the
 * shader precompilation (SPEC §4). Before the island runs, CSS creeps towards `hydrated`.
 */
export const STAGES = {
  hydrated: 0.35,
  renderer: 0.55,
  scene: 0.75,
  assets: 0.9,
  compiled: 1,
} as const;

export type Stage = keyof typeof STAGES;

export interface LoaderState {
  phase: LoaderPhase;
  /** Progress unlocked by the milestones reached so far. */
  target: number;
  /** Displayed progress: follows the target smoothly, never goes back. */
  shown: number;
}

export function createLoader(shown = 0): LoaderState {
  return { phase: 'loading', target: Math.max(0, Math.min(shown, STAGES.hydrated)), shown };
}

export function reach(state: LoaderState, stage: Stage): void {
  if (state.phase !== 'loading') return;
  state.target = Math.max(state.target, STAGES[stage]);
}

/**
 * Advance the displayed progress by dt seconds. `elapsedMs` is the time since navigation
 * start: a warm load jumps straight to ready, a slow one times out.
 */
export function tick(state: LoaderState, dt: number, elapsedMs: number): void {
  if (state.phase !== 'loading') return;
  if (state.target >= 1 && elapsedMs < LOADER.warmCacheMs) state.shown = 1;
  const step = (state.target - state.shown) * (1 - Math.exp(-LOADER.smoothing * dt));
  state.shown = Math.min(state.target, state.shown + Math.max(0, step));
  if (state.target >= 1 && state.target - state.shown < 0.002) {
    state.shown = 1;
    state.phase = 'ready';
  } else if (elapsedMs > LOADER.timeoutMs) {
    state.phase = 'timeout';
  }
}

/** No WebGPU nor WebGL 2, or the renderer failed to start. */
export function fail(state: LoaderState): void {
  if (state.phase === 'loading') state.phase = 'unsupported';
}

/** The visitor pressed "Entrer". */
export function enter(state: LoaderState): void {
  if (state.phase === 'ready') state.phase = 'entered';
}
