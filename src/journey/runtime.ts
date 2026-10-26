import { createSpin, type SpinState } from '../three/pendant/spin';
import {
  DEFAULT_RULES,
  createJourney,
  stepJourney,
  type JourneyRules,
  type JourneyState,
} from './machine';

/** Everything the forge interaction mutates frame after frame (no React state: SPEC rules). */
export interface ForgeRuntime {
  journey: JourneyState;
  spin: SpinState;
  /** Mutable copy: tunable in the dev panel. */
  rules: JourneyRules;
  /** Dev panel overrides: heat seen by the shaders, and portal opening scrubbed by hand. */
  manual: { enabled: boolean; heat: number; scrubPortal: boolean; portal: number };
}

export function createForgeRuntime(): ForgeRuntime {
  return {
    journey: createJourney(),
    // Face-on under the loader, to match its outline (SPEC §4 handoff).
    spin: createSpin(0),
    rules: { ...DEFAULT_RULES },
    manual: { enabled: false, heat: 0, scrubPortal: false, portal: 0 },
  };
}

/** One frame of the journey; returns the heat and heat history the shaders should show. */
export function advanceJourney(runtime: ForgeRuntime, dt: number) {
  const { journey, spin, rules, manual } = runtime;
  stepJourney(journey, dt, spin.turns, rules);
  const heat = manual.enabled ? manual.heat : journey.heat;
  return { heat, heatHistory: Math.max(journey.heatHistory, heat), phase: journey.phase };
}
