import { uniform } from 'three/tsl';

/** Shared forge state seen by the shaders, fed each frame by the journey (ForgeDirector). */
export function createForgeUniforms() {
  return {
    /** 0-1, current heat of the pendant. */
    heat: uniform(0),
    /** Highest heat reached so far: tempering tints (SPEC §5.3). */
    heatHistory: uniform(0),
  };
}

export type ForgeUniforms = ReturnType<typeof createForgeUniforms>;

export function applyHeat(uniforms: ForgeUniforms, heat: number, heatHistory: number): void {
  uniforms.heat.value = heat;
  uniforms.heatHistory.value = heatHistory;
}

/** Point light intensity of the pendant's glow on its surroundings for a given heat. */
export function glowIntensity(heat: number): number {
  return 0.3 + heat ** 1.5 * 30;
}
