import {
  abs,
  float,
  mix,
  mx_fractal_noise_float,
  normalize,
  positionLocal,
  pow,
  smoothstep,
  time,
  vec3,
} from 'three/tsl';
import { BackSide, Color, MeshBasicNodeMaterial, type Node } from 'three/webgpu';

/** Palette B « Braise contaminée » (SPEC §1). */
export const PALETTE_B = {
  void: 0x02040c,
  nebula: 0x0c2348,
  filament: 0x2f6bff,
  core: 0xb4e0ff,
  edge: 0xff5a14,
  ember: 0xff5a1a,
} as const;

/** A palette colour as a linear vec3 node (Color converts the sRGB hex). */
export function rgb(hex: number): Node<'vec3'> {
  const c = new Color(hex);
  return vec3(c.r, c.g, c.b);
}

/** 4-octave fBm of a 3D direction, about [0, 1]. */
function fbm3(p: Node<'vec3'>): Node<'float'> {
  return mx_fractal_noise_float(p, 4, 2.03, 0.5).mul(0.5).add(0.5);
}

/** Ridged noise: thin bright crests, the protomolecule filaments. */
function ridges(p: Node<'vec3'>): Node<'float'> {
  return pow(float(1).sub(abs(mx_fractal_noise_float(p, 4, 2.1, 0.5))), 6);
}

/**
 * Sky of the other side: black void, deep blue nebula, slowly drifting bioluminescent
 * filaments (palette B, inspired by The Expanse's protomolecule; no image reused).
 */
export function createNebulaMaterial(): MeshBasicNodeMaterial {
  const dir = normalize(positionLocal);
  const drift = vec3(time.mul(0.004), time.mul(-0.003), 0);
  const cloud = smoothstep(0.35, 0.85, fbm3(dir.mul(2.2).add(drift)));
  const warp = fbm3(dir.mul(3.1).sub(drift)).mul(1.8);
  const veins = ridges(dir.mul(2.6).add(warp));
  const filament = mix(rgb(PALETTE_B.filament), rgb(PALETTE_B.core), smoothstep(0.7, 0.95, veins));
  const nebula = rgb(PALETTE_B.nebula).mul(cloud.mul(1.4));
  const glow = filament.mul(smoothstep(0.35, 0.9, veins).mul(0.6));
  const sky = rgb(PALETTE_B.void).add(nebula).add(glow);
  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  material.colorNode = sky;
  return material;
}
