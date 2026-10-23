import {
  abs,
  color,
  exp,
  float,
  fract,
  length,
  positionWorld,
  pow,
  smoothstep,
  vec2,
} from 'three/tsl';
import { MeshStandardNodeMaterial, type Node, type UniformNode } from 'three/webgpu';
import { blackbody } from './blackbody';
import { fbm01 } from './noise';

export interface RockOptions {
  color: number;
  /** Horizontal pour lines of cast concrete (near rocks only). */
  bands: boolean;
  /** How much the cracks glow with the forge heat (near layers glow most). */
  glow: number;
}

/** Thin cracks glowing faint orange with the heat (SPEC §5.1), fading away from the forge. */
function crackGlow(heat: UniformNode<'float', number>, strength: number): Node<'vec3'> {
  const wp = positionWorld;
  const field = fbm01(wp.xz.mul(1.4).add(vec2(wp.y.mul(1.1))));
  const crack = float(1).sub(smoothstep(0, 0.008, abs(field.sub(0.5))));
  const falloff = exp(length(wp.xz).mul(-0.14));
  // The ramp stays below yellow-white even at full heat.
  return blackbody(heat.mul(0.25).add(0.3))
    .mul(crack)
    .mul(pow(heat, 1.8))
    .mul(falloff)
    .mul(strength * 0.6);
}

/** Cast concrete / cut rock: flat-shaded facets, fBm tone variation, optional pour lines. */
export function createRockMaterial(
  heat: UniformNode<'float', number>,
  options: RockOptions,
): MeshStandardNodeMaterial {
  const wp = positionWorld;
  let tone = color(options.color).mul(
    fbm01(wp.xz.mul(1.7).add(wp.y.mul(3)))
      .mul(0.7)
      .add(0.55),
  );
  if (options.bands)
    tone = tone.mul(float(1).sub(smoothstep(0.46, 0.5, fract(wp.y.mul(5))).mul(0.3)));
  const material = new MeshStandardNodeMaterial({
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });
  material.colorNode = tone;
  // Distant layers never glow: no crack fBm in their shader at all.
  if (options.glow > 0) material.emissiveNode = crackGlow(heat, options.glow);
  return material;
}
