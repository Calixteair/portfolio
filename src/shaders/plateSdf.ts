import { abs, float, length, max, min, normalize, texture, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { PLATE } from '../three/pendant/shape';
import type { EdgeMaskInfo } from './steel';

/** Half thickness of the plate, bevel included. */
const HALF_DEPTH = PLATE.depth / 2 + PLATE.bevel;
/** Finite-difference step for the normal (~ one edge-mask texel). */
const EPSILON = 0.004;

/**
 * Signed distance from a point in pendant space to the plate (negative inside the metal):
 * the baked 2D signed distance (edge mask, B channel) extruded over the plate's thickness.
 * Explicit LOD: also valid in compute and vertex stages (WebGL 2 transform feedback).
 */
export function plateSdf(local: Node<'vec3'>, mask: EdgeMaskInfo): Node<'float'> {
  const uv = local.xy.sub(vec2(mask.min.x, mask.min.y)).div(vec2(mask.size.x, mask.size.y));
  const flat = texture(mask.texture, uv)
    .level(float(0))
    .b.sub(0.5)
    .mul(2 * mask.range);
  const w = vec2(flat, abs(local.z).sub(HALF_DEPTH));
  return min(max(w.x, w.y), 0).add(length(max(w, vec2(0))));
}

/** Outward surface normal at a point near the plate, in pendant space. */
export function plateNormal(local: Node<'vec3'>, mask: EdgeMaskInfo): Node<'vec3'> {
  const at = (dx: number, dy: number, dz: number) => plateSdf(local.add(vec3(dx, dy, dz)), mask);
  const e = EPSILON;
  return normalize(
    vec3(
      at(e, 0, 0).sub(at(-e, 0, 0)),
      at(0, e, 0).sub(at(0, -e, 0)),
      at(0, 0, e).sub(at(0, 0, -e)),
    ).add(vec3(0, 0, float(1e-6))),
  );
}
