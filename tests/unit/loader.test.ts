import { describe, expect, it } from 'vitest';
import {
  LOADER,
  STAGES,
  createLoader,
  enter,
  fail,
  reach,
  tick,
  type LoaderState,
} from '../../src/loader/progress';

function run(state: LoaderState, seconds: number, startMs = 1000, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) tick(state, dt, startMs + i * dt * 1000);
}

describe('loader progress', () => {
  it('starts loading and takes over the CSS pre-hydration progress, capped', () => {
    expect(createLoader(0.2)).toEqual({ phase: 'loading', target: 0.2, shown: 0.2 });
    expect(createLoader(0.9).target).toBe(STAGES.hydrated);
  });

  it('follows milestones smoothly and never goes back', () => {
    const s = createLoader();
    reach(s, 'scene');
    let last = 0;
    for (let i = 0; i < 120; i++) {
      tick(s, 1 / 60, 1000);
      expect(s.shown).toBeGreaterThanOrEqual(last);
      expect(s.shown).toBeLessThanOrEqual(STAGES.scene);
      last = s.shown;
    }
    expect(s.shown).toBeCloseTo(STAGES.scene, 2);
    reach(s, 'hydrated');
    expect(s.target).toBe(STAGES.scene);
  });

  it('keeps the last 10 % for the shader compilation', () => {
    const s = createLoader();
    reach(s, 'assets');
    run(s, 5);
    expect(s.phase).toBe('loading');
    expect(s.shown).toBeLessThanOrEqual(0.9);
  });

  it('becomes ready once compiled and the bar has caught up', () => {
    const s = createLoader();
    reach(s, 'compiled');
    run(s, 0.1);
    expect(s.phase).toBe('loading');
    run(s, 3);
    expect(s.phase).toBe('ready');
    expect(s.shown).toBe(1);
  });

  it('skips the tracing on a warm cache', () => {
    const s = createLoader();
    reach(s, 'compiled');
    tick(s, 1 / 60, LOADER.warmCacheMs - 50);
    expect(s.phase).toBe('ready');
  });

  it('offers the classic version after the timeout, but keeps loading', () => {
    const s = createLoader();
    reach(s, 'scene');
    tick(s, 1 / 60, LOADER.timeoutMs + 1);
    expect(s.phase).toBe('timeout');
    reach(s, 'compiled');
    run(s, 3, LOADER.timeoutMs + 2);
    expect(s.phase).toBe('ready');
  });

  it('only enters from ready, and failure only applies while loading', () => {
    const s = createLoader();
    enter(s);
    expect(s.phase).toBe('loading');
    fail(s);
    expect(s.phase).toBe('unsupported');

    const ok = createLoader();
    reach(ok, 'compiled');
    run(ok, 3);
    enter(ok);
    expect(ok.phase).toBe('entered');
    fail(ok);
    expect(ok.phase).toBe('entered');
  });
});
