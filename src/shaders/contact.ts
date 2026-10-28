import { If, dot, float } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** How a particle leaves a surface it hits. */
export interface Bounce {
  /** Share of the normal speed kept (reversed). */
  restitution: number;
  /** Share of the tangential speed kept. */
  slide: number;
}

/**
 * Bounce off a surface of normal n moving at `surface`. Particles already leaving the
 * surface are left alone. `m.xyz` is the velocity.
 */
export function bounce(m: Node<'vec4'>, n: Node<'vec3'>, surface: Node<'vec3'>, k: Bounce) {
  const relative = m.xyz.sub(surface);
  const vn = dot(relative, n);
  If(vn.lessThan(0), () => {
    const normal = n.mul(vn);
    m.xyz.assign(relative.sub(normal).mul(k.slide).sub(normal.mul(k.restitution)).add(surface));
  });
}

/**
 * Contact with a signed distance field: within `skin` of the surface (d its distance), the
 * particle at `b.xyz` is pushed back out to `skin` along the outward normal (avoids an
 * instant re-collision) and bounces. The normal is only built on contact.
 */
export function contact(
  b: Node<'vec4'>,
  m: Node<'vec4'>,
  d: Node<'float'>,
  normal: () => Node<'vec3'>,
  surface: (b: Node<'vec4'>) => Node<'vec3'>,
  k: Bounce & { skin: number },
) {
  If(d.lessThan(k.skin), () => {
    const n = normal();
    b.xyz.addAssign(n.mul(float(k.skin).sub(d)));
    bounce(m, n, surface(b), k);
  });
}
