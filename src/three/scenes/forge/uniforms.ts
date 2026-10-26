import { uniform } from 'three/tsl';

/** Shared forge state seen by the shaders, fed each frame by the journey (ForgeDirector). */
export function createForgeUniforms() {
  return {
    /** 0-1, current heat of the pendant. */
    heat: uniform(0),
    /** Highest heat reached so far: tempering tints (SPEC §5.3). */
    heatHistory: uniform(0),
    /** Heat sources: the hole edge, and the outer edge at ~0.6 (SPEC §5.3), tunable. */
    holeWeight: uniform(1),
    outerWeight: uniform(0.6),
    /** Protomolecule swarm level: 0, then rising with overheat and the open portal. */
    swarm: uniform(0),
  };
}

export type ForgeUniforms = ReturnType<typeof createForgeUniforms>;

export function applyHeat(uniforms: ForgeUniforms, heat: number, heatHistory: number): void {
  uniforms.heat.value = heat;
  uniforms.heatHistory.value = heatHistory;
}

/** Swarm level by phase (SPEC §5.4): none before overheat, more once the portal opens. */
const SWARM_LEVEL: Record<string, number> = { overheated: 0.35, portalOpen: 1 };

/** Eases the swarm level towards its target for the phase (~1.5 s time constant). */
export function easeSwarm(uniforms: ForgeUniforms, phase: string, dt: number): void {
  const target = SWARM_LEVEL[phase] ?? 0;
  uniforms.swarm.value += (target - uniforms.swarm.value) * (1 - Math.exp(-dt / 1.5));
}

/** Point light intensity of the pendant's glow on its surroundings for a given heat. */
export function glowIntensity(heat: number): number {
  return 0.3 + heat ** 1.5 * 30;
}
