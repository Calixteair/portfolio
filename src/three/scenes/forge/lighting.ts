import { mix, pmremTexture, smoothstep } from 'three/tsl';
import {
  AgXToneMapping,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  SpotLight,
  type Texture,
  type UniformNode,
  type WebGPURenderer,
} from 'three/webgpu';
import { disposeMeshes } from '../../dispose';

type Vec3 = [number, number, number];

interface Panel {
  size: [number, number];
  color: number;
  position: Vec3;
  /** Emission when the pendant is cold, and at full heat. */
  cold: number;
  hot: number;
}

/**
 * A dark HDR "room" baked into a PMREM, twice: cold and hot. Cold, the warm emitters are
 * faint and the neutral fills dominate, so the steel reads grey (SPEC §5.1: the world is
 * barely visible at rest). Hot, the warm emitters low and in front take over (the
 * prototype's room). Replaces a 1K HDRI: no download, no licence, tunable.
 */
const ROOM: Panel[] = [
  { size: [6, 2.2], color: 0xff4a12, position: [0, -3, 2], cold: 0.1, hot: 2.8 },
  { size: [3, 1], color: 0xff2a08, position: [-3, -1.6, -0.5], cold: 0.1, hot: 3 },
  { size: [2.5, 0.8], color: 0xff6a1a, position: [3, -1.2, 1.5], cold: 0.08, hot: 2 },
  { size: [1.4, 4], color: 0x6a8ab8, position: [3, 2, -2.2], cold: 1.3, hot: 1.3 },
  { size: [5, 0.5], color: 0xffffff, position: [0, 4, 1.5], cold: 0.5, hot: 0.5 },
  { size: [3.2, 2], color: 0xb8bcc4, position: [-0.4, 0.9, 3.6], cold: 0.42, hot: 0.42 },
  { size: [0.5, 2.6], color: 0xd0d4dc, position: [1.2, 0.6, 3.2], cold: 0.3, hot: 0.3 },
  { size: [3.5, 0.9], color: 0xff6a30, position: [0.3, -1.6, 3.4], cold: 0.02, hot: 0.18 },
];

function buildRoom(state: 'cold' | 'hot'): Scene {
  const room = new Scene();
  for (const panel of ROOM) {
    const color = new Color(panel.color).multiplyScalar(panel[state]);
    const mesh = new Mesh(
      new PlaneGeometry(...panel.size),
      new MeshBasicNodeMaterial({ color, side: DoubleSide }),
    );
    mesh.position.set(...panel.position);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  }
  return room;
}

/** Must run after `renderer.init()` (done by createRenderer). */
function bakeRoom(pmrem: PMREMGenerator, state: 'cold' | 'hot'): Texture {
  const room = buildRoom(state);
  const texture = pmrem.fromScene(room, 0.025).texture;
  disposeMeshes(room);
  return texture;
}

/** Haze colour (linear, as in the prototype), also the horizon colour of the sky. */
export const HAZE = new Color().setRGB(0.02, 0.009, 0.007);

/** Look of the forge; the dev panel starts from these values. */
export const FORGE_LOOK = {
  exposure: 0.95,
  environmentIntensity: 0.48,
  fogDensity: 0.022,
  key: { color: '#ff5a1f', cold: 1.1, hot: 11.2 },
  rim: { color: '#8fb0ff', intensity: 0.26 },
} as const;

/**
 * AgX tone mapping, haze, and an environment that warms up with `heat`: both rooms are
 * baked once, the shaders blend them (rebaking a PMREM every frame would be far too costly).
 * Returns the cleanup.
 */
export function applyForgeAtmosphere(
  renderer: WebGPURenderer,
  scene: Scene,
  heat: UniformNode<'float', number>,
): () => void {
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = FORGE_LOOK.exposure;
  const pmrem = new PMREMGenerator(renderer);
  const cold = bakeRoom(pmrem, 'cold');
  const hot = bakeRoom(pmrem, 'hot');
  pmrem.dispose();
  scene.environmentNode = mix(pmremTexture(cold), pmremTexture(hot), smoothstep(0, 0.9, heat));
  scene.environmentIntensity = FORGE_LOOK.environmentIntensity;
  scene.fog = new FogExp2(HAZE, FORGE_LOOK.fogDensity);
  return () => {
    scene.environmentNode = null;
    scene.fog = null;
    cold.dispose();
    hot.dispose();
  };
}

export interface ForgeLights {
  /** Aim point of the key light (the pendant's centre). */
  target: Object3D;
  key: SpotLight;
  rim: DirectionalLight;
  /** Key intensity when cold and at full heat (tunable in the dev panel). */
  keyRange: { cold: number; hot: number };
}

/** Grazing orange-red key from below and in front, weak cold rim from behind (SPEC §5.1). */
export function createForgeLights(): ForgeLights {
  const { key: k, rim: r } = FORGE_LOOK;
  const target = new Object3D();
  const key = new SpotLight(k.color, k.cold, 10, 0.4, 0.7, 1.6);
  key.position.set(0.3, -0.85, 2.6);
  key.target = target;
  const rim = new DirectionalLight(r.color, r.intensity);
  rim.position.set(-1.5, 2, -2);
  return { target, key, rim, keyRange: { cold: k.cold, hot: k.hot } };
}

/** Per frame: the forge light grows with the heat, faster at the end (ease-in). */
export function driveForgeLights(lights: ForgeLights, heat: number): void {
  const { cold, hot } = lights.keyRange;
  lights.key.intensity = cold + (hot - cold) * heat ** 1.5;
}
