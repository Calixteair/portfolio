import type { Backend } from '../../renderer';

/**
 * Simulated particles per backend. Sparks are born at an absolute rate (SPARK_RATE, a few
 * hundred per second at full heat) and live under 2 s: the pool only needs room for the
 * live ones. The swarm is denser. The WebGL 2 fallback gets half (SPEC §11). For scale, on
 * an AMD RDNA 3 GPU, 65 536 sparks still ran at 129 fps uncapped: plenty of headroom for
 * the M8 quality levels.
 */
export const PARTICLE_BUDGET: Record<Backend, { sparks: number; swarm: number }> = {
  webgpu: { sparks: 4096, swarm: 8192 },
  webgl2: { sparks: 2048, swarm: 4096 },
};

/** Dev only: `?sparks=N&swarm=N` to measure other budgets. */
export function particleBudget(backend: Backend, search = window.location.search) {
  const budget = { ...PARTICLE_BUDGET[backend] };
  if (!import.meta.env.DEV) return budget;
  const params = new URLSearchParams(search);
  for (const key of ['sparks', 'swarm'] as const) {
    const value = Number(params.get(key));
    if (Number.isInteger(value) && value > 0) budget[key] = value;
  }
  return budget;
}
