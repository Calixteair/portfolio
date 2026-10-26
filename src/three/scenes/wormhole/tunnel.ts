import {
  abs,
  cos,
  float,
  floor,
  fract,
  length,
  mix,
  mx_fractal_noise_float,
  pow,
  screenUV,
  sin,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import {
  BackSide,
  CircleGeometry,
  CatmullRomCurve3,
  HalfFloatType,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  RenderTarget,
  Scene,
  TubeGeometry,
  Vector3,
  type UniformNode,
} from 'three/webgpu';
import { PALETTE_B, rgb } from '../../../shaders/nebula';
import { hash21 } from '../../../shaders/noise';
import { disposeMeshes } from '../../dispose';

/** A gentle S-curve, ~60 m long: enough bend to feel the turns, never a dead end in view. */
const PATH = new CatmullRomCurve3([
  new Vector3(0, 0, 0),
  new Vector3(3, 1, -15),
  new Vector3(-4, -2, -30),
  new Vector3(2, 1.5, -45),
  new Vector3(0, 0, -60),
]);

/**
 * Wormhole walls (SPEC §5.6): noise streaming along the tube, bioluminescent blue
 * filaments over the void, with sparse embers (palette B). `rush` speeds the flow up.
 */
function wallMaterial(rush: UniformNode<'float', number>): MeshBasicNodeMaterial {
  // Around the tube, noise is sampled on a circle (cos, sin of the angle): no seam where
  // the tube's uv.y wraps from 1 back to 0.
  const angle = uv().y.mul(Math.PI * 2);
  const along = uv().x.mul(40).sub(time.mul(rush));
  const around = vec2(cos(angle), sin(angle)).mul(6 / (Math.PI * 2));
  const flow = vec3(along, around);
  const warp = mx_fractal_noise_float(
    vec3(flow.mul(0.35)).add(vec3(0, 0, time.mul(0.2))),
    3,
    2,
    0.5,
  );
  const veins = pow(float(1).sub(abs(mx_fractal_noise_float(flow.add(warp), 4, 2.1, 0.5))), 5);
  // Ember cells: 24 around the tube, a whole number, so they tile across the wrap too.
  const cell = vec2(along.mul(3), uv().y.mul(24));
  // 1 - smoothstep: WGSL leaves smoothstep with reversed edges undefined.
  const ember = smoothstep(0.985, 1, hash21(floor(cell))).mul(
    float(1).sub(smoothstep(0, 0.45, length(fract(cell).sub(0.5)))),
  );
  const filament = mix(rgb(PALETTE_B.filament), rgb(PALETTE_B.core), smoothstep(0.75, 1, veins));
  const material = new MeshBasicNodeMaterial({ side: BackSide, fog: false });
  material.colorNode = rgb(PALETTE_B.void)
    .add(rgb(PALETTE_B.nebula).mul(warp.mul(0.5).add(0.5)))
    .add(filament.mul(veins.mul(1.6)))
    .add(rgb(PALETTE_B.ember).mul(ember.mul(3)));
  return material;
}

/** Tube radius; the mouth at the far end has the same size. */
const RADIUS = 2.2;

/**
 * The tunnel's far end opens onto the other side (SPEC §5.6, no cut): a disc that shows,
 * in screen space, the planetary system rendered live into `target`. When the disc fills
 * the screen, the full-screen system takes over with the very same image.
 */
function createMouth(target: RenderTarget): Mesh {
  const material = new MeshBasicNodeMaterial({ fog: false, transparent: true, depthWrite: false });
  const centred = uv().sub(0.5).length().mul(2);
  // Soft rim: the walls' glow bleeds into the opening instead of a hard circle.
  const edge = float(1).sub(smoothstep(0.75, 1, centred));
  const rim = smoothstep(0.82, 0.95, centred).mul(float(1).sub(smoothstep(0.95, 1, centred)));
  material.colorNode = texture(target.texture, screenUV)
    .rgb.mul(edge)
    .add(rgb(PALETTE_B.filament).mul(rim.mul(0.8)));
  material.opacityNode = edge.max(rim);
  const mouth = new Mesh(new CircleGeometry(RADIUS * 0.98, 64), material);
  PATH.getPointAt(1, mouth.position);
  PATH.getPointAt(0.99, ahead);
  mouth.lookAt(ahead); // faces back towards the visitor coming through
  return mouth;
}

export interface Tunnel {
  scene: Scene;
  camera: PerspectiveCamera;
  /** What the mouth shows: the planetary system, rendered here while diving. */
  mouthTarget: RenderTarget;
  /** Uniform: how fast the walls stream past (1 = cruising). */
  rush: UniformNode<'float', number>;
  /** Place the camera at `t` (0-1) along the path, looking ahead, with a slight roll. */
  fly: (t: number, roll: number) => void;
  resize: (aspect: number) => void;
  dispose: () => void;
}

const ahead = new Vector3();

export function createTunnel(): Tunnel {
  const scene = new Scene();
  const rush = uniform(1);
  const tube = new Mesh(new TubeGeometry(PATH, 400, RADIUS, 48, false), wallMaterial(rush));
  const mouthTarget = new RenderTarget(2, 2, { type: HalfFloatType, depthBuffer: true });
  scene.add(tube, createMouth(mouthTarget));
  const camera = new PerspectiveCamera(60, 1, 0.05, 200);
  const fly = (t: number, roll: number) => {
    const at = Math.min(0.995, Math.max(0, t));
    PATH.getPointAt(at, camera.position);
    PATH.getPointAt(Math.min(1, at + 0.01), ahead);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(ahead);
  };
  fly(0, 0);
  const resize = (aspect: number) => {
    if (Math.abs(camera.aspect - aspect) < 1e-3) return;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  };
  const dispose = () => {
    disposeMeshes(scene);
    mouthTarget.dispose();
  };
  return { scene, camera, mouthTarget, rush, fly, resize, dispose };
}
