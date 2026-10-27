import { backendOf, type Backend } from './renderer';
import type { WebGPURenderer } from 'three/webgpu';

export type QualityTier = 'low' | 'medium' | 'high';

/**
 * What each quality tier allows (SPEC §7). Particle pools are sized once, at start: they
 * are GPU buffers, rebuilding them would stall. DPR and effects follow the live tier.
 * Sparks are born at an absolute rate (a few hundred per second): their pool only holds
 * the live ones, a bigger one would cost without adding a single visible spark. The swarm
 * is what density changes.
 */
export const QUALITY: Record<
  QualityTier,
  { dprMax: number; sparks: number; swarm: number; portalScale: number; dof: boolean }
> = {
  low: { dprMax: 1, sparks: 2048, swarm: 4096, portalScale: 0.35, dof: false },
  medium: { dprMax: 1.5, sparks: 4096, swarm: 8192, portalScale: 0.5, dof: false },
  high: { dprMax: 2, sparks: 4096, swarm: 16384, portalScale: 0.5, dof: true },
};

const ORDER: QualityTier[] = ['low', 'medium', 'high'];

/** What we know of the device before the first frame. */
export interface DeviceHints {
  backend: Backend;
  /** Touch first (phone, tablet): `(pointer: coarse)`. */
  coarsePointer: boolean;
  /** `navigator.hardwareConcurrency`, 0 when unknown. */
  cores: number;
}

/**
 * Starting tier, from cheap hints (no GPU benchmark database: detect-gpu fetches one from
 * a CDN, which the CSP forbids). PerformanceMonitor corrects it within seconds anyway.
 */
export function initialTier(hints: DeviceHints): QualityTier {
  if (hints.coarsePointer || (hints.cores > 0 && hints.cores <= 4)) return 'low';
  return hints.backend === 'webgpu' ? 'high' : 'medium';
}

export function readHints(backend: Backend): DeviceHints {
  return {
    backend,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    cores: navigator.hardwareConcurrency || 0,
  };
}

/** Highest tier allowed: touch devices stay at medium (battery and heat, even if smooth). */
export function ceilingTier(hints: DeviceHints): QualityTier {
  return hints.coarsePointer ? 'medium' : 'high';
}

/** One tier down (the frame rate dropped) or up (it is comfortably above target). */
export function shiftTier(
  tier: QualityTier,
  by: -1 | 1,
  ceiling: QualityTier = 'high',
): QualityTier {
  const top = ORDER.indexOf(ceiling);
  const i = Math.min(top, Math.max(0, ORDER.indexOf(tier) + by));
  return ORDER[i] as QualityTier;
}

/**
 * Device pixel ratio for a monitor factor (0-1, from PerformanceMonitor): from 1 up to the
 * tier's cap and the screen's own ratio, in steps of 0.25 (no resize on every wobble).
 */
export function dprFor(tier: QualityTier, factor: number, screen: number): number {
  const cap = Math.min(QUALITY[tier].dprMax, Math.max(1, screen));
  const raw = 1 + (cap - 1) * Math.min(1, Math.max(0, factor));
  return Math.round(raw * 4) / 4;
}

/** The tier this visitor starts with (the particle pools are sized for it), and the cap. */
export function startTier(renderer: WebGPURenderer): { tier: QualityTier; ceiling: QualityTier } {
  const hints = readHints(backendOf(renderer));
  return { tier: initialTier(hints), ceiling: ceilingTier(hints) };
}

/** The live tier, shared by reference: PerformanceMonitor moves it, effects read it. */
export interface LiveQuality {
  tier: QualityTier;
  ceiling: QualityTier;
}

export function createLiveQuality(): LiveQuality {
  return { tier: 'medium', ceiling: 'high' };
}

export function setTier(live: LiveQuality, tier: QualityTier, ceiling = live.ceiling): void {
  live.tier = tier;
  live.ceiling = ceiling;
}
