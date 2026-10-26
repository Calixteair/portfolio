import { abs, clamp, exp, float, length, positionLocal, smoothstep, time, vec2 } from 'three/tsl';
import type { Node, UniformNode } from 'three/webgpu';
import { HOLE } from '../three/pendant/shape';
import { PALETTE_B, rgb } from './nebula';
import { fbm01 } from './noise';

/**
 * Portal opening (SPEC §5.5), from the prototype: the other side shows through a ragged
 * front that grows from the centre of the hole, with an incandescent rim (palette B).
 * `open` goes 0 → 1; `view` is the portal world sampled at this pixel.
 */
export function portalOpening(view: Node<'vec4'>, open: UniformNode<'float', number>) {
  const centred = positionLocal.xy.sub(vec2(HOLE.cx, HOLE.cy));
  const ragged = fbm01(centred.mul(14).add(time.mul(0.2)))
    .sub(0.5)
    .mul(0.35);
  const radius = length(centred.div(vec2(HOLE.hw, HOLE.hh))).add(ragged);
  const eased = smoothstep(0, 1, open);
  const front = eased.mul(1.35);
  const inside = float(1).sub(smoothstep(front.sub(0.18), front, radius));
  // The rim burns while the front moves, then calms down once fully open.
  const rim = exp(abs(radius.sub(front)).mul(-18))
    .mul(smoothstep(0, 0.02, open))
    .mul(float(1).sub(smoothstep(0.95, 1, open).mul(0.6)));
  const color = view.rgb.mul(inside).add(rgb(PALETTE_B.edge).mul(rim.mul(3)));
  return { color, alpha: clamp(inside.add(rim), 0, 1) };
}
