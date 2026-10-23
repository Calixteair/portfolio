import { smoothstep, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** Approximate black-body ramp: dark red → orange → yellow → white as t goes 0 → 1. */
export function blackbody(t: Node<'float'>): Node<'vec3'> {
  return vec3(
    smoothstep(0, 0.35, t),
    smoothstep(0.2, 0.8, t).mul(0.8),
    smoothstep(0.55, 1, t).mul(0.72),
  );
}
