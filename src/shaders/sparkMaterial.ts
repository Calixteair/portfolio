import {
  cameraProjectionMatrix,
  cameraViewMatrix,
  float,
  length,
  max,
  mix,
  positionGeometry,
  smoothstep,
  uv,
  vec2,
  vec4,
} from 'three/tsl';
import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicNodeMaterial,
  type Node,
  type StorageBufferNode,
} from 'three/webgpu';
import { blackbody } from './blackbody';

/** Seconds of motion drawn behind each spark (streak length). */
const STREAK_SECONDS = 0.035;
/**
 * Streak width in view space (sparks stay around the pendant, ~3.3 m from the camera): a
 * world width avoids depending on the screen size. Under ~1 cm, the quads were thinner
 * than a pixel's sample footprint and vanished.
 */
const WIDTH = 0.009;

/**
 * Sparks drawn as streaks along their velocity (SPEC §5.4: stretched in the direction of
 * motion), additive, in a black-body colour that cools with age. One instanced unit quad
 * per spark, built in view space between the spark's position now and a moment ago.
 */
export function createSparkMaterial(
  body: StorageBufferNode<'vec4'>,
  motion: StorageBufferNode<'vec4'>,
) {
  const state = body.toAttribute() as Node<'vec4'>;
  const move = motion.toAttribute() as Node<'vec4'>;
  const head = cameraViewMatrix.mul(vec4(state.xyz, 1));
  const tail = cameraViewMatrix.mul(vec4(state.xyz.sub(move.xyz.mul(STREAK_SECONDS)), 1));
  const along = head.xy.sub(tail.xy);
  const direction = along.div(max(length(along), 1e-6));
  const side = vec2(direction.y.negate(), direction.x);
  const alive = state.w.lessThan(move.w).select(float(1), float(0));
  const corner = positionGeometry.xy;
  // Extend the head by half a width so a slow spark still shows as a dot.
  const tip = head.add(vec4(direction.mul(WIDTH * 0.5), 0, 0));
  const point = mix(tail, tip, corner.y.add(0.5)).add(
    vec4(side.mul(corner.x.mul(WIDTH).mul(alive)), 0, 0),
  );

  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    // The quad's winding flips with the streak direction: never cull it.
    side: DoubleSide,
  });
  material.vertexNode = cameraProjectionMatrix.mul(point);
  const cool = float(1).sub(state.w.div(move.w)).clamp(0, 1);
  // Soft sides (WGSL smoothstep is undefined with reversed edges: use 1 - smoothstep).
  const edge = float(1).sub(smoothstep(0.15, 0.5, uv().x.sub(0.5).abs()));
  material.colorNode = blackbody(cool).mul(cool.mul(cool).mul(2.5).add(1.2)).mul(edge);
  material.fog = false;
  return material;
}
