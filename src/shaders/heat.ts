import { clamp, max, mix, pow, positionLocal, smoothstep, time, vec2, vec3 } from 'three/tsl';
import type { Node, UniformNode } from 'three/webgpu';
import { blackbody } from './blackbody';
import { fbm01 } from './noise';

/** What the plate's heat shader reads (fed each frame by the journey). */
export interface PlateHeat {
  heat: UniformNode<'float', number>;
  heatHistory: UniformNode<'float', number>;
  /** Weight of the hole edge (main source) and of the outer edge (secondary, SPEC §5.3). */
  holeWeight: UniformNode<'float', number>;
  outerWeight: UniformNode<'float', number>;
}

/**
 * How hot a point of the plate is (0-1) for a given forge heat: the heat spreads from the
 * hole edge (and, weaker, from the outer edge) towards the inside of the plate, with a
 * flickering noisy front. Edge distances are the raw 0-1 values of the baked edge mask.
 */
export function heatField(
  holeEdge: Node<'float'>,
  outerEdge: Node<'float'>,
  level: Node<'float'>,
  heat: PlateHeat,
): Node<'float'> {
  const drift = vec2(time.mul(0.6), time.mul(-0.4));
  const flicker = fbm01(positionLocal.xy.mul(38).add(drift)).sub(0.5).mul(0.25).mul(level);
  const fromHole = clamp(level.mul(heat.holeWeight).sub(holeEdge.mul(2.6)).add(flicker), 0, 1);
  const fromOuter = clamp(level.mul(heat.outerWeight).sub(outerEdge.mul(3.2)).add(flicker), 0, 1);
  return max(fromHole, fromOuter);
}

/** Incandescence: black-body colour, squared so only the hottest parts trigger the bloom. */
export function incandescence(field: Node<'float'>): Node<'vec3'> {
  return blackbody(field).mul(pow(field, 2)).mul(2.2);
}

/**
 * Tempering colours left on steel that got hot: straw, then bronze, then blue (SPEC §5.3).
 * Returns a multiplier for the steel colour.
 */
export function temperTint(past: Node<'float'>): Node<'vec3'> {
  const straw = vec3(1, 0.8, 0.48);
  const bronze = vec3(0.72, 0.4, 0.2);
  const blue = vec3(0.28, 0.38, 0.78);
  const ramp = mix(
    mix(straw, bronze, past.mul(2).clamp(0, 1)),
    blue,
    past.mul(2).sub(1).clamp(0, 1),
  );
  return mix(vec3(1), ramp, smoothstep(0.02, 0.2, past).mul(0.75));
}
