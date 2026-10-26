import {
  abs,
  float,
  floor,
  fract,
  length,
  mix,
  mx_fractal_noise_float,
  normalize,
  positionLocal,
  pow,
  smoothstep,
  step,
  time,
  vec3,
} from 'three/tsl';
import { BackSide, Color, MeshBasicNodeMaterial, type Node } from 'three/webgpu';
import { hash21 } from './noise';

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

/** Fixed stars: one per lit cell of a 3D grid on the sky, a few brighter, some bluish. */
function starField(dir: Node<'vec3'>): Node<'vec3'> {
  const cell = dir.mul(220);
  const id = floor(cell);
  const h = hash21(id.xy.add(id.z.mul(37.1)));
  const offset = vec3(hash21(id.xy.add(5.3)), hash21(id.yz.add(9.1)), hash21(id.zx.add(2.7)));
  const dist = length(fract(cell).sub(offset.mul(0.6)).sub(0.2));
  const star = step(0.955, h).mul(float(1).sub(smoothstep(0, 0.16, dist)));
  const bright = pow(hash21(id.xy.add(13)), 6)
    .mul(4)
    .add(0.4);
  const tint = mix(vec3(1, 0.92, 0.85), rgb(PALETTE_B.core), hash21(id.yz.add(21)));
  return tint.mul(star.mul(bright));
}

/**
 * Sky of the other side: deep void, a faint distant blue nebula, thin bioluminescent
 * filaments far away (palette B, inspired by The Expanse's protomolecule; no image reused)
 * and fixed stars. Kept dim: the system in front is what the eye should find.
 */
export function createNebulaMaterial(): MeshBasicNodeMaterial {
  const dir = normalize(positionLocal);
  const drift = vec3(time.mul(0.004), time.mul(-0.003), 0);
  const cloud = smoothstep(0.45, 0.9, fbm3(dir.mul(1.6).add(drift)));
  const warp = fbm3(dir.mul(2.4).sub(drift)).mul(1.5);
  const veins = pow(ridges(dir.mul(4.2).add(warp)), 3);
  // Filaments only where the nebula is, and thin: a far structure, not a curtain.
  const glow = rgb(PALETTE_B.filament).mul(veins.mul(cloud).mul(0.35));
  const nebula = rgb(PALETTE_B.nebula).mul(cloud.mul(0.55));
  const sky = rgb(PALETTE_B.void).add(nebula).add(glow).add(starField(dir));
  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  material.colorNode = sky;
  return material;
}
