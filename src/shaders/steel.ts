import {
  exp,
  float,
  max,
  mix,
  positionLocal,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
} from 'three/tsl';
import { MeshPhysicalNodeMaterial, type DataTexture, type Node } from 'three/webgpu';
import type { EdgeFields } from '../three/pendant/shape';
import { fbm01, noise01 } from './noise';

/** The baked edge fields (see shape.ts) as a GPU texture plus its plate-space mapping. */
export type EdgeMaskInfo = Pick<EdgeFields, 'min' | 'size' | 'range'> & { texture: DataTexture };

/** Brushed-steel anisotropy (tunable in the dev panel). */
export const STEEL_ANISOTROPY = 0.35;

/** Sample the baked edge fields at the fragment's plate-space position (local XY). */
function sampleEdgeMask(mask: EdgeMaskInfo) {
  const uv = positionLocal.xy.sub(vec2(mask.min.x, mask.min.y)).div(vec2(mask.size.x, mask.size.y));
  const fields = texture(mask.texture, uv);
  return { holeDistance: fields.r.mul(mask.range), insideHole: fields.a };
}

/** Crust coverage: a noisy band along the hole edge, splashes onto the face, the hole walls. */
function crustMask(mask: EdgeMaskInfo): Node<'float'> {
  const p = positionLocal.xy;
  const { holeDistance, insideHole } = sampleEdgeMask(mask);
  const width = float(0.005).add(fbm01(p.mul(30)).mul(0.018));
  const band = float(1).sub(smoothstep(width.mul(0.5), width, holeDistance));
  const speck = step(0.6, fbm01(p.mul(150))).mul(exp(holeDistance.mul(-40)));
  return max(max(band, speck), smoothstep(0.2, 0.6, insideHole));
}

/** Brushed finish: thin horizontal streaks, matching the reference photos. */
function brushedRoughness(): Node<'float'> {
  const p = positionLocal.xy;
  // Long, thin streaks; a finer frequency aliases into glitter at this size on screen.
  const streaks = noise01(vec2(p.x.mul(4), p.y.mul(700)));
  const patches = noise01(vec2(p.x.mul(1.5), p.y.mul(60)));
  // Low base roughness: the prototype multiplied 0.38 by a 0.27-0.63 streak map.
  return float(0.08).add(streaks.mul(0.12)).add(patches.mul(0.06));
}

/**
 * Satin brushed steel with a black, matte, non-metallic erosion crust around the hole.
 * Anisotropy follows the cap UVs (plate X), which is what makes the steel read as brushed.
 */
export function createPlateMaterial(mask: EdgeMaskInfo): MeshPhysicalNodeMaterial {
  const crust = crustMask(mask);
  const steel = vec3(0.706, 0.71, 0.725);
  const crustColor = vec3(0.006).add(noise01(positionLocal.xy.mul(400)).mul(0.01));
  const material = new MeshPhysicalNodeMaterial({
    anisotropy: STEEL_ANISOTROPY,
    envMapIntensity: 1.1,
  });
  material.colorNode = mix(steel, crustColor, crust);
  material.metalnessNode = mix(float(1), float(0), crust);
  material.roughnessNode = mix(brushedRoughness(), float(0.5), crust);
  material.specularIntensityNode = mix(float(1), float(0.2), crust);
  return material;
}

/** Black diamond: opaque, very glossy dielectric with sharp facets, no refraction. */
export function createDiamondMaterial(): MeshPhysicalNodeMaterial {
  return new MeshPhysicalNodeMaterial({
    color: 0x030303,
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    ior: 2.4,
    flatShading: true,
  });
}
