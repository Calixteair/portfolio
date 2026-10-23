import { dot, fract, mx_fractal_noise_float_2d, mx_noise_float, sin, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** 2D Perlin noise remapped to [0, 1] (MaterialX noise is roughly [-1, 1]). */
export function noise01(p: Node<'vec2'>): Node<'float'> {
  return mx_noise_float(p).mul(0.5).add(0.5);
}

/** 4-octave 2D fBm remapped to about [0, 1]. */
export function fbm01(p: Node<'vec2'>): Node<'float'> {
  return mx_fractal_noise_float_2d(p, 4, 2.03, 0.5).mul(0.5).add(0.5);
}

/** 2D → 1D hash in [0, 1). TSL's hash() takes a scalar: fed a vec2 it keeps x only. */
export function hash21(p: Node<'vec2'>): Node<'float'> {
  return fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));
}
