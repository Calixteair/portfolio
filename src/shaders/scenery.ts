import {
  If,
  Loop,
  abs,
  clamp,
  dot,
  float,
  floor,
  int,
  ivec2,
  length,
  min,
  normalize,
  sqrt,
  textureLoad,
  vec2,
  vec3,
} from 'three/tsl';
import type { DataTexture, Node } from 'three/webgpu';
import {
  type Cone,
  type GroundField,
  type SparkColliders,
  rockGap,
} from '../three/scenes/forge/colliders';
import { type Bounce, bounce, contact } from './contact';
import { floatTexture } from './dataTexture';

/**
 * Spark collisions with the forge's scenery (SPEC §5.4): the drawn ground and the nearest
 * rocks. Data in small float textures read with textureLoad, so the same code runs in the
 * WebGPU compute shader and in the WebGL 2 transform-feedback fallback.
 */

/**
 * Rocks as texels. Row 0, enough to rule a rock out: (x, z, base radius, y at mid-height).
 * Row 1, read only near one: (half height, top radius).
 */
function rockTexture(rocks: Cone[]): DataTexture {
  const width = Math.max(rocks.length, 1);
  const data = new Float32Array(width * 2 * 4);
  rocks.forEach((c, i) => {
    data.set([c.x, c.z, c.bottom, c.y + c.height / 2], i * 4);
    data.set([c.height / 2, c.top, 0, 0], (width + i) * 4);
  });
  return floatTexture(data, width, 2);
}

/**
 * Height and normal of the drawn ground under (x, z): the facet of the mesh (see
 * sampleGround, its CPU twin), so its gradient is exact.
 */
function groundSurface(p: Node<'vec3'>, tex: DataTexture, field: GroundField) {
  const g = clamp(p.xz.sub(field.origin).div(field.step), 0, field.size - 1.001);
  const cell = floor(g);
  const f = g.sub(cell);
  const at = (di: number, dj: number) =>
    textureLoad(tex, ivec2(cell.x.toInt().add(di), cell.y.toInt().add(dj))).r;
  const [h00, h10, h01, h11] = [at(0, 0), at(1, 0), at(0, 1), at(1, 1)];
  const lower = f.x.add(f.y).lessThanEqual(1);
  const height = lower.select(
    h00.add(f.x.mul(h10.sub(h00))).add(f.y.mul(h01.sub(h00))),
    h11.add(f.x.oneMinus().mul(h01.sub(h11))).add(f.y.oneMinus().mul(h10.sub(h11))),
  );
  const slope = lower
    .select(vec2(h10.sub(h00), h01.sub(h00)), vec2(h11.sub(h01), h11.sub(h10)))
    .div(field.step);
  return { height, normal: () => normalize(vec3(slope.x.negate(), 1, slope.y.negate())) };
}

/** Signed distance to an upright truncated cone centred at the origin (Quilez). */
function coneSdf(
  p: Node<'vec3'>,
  half: Node<'float'>,
  bottom: Node<'float'>,
  top: Node<'float'>,
): Node<'float'> {
  const q = vec2(length(p.xz), p.y);
  const k1 = vec2(top, half);
  const k2 = vec2(top.sub(bottom), half.mul(2));
  const ca = vec2(q.x.sub(min(q.x, q.y.lessThan(0).select(bottom, top))), abs(q.y).sub(half));
  const cb = q.sub(k1).add(k2.mul(clamp(dot(k1.sub(q), k2).div(dot(k2, k2)), 0, 1)));
  const inside = cb.x.lessThan(0).and(ca.y.lessThan(0));
  return inside.select(float(-1), float(1)).mul(sqrt(min(dot(ca, ca), dot(cb, cb))));
}

/** Finite-difference step for a rock's normal (1 cm: rocks are 25 cm and more). */
const ROCK_EPSILON = 0.01;

/** Outward normal of a distance field (tetrahedron technique: 4 evaluations). */
function sdfNormal(sdf: (p: Node<'vec3'>) => Node<'float'>, p: Node<'vec3'>) {
  const k = [vec3(1, -1, -1), vec3(-1, -1, 1), vec3(-1, 1, -1), vec3(1, 1, 1)];
  return normalize(k.map((d) => d.mul(sdf(p.add(d.mul(ROCK_EPSILON))))).reduce((a, b) => a.add(b)));
}

/** Static scenery: no surface velocity. */
const still = () => vec3(0);

/**
 * Collision step against the ground and the rocks, built once for the given colliders.
 * Rocks (nearest first) are only tested beyond the nearest one's foot, and each only
 * past a cheap test on its footprint.
 */
export function createSceneryCollision(
  { ground, rocks }: SparkColliders,
  k: Bounce & { skin: number },
) {
  const groundTex = floatTexture(ground.heights, ground.size, ground.size, 'r');
  const rockTex = rockTexture(rocks);

  const hitGround = (b: Node<'vec4'>, m: Node<'vec4'>) => {
    If(b.y.lessThan(ground.top), () => {
      const surface = groundSurface(b.xyz, groundTex, ground);
      If(b.y.lessThan(surface.height), () => {
        b.y.assign(surface.height);
        bounce(m, surface.normal(), still(), k);
      });
    });
  };

  const hitRock = (b: Node<'vec4'>, m: Node<'vec4'>, i: Node<'int'>) => {
    const foot = textureLoad(rockTex, ivec2(i, int(0)));
    const reach = foot.z.add(k.skin);
    const offset = b.xz.sub(foot.xy);
    If(dot(offset, offset).lessThan(reach.mul(reach)), () => {
      const shape = textureLoad(rockTex, ivec2(i, int(1)));
      const local = vec3(offset.x, b.y.sub(foot.w), offset.y);
      const sdf = (p: Node<'vec3'>) => coneSdf(p, shape.x, foot.z, shape.y);
      contact(b, m, sdf(local), () => sdfNormal(sdf, local), still, k);
    });
  };

  // Inlined into the caller (not a TSL Fn): its arguments would be copies, and the
  // writes to the spark's buffers lost.
  const collide = (b: Node<'vec4'>, m: Node<'vec4'>) => {
    hitGround(b, m);
    const [nearest] = rocks;
    if (!nearest) return;
    If(length(b.xz).greaterThan(rockGap(nearest)), () => {
      Loop(rocks.length, ({ i }: { i: Node<'int'> }) => hitRock(b, m, i));
    });
  };

  return {
    collide,
    dispose: () => {
      groundTex.dispose();
      rockTex.dispose();
    },
  };
}
