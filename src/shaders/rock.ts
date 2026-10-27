import {
  abs,
  color,
  cross,
  dFdx,
  dFdy,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  normalize,
  positionWorld,
  pow,
  sin,
  smoothstep,
  step,
  vec2,
  vec3,
} from 'three/tsl';
import { MeshStandardNodeMaterial, type Node, type UniformNode } from 'three/webgpu';
import { blackbody } from './blackbody';
import { fbm01, hash21 } from './noise';

export interface RockOptions {
  color: number;
  /** Fine grain and speckles (near layers only: far away they would only shimmer). */
  grain: boolean;
  /** How much the cracks glow with the forge heat (near layers glow most). */
  glow: number;
}

/** Thin cracks glowing faint orange with the heat (SPEC §5.1), fading away from the forge. */
function crackGlow(heat: UniformNode<'float', number>, strength: number): Node<'vec3'> {
  const wp = positionWorld;
  // Fine, dense cracks (thin seams in the rock, not scribbles across it).
  const field = fbm01(wp.xz.mul(3).add(vec2(wp.y.mul(2.4))));
  const crack = float(1).sub(smoothstep(0, 0.006, abs(field.sub(0.5))));
  const falloff = exp(length(wp.xz).mul(-0.14));
  // The ramp stays below yellow-white even at full heat.
  return blackbody(heat.mul(0.25).add(0.3))
    .mul(crack)
    .mul(pow(heat, 1.8))
    .mul(falloff)
    .mul(strength * 0.6);
}

/**
 * One value per flat face: the face normal, rebuilt from screen-space derivatives of the
 * position (what flat shading does), hashed. Each cut face gets its own shade.
 */
function faceRandom(): Node<'float'> {
  const n = normalize(cross(dFdx(positionWorld), dFdy(positionWorld)));
  return fract(sin(dot(n, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
}

/**
 * Cut rock (SPEC §5.1, "roche taillée"): flat-shaded faces each with its own shade, broad
 * fBm tone variation, a fine grain on near layers, and cracks glowing with the heat.
 */
export function createRockMaterial(
  heat: UniformNode<'float', number>,
  options: RockOptions,
): MeshStandardNodeMaterial {
  const wp = positionWorld;
  const broad = fbm01(wp.xz.mul(1.7).add(wp.y.mul(3)))
    .mul(0.6)
    .add(0.6);
  let tone = color(options.color).mul(broad).mul(faceRandom().mul(0.35).add(0.78));
  let roughness: Node<'float'> = float(0.95);
  if (options.grain) {
    const grain = fbm01(wp.xz.mul(9).add(wp.y.mul(11)));
    const speck = hash21(floor(wp.xz.mul(60).add(wp.y.mul(47))));
    tone = tone.mul(grain.mul(0.22).add(0.89)).mul(float(1).sub(step(0.93, speck).mul(0.25)));
    roughness = grain.mul(0.15).add(0.83);
  }
  const material = new MeshStandardNodeMaterial({ metalness: 0, flatShading: true });
  material.colorNode = tone;
  material.roughnessNode = roughness;
  // Distant layers never glow: no crack fBm in their shader at all.
  if (options.glow > 0) material.emissiveNode = crackGlow(heat, options.glow);
  return material;
}
