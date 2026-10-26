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
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import {
  BackSide,
  CatmullRomCurve3,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
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

export interface Tunnel {
  scene: Scene;
  camera: PerspectiveCamera;
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
  const tube = new Mesh(new TubeGeometry(PATH, 400, 2.2, 48, false), wallMaterial(rush));
  scene.add(tube);
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
  return { scene, camera, rush, fly, resize, dispose: () => disposeMeshes(scene) };
}
