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
    /** Portal opening, 0 (closed) to 1 (fully open), from the centre of the hole. */
    portal: uniform(0),
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

/** Seconds for the portal to open fully once the journey reaches portalOpen. */
const PORTAL_OPENING_SECONDS = 2.2;

/** Opens the portal at a steady pace once portalOpen is reached (eased in the shader). */
export function advancePortal(uniforms: ForgeUniforms, phase: string, dt: number): void {
  const opening = phase === 'portalOpen' ? dt / PORTAL_OPENING_SECONDS : -dt;
  uniforms.portal.value = Math.min(1, Math.max(0, uniforms.portal.value + opening));
}

export function setPortal(uniforms: ForgeUniforms, open: number): void {
  uniforms.portal.value = open;
}
