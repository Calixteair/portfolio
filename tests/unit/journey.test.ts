import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  arrive,
  createJourney,
  enterPortal,
  skipIntro,
  stepJourney,
  strike,
  type JourneyState,
} from '../../src/journey/machine';

const DT = 1 / 60;

function run(state: JourneyState, seconds: number, turns: number) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepJourney(state, DT, turns);
}

function strikes(state: JourneyState, n: number) {
  for (let i = 0; i < n; i++) strike(state);
}

describe('journey state machine', () => {
  it('starts cold and idle', () => {
    expect(createJourney()).toEqual({ phase: 'idle', heat: 0, heatHistory: 0, overheatTime: 0 });
  });

  it('heats on strikes, up to 1, and enters heating', () => {
    const s = createJourney();
    strike(s);
    expect(s.heat).toBeCloseTo(DEFAULT_RULES.heatPerStrike);
    stepJourney(s, DT, 0);
    expect(s.phase).toBe('heating');
    strikes(s, 20);
    expect(s.heat).toBe(1);
  });

  it('cools back to idle when the visitor stops, but keeps the heat history', () => {
    const s = createJourney();
    strikes(s, 5);
    const peak = s.heat;
    run(s, 10, 0);
    expect(s.heat).toBe(0);
    expect(s.phase).toBe('idle');
    expect(s.heatHistory).toBeCloseTo(peak);
  });

  it('needs the turns as well as the heat to overheat', () => {
    const s = createJourney();
    strikes(s, 10);
    run(s, 0.1, 1);
    expect(s.phase).toBe('heating');
    run(s, 0.1, DEFAULT_RULES.turnsNeeded);
    expect(s.phase).toBe('overheated');
  });

  it('opens the portal after sustained overheat, and it stays open', () => {
    const s = createJourney();
    for (let t = 0; t < 3 && s.phase !== 'portalOpen'; t += 0.25) {
      strikes(s, 2);
      run(s, 0.25, 3);
    }
    expect(s.phase).toBe('portalOpen');
    run(s, 10, 3);
    expect(s.phase).toBe('portalOpen');
    expect(s.heat).toBe(1);
    strike(s);
    expect(s.heat).toBe(1);
  });

  it('resets the overheat timer when it cools below the threshold', () => {
    const s = createJourney();
    strikes(s, 8); // 0.88, just above the 0.85 threshold
    run(s, 0.2, 3);
    expect(s.phase).toBe('overheated');
    run(s, 0.5, 3); // cools to ~0.83
    expect(s.overheatTime).toBe(0);
    expect(s.phase).toBe('heating');
  });

  it('dives through the open portal, then arrives in the portfolio', () => {
    const s = createJourney();
    expect(enterPortal(s)).toBe(false);
    s.phase = 'portalOpen';
    arrive(s);
    expect(s.phase).toBe('portalOpen');
    expect(enterPortal(s)).toBe(true);
    expect(s.phase).toBe('wormhole');
    expect(enterPortal(s)).toBe(false);
    run(s, 2, 3);
    strike(s);
    expect(s.phase).toBe('wormhole');
    arrive(s);
    expect(s.phase).toBe('portfolio');
  });

  it('skips the intro from the forge, once', () => {
    const s = createJourney();
    strike(s);
    expect(skipIntro(s)).toBe(true);
    expect(s.phase).toBe('wormhole');
    arrive(s);
    expect(s.phase).toBe('portfolio');
    expect(skipIntro(s)).toBe(false);
  });
});
