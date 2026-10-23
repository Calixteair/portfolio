import {
  color,
  exp,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  normalize,
  positionLocal,
  sin,
  smoothstep,
  step,
  time,
  vec2,
  vec3,
} from 'three/tsl';
import {
  BackSide,
  MeshBasicNodeMaterial,
  type Color,
  type Node,
  type UniformNode,
} from 'three/webgpu';
import { fbm01, hash21 } from './noise';

/** One star per lit cell of a 3D grid on the dome, slight twinkle, none near the horizon. */
function stars(dir: Node<'vec3'>, elevation: Node<'float'>): Node<'vec3'> {
  const cell = dir.mul(160);
  const id = floor(cell);
  const h = hash21(id.xy.add(id.z.mul(31.7)));
  const offset = vec3(hash21(id.xy.add(3.1)), hash21(id.yz.add(7.7)), hash21(id.zx.add(1.3)));
  const dist = length(fract(cell).sub(offset.mul(0.6)).sub(0.2));
  const star = step(0.93, h).mul(float(1).sub(smoothstep(0, 0.22, dist)));
  const twinkle = sin(time.mul(1.7).add(h.mul(90)))
    .mul(0.15)
    .add(0.85);
  const brightness = hash21(id.xy.add(11)).mul(0.7).add(0.3);
  return vec3(0.75, 0.82, 1)
    .mul(star.mul(brightness).mul(twinkle))
    .mul(smoothstep(0.02, 0.2, elevation));
}

/**
 * Sky dome: horizon haze that matches the fog, fixed stars, thin clouds drifting slowly,
 * whose undersides and the horizon redden with the forge heat (SPEC §5.1).
 */
export function createSkyMaterial(
  heat: UniformNode<'float', number>,
  horizon: Color,
): MeshBasicNodeMaterial {
  const dir = normalize(positionLocal);
  const el = dir.y;
  let sky = mix(color(horizon), vec3(0.0015, 0.0015, 0.003), smoothstep(-0.02, 0.45, el));
  sky = sky.add(
    vec3(0.05, 0.014, 0.004)
      .mul(exp(max(el, 0).mul(-10)))
      .mul(heat.mul(0.85).add(0.15)),
  );
  sky = sky.add(stars(dir, el));
  const drift = vec2(time.mul(0.012), time.mul(0.005));
  const cloudUv = dir.xz.div(max(el, 0.03)).mul(0.5).add(drift);
  const cover = smoothstep(0.48, 0.82, fbm01(cloudUv)).mul(smoothstep(0.02, 0.3, el));
  const cloud = vec3(0.012, 0.008, 0.008).add(
    vec3(0.12, 0.035, 0.01)
      .mul(heat)
      .mul(exp(el.mul(-2.5))),
  );
  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  material.colorNode = mix(sky, cloud, cover.mul(0.85));
  return material;
}
