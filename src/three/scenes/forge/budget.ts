import type { Backend } from '../../renderer';

/**
 * Simulated particles per backend. Measured at full heat, uncapped, on an AMD RDNA 3 GPU
 * (M3): WebGPU 65 536 sparks → 129 fps, 32 768 → 162 fps; WebGL 2 16 384 → 192 fps. SPEC §7
 * targets ~65 000 on a recent computer, but a mid-range GPU is 3-4× slower: 32 768 keeps
 * 60 fps there until the device quality levels (M8) raise it. The WebGL 2 fallback runs the
 * same simulation through transform feedback, with half the particles (SPEC §11).
 */
export const PARTICLE_BUDGET: Record<Backend, { sparks: number; swarm: number }> = {
  webgpu: { sparks: 32_768, swarm: 8192 },
  webgl2: { sparks: 16_384, swarm: 4096 },
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
