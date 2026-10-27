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
import { heatField, incandescence, temperTint, type PlateHeat } from './heat';
import { fbm01, noise01 } from './noise';

/** The baked edge fields (see shape.ts) as a GPU texture plus its plate-space mapping. */
export type EdgeMaskInfo = Pick<EdgeFields, 'min' | 'size' | 'range'> & { texture: DataTexture };

/** Brushed-steel anisotropy (tunable in the dev panel). */
export const STEEL_ANISOTROPY = 0.35;

/** Sample the baked edge fields at the fragment's plate-space position (local XY). */
function sampleEdgeMask(mask: EdgeMaskInfo) {
  const uv = positionLocal.xy.sub(vec2(mask.min.x, mask.min.y)).div(vec2(mask.size.x, mask.size.y));
  const fields = texture(mask.texture, uv);
  return {
    holeDistance: fields.r.mul(mask.range),
    insideHole: fields.a,
    /** Raw 0-1 distances (1 = mask.range or farther), as the heat field expects. */
    holeEdge: fields.r,
    outerEdge: fields.g,
  };
}

/** Crust coverage: a noisy band along the hole edge, splashes onto the face, the hole walls. */
function crustMask(fields: ReturnType<typeof sampleEdgeMask>): Node<'float'> {
  const p = positionLocal.xy;
  const { holeDistance, insideHole } = fields;
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
 * Satin brushed sterling silver (.925) with a black, matte, non-metallic erosion crust
 * around the hole. Anisotropy follows the cap UVs (plate X), which is what makes the metal
 * read as brushed. Silver reflects brighter and a touch warmer than steel.
 * It glows from the edges with the forge heat and keeps tempering tints where it got hot.
 */
export function createPlateMaterial(mask: EdgeMaskInfo, heat: PlateHeat): MeshPhysicalNodeMaterial {
  const material = new MeshPhysicalNodeMaterial({
    anisotropy: STEEL_ANISOTROPY,
    envMapIntensity: 1.1,
  });
  setPlateNodes(material, mask, heat, null);
  return material;
}

/**
 * The plate's shading. `crust` (0-1) says where the black erosion crust is: null for the
 * placeholder (drawn procedurally around the hole), the model's colour attribute for the
 * final pendant (its cavities are carved in the geometry). Rebuilds the same material,
 * so whoever holds it (the dev panel) keeps a valid reference.
 */
export function setPlateNodes(
  material: MeshPhysicalNodeMaterial,
  mask: EdgeMaskInfo,
  heat: PlateHeat,
  crustSource: Node<'float'> | null,
): void {
  const fields = sampleEdgeMask(mask);
  const crust = crustSource ?? crustMask(fields);
  const past = heatField(fields.holeEdge, fields.outerEdge, heat.heatHistory, heat);
  // Sterling silver's reflectance (linear): near white, slightly warm.
  const silver = vec3(0.95, 0.93, 0.88).mul(temperTint(past));
  const crustColor = vec3(0.006).add(noise01(positionLocal.xy.mul(400)).mul(0.01));
  material.colorNode = mix(silver, crustColor, crust);
  material.metalnessNode = mix(float(1), float(0), crust);
  material.roughnessNode = mix(brushedRoughness(), float(0.5), crust);
  material.specularIntensityNode = mix(float(1), float(0.2), crust);
  material.emissiveNode = incandescence(
    heatField(fields.holeEdge, fields.outerEdge, heat.heat, heat),
  );
  material.needsUpdate = true;
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
