import { mx_fractal_noise_float, mx_noise_float, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** Perlin noise remapped to [0, 1] (MaterialX noise is roughly [-1, 1]). */
export function noise01(p: Node<'vec2'>): Node<'float'> {
  return mx_noise_float(vec3(p, 0)).mul(0.5).add(0.5);
}

/** 4-octave fBm remapped to about [0, 1]. */
export function fbm01(p: Node<'vec2'>): Node<'float'> {
  return mx_fractal_noise_float(vec3(p, 0), 4, 2.03, 0.5).mul(0.5).add(0.5);
}
