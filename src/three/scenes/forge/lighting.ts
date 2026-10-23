import {
  AgXToneMapping,
  Color,
  FogExp2,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  SpotLight,
  type Object3D,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu';

type Vec3 = [number, number, number];

interface Panel {
  size: [number, number];
  color: number;
  intensity: number;
  position: Vec3;
}

/**
 * A dark HDR "room" baked into a PMREM: warm emitters low and in front, a cold strip
 * behind, faint neutral fills so the steel has something to reflect. Replaces a 1K HDRI
 * (no download, no licence, tunable), as validated by the prototype.
 */
const ROOM: Panel[] = [
  { size: [6, 2.2], color: 0xff4a12, intensity: 2.8, position: [0, -3, 2] },
  { size: [3, 1], color: 0xff2a08, intensity: 3, position: [-3, -1.6, -0.5] },
  { size: [2.5, 0.8], color: 0xff6a1a, intensity: 2, position: [3, -1.2, 1.5] },
  { size: [1.4, 4], color: 0x6a8ab8, intensity: 1.3, position: [3, 2, -2.2] },
  { size: [5, 0.5], color: 0xffffff, intensity: 0.5, position: [0, 4, 1.5] },
  { size: [3.2, 2], color: 0xb8bcc4, intensity: 0.42, position: [-0.4, 0.9, 3.6] },
  { size: [0.5, 2.6], color: 0xd0d4dc, intensity: 0.3, position: [1.2, 0.6, 3.2] },
  { size: [3.5, 0.9], color: 0xff6a30, intensity: 0.18, position: [0.3, -1.6, 3.4] },
];

function buildRoom(): Scene {
  const room = new Scene();
  for (const panel of ROOM) {
    const color = new Color(panel.color).multiplyScalar(panel.intensity);
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

function disposeScene(scene: Scene): void {
  scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      (object.material as { dispose: () => void }).dispose();
    }
  });
}

/** Must run after `renderer.init()` (done by createRenderer). */
export function createInfernalEnvironment(renderer: WebGPURenderer): Texture {
  const room = buildRoom();
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(room, 0.025);
  pmrem.dispose();
  disposeScene(room);
  return target.texture;
}

/** Haze colour (linear, as in the prototype), also the horizon colour of the sky. */
export const HAZE = new Color().setRGB(0.02, 0.009, 0.007);

/** AgX tone mapping, baked environment and haze. Returns the cleanup. */
export function applyForgeAtmosphere(renderer: WebGPURenderer, scene: Scene): () => void {
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  const environment = createInfernalEnvironment(renderer);
  scene.environment = environment;
  scene.fog = new FogExp2(HAZE, 0.022);
  return () => {
    scene.environment = null;
    scene.fog = null;
    environment.dispose();
  };
}

/** Grazing orange-red key from below and in front, weak cold rim from behind (SPEC §5.1). */
export function createForgeLights(target: Object3D): { key: SpotLight; rim: DirectionalLight } {
  const key = new SpotLight(0xff5a1f, 11, 10, 0.4, 0.7, 1.6);
  key.position.set(0.3, -0.85, 2.6);
  key.target = target;
  const rim = new DirectionalLight(0x8fb0ff, 0.5);
  rim.position.set(-1.5, 2, -2);
  return { key, rim };
}
