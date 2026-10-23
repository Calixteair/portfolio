import { uniform } from 'three/tsl';

/**
 * Shared forge state seen by the shaders. `heat` is driven by leva until the state
 * machine takes over in M3.
 */
export function createForgeUniforms() {
  return { heat: uniform(0) };
}

export type ForgeUniforms = ReturnType<typeof createForgeUniforms>;

/** Point light intensity of the pendant's glow on its surroundings for a given heat. */
export function glowIntensity(heat: number): number {
  return 0.3 + heat ** 1.5 * 30;
}
