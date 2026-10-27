import {
  abs,
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

interface CloudLayer {
  /** Fake altitude: higher layers stretch less towards the horizon. */
  altitude: number;
  scale: number;
  /** Drift speed: different speeds read as parallax between layers. */
  speed: number;
  /** Coverage thresholds of the noise. */
  cover: [number, number];
  opacity: number;
  /** How much the forge heat reddens the layer's underside (low clouds most). */
  underlit: number;
}

/** High thin veils, a middle layer, low heavy clouds near the horizon (SPEC §5.1). */
const CLOUD_LAYERS: CloudLayer[] = [
  { altitude: 0.35, scale: 0.35, speed: 0.006, cover: [0.55, 0.85], opacity: 0.45, underlit: 0.4 },
  { altitude: 0.12, scale: 0.55, speed: 0.012, cover: [0.5, 0.8], opacity: 0.7, underlit: 0.8 },
  { altitude: 0.03, scale: 0.9, speed: 0.022, cover: [0.46, 0.74], opacity: 0.85, underlit: 1.3 },
];

/** One cloud layer over `sky`: its cover from fBm projected at its altitude, lit from below. */
function overCloudLayer(
  sky: Node<'vec3'>,
  layer: CloudLayer,
  dir: Node<'vec3'>,
  heat: UniformNode<'float', number>,
): Node<'vec3'> {
  const el = dir.y;
  const drift = vec2(time.mul(layer.speed), time.mul(layer.speed * 0.4));
  const uv = dir.xz.div(max(el, 0.02).add(layer.altitude)).mul(layer.scale).add(drift);
  const cover = smoothstep(layer.cover[0], layer.cover[1], fbm01(uv)).mul(
    smoothstep(0.01, 0.12, el),
  );
  const cloud = vec3(0.012, 0.008, 0.008).add(
    vec3(0.12, 0.035, 0.01)
      .mul(heat.mul(layer.underlit))
      .mul(exp(el.mul(-2.5))),
  );
  return mix(sky, cloud, cover.mul(layer.opacity));
}

/**
 * Sky dome: horizon haze that matches the fog, fixed stars, three cloud layers drifting at
 * their own pace, whose undersides and the horizon redden with the forge heat (SPEC §5.1).
 */
export function createSkyMaterial(
  heat: UniformNode<'float', number>,
  horizon: Color,
): MeshBasicNodeMaterial {
  const dir = normalize(positionLocal);
  const el = dir.y;
  let sky: Node<'vec3'> = mix(
    color(horizon),
    vec3(0.0015, 0.0015, 0.003),
    smoothstep(-0.02, 0.45, el),
  );
  // Glow of the forge on the haze: broad, plus a tighter band right on the horizon.
  const warmth = heat.mul(0.85).add(0.15);
  sky = sky.add(
    vec3(0.05, 0.014, 0.004)
      .mul(exp(max(el, 0).mul(-10)))
      .mul(warmth),
  );
  sky = sky.add(
    vec3(0.04, 0.012, 0.004)
      .mul(exp(abs(el).mul(-40)))
      .mul(warmth),
  );
  sky = sky.add(stars(dir, el));
  for (const layer of CLOUD_LAYERS) sky = overCloudLayer(sky, layer, dir, heat);
  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  material.colorNode = sky;
  return material;
}
