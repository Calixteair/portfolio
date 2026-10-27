import { QUALITY, type QualityTier } from '../../quality';

/**
 * Simulated particles for a quality tier (SPEC §7, see QUALITY). Dev only:
 * `?sparks=N&swarm=N` to measure other budgets.
 */
export function particleBudget(tier: QualityTier, search = window.location.search) {
  const { sparks, swarm } = QUALITY[tier];
  const budget = { sparks, swarm };
  if (!import.meta.env.DEV) return budget;
  const params = new URLSearchParams(search);
  for (const key of ['sparks', 'swarm'] as const) {
    const value = Number(params.get(key));
    if (Number.isInteger(value) && value > 0) budget[key] = value;
  }
  return budget;
}
