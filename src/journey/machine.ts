/**
 * Journey state machine (SPEC §2), pure: no DOM, no rendering, unit tested. It takes
 * over from the loader once the visitor has pressed "Entrer".
 */

export type JourneyPhase =
  'idle' | 'heating' | 'overheated' | 'portalOpen' | 'wormhole' | 'portfolio';

/** Phases where the forge no longer reacts: the portal is open or already crossed. */
const BEYOND_FORGE: ReadonlySet<JourneyPhase> = new Set(['portalOpen', 'wormhole', 'portfolio']);

/** Thresholds from the prototype, tunable in the dev panel. */
export interface JourneyRules {
  heatPerStrike: number;
  coolPerSecond: number;
  /** Heat needed to overheat (with enough turns). */
  threshold: number;
  /** Full turns of the pendant needed before it can overheat (SPEC §10: N, to tune). */
  turnsNeeded: number;
  /** Seconds of sustained overheat before the portal opens. */
  overheatSeconds: number;
}

export const DEFAULT_RULES: Readonly<JourneyRules> = {
  heatPerStrike: 0.11,
  coolPerSecond: 0.07,
  threshold: 0.85,
  turnsNeeded: 2,
  overheatSeconds: 1.5,
};

export interface JourneyState {
  phase: JourneyPhase;
  /** 0-1, rises with each strike, cools over time. */
  heat: number;
  /** Highest heat reached: tempering tints persist where the steel got hot (SPEC §5.3). */
  heatHistory: number;
  /** Seconds spent overheated in a row. */
  overheatTime: number;
}

export function createJourney(): JourneyState {
  return { phase: 'idle', heat: 0, heatHistory: 0, overheatTime: 0 };
}

/** A click on the pendant. Once the portal is open, heat no longer matters. */
export function strike(state: JourneyState, rules: JourneyRules = DEFAULT_RULES): void {
  if (BEYOND_FORGE.has(state.phase)) return;
  state.heat = Math.min(1, state.heat + rules.heatPerStrike);
  state.heatHistory = Math.max(state.heatHistory, state.heat);
}

function nextPhase(state: JourneyState, hot: boolean, rules: JourneyRules): JourneyPhase {
  if (state.overheatTime >= rules.overheatSeconds) return 'portalOpen';
  if (hot) return 'overheated';
  return state.heat > 0.01 ? 'heating' : 'idle';
}

/**
 * Advance by dt seconds. `turns` is the pendant's cumulated full turns (spin model):
 * overheating needs both the heat and the turns. The portal, once open, stays open.
 */
export function stepJourney(
  state: JourneyState,
  dt: number,
  turns: number,
  rules: JourneyRules = DEFAULT_RULES,
): void {
  if (BEYOND_FORGE.has(state.phase)) {
    state.heat = 1;
    return;
  }
  state.heat = Math.max(0, state.heat - rules.coolPerSecond * dt);
  const hot = state.heat >= rules.threshold && turns >= rules.turnsNeeded;
  state.overheatTime = hot ? state.overheatTime + dt : 0;
  state.phase = nextPhase(state, hot, rules);
}

/** A click (or Enter/Space) on the fully open portal: the wormhole dive starts (SPEC §5.6). */
export function enterPortal(state: JourneyState): boolean {
  if (state.phase !== 'portalOpen') return false;
  state.phase = 'wormhole';
  return true;
}

/** End of the dive: the visitor is in the planetary system (SPEC §5.7). */
export function arrive(state: JourneyState): void {
  if (state.phase === 'wormhole') state.phase = 'portfolio';
}
