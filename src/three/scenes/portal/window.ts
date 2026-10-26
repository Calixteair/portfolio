import { screenUV, texture } from 'three/tsl';
import {
  DoubleSide,
  HalfFloatType,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  RenderTarget,
  Shape,
  ShapeGeometry,
  Vector2,
  type Camera,
  type Node,
  type Object3D,
  type WebGPURenderer,
} from 'three/webgpu';
import type { Point } from '../../pendant/shape';
import { REST_ANGLE } from '../../pendant/spin';
import type { PortalSystem } from './system';

/** Render target scale (SPEC §5.5: the portal is rendered at half resolution). */
const SCALE = 0.5;

/**
 * Where the hole "is" in the portal world: about 45 m off the star, slightly above the
 * orbital plane, turned by the pendant's resting yaw so that at rest the hole frames the
 * star (turning the pendant then pans the view, as a real opening would).
 */
const ANCHOR = new Matrix4()
  .makeTranslation(0, 2.5, 45)
  .multiply(new Matrix4().makeRotationY(REST_ANGLE));

/**
 * The visitor exits the wormhole through the ring (SPEC §5.6): from just behind it to the
 * arrival point in front of it, along the line of sight to the star. Ring at z = 47.5.
 */
export const ARRIVAL = { y: 2.5, fromZ: 56, toZ: 44 } as const;

export interface PortalWindow {
  surface: Mesh;
  camera: PerspectiveCamera;
  target: RenderTarget;
  dispose: () => void;
}

/**
 * The surface filling the hole samples the portal world, rendered from a camera that keeps
 * the real camera's pose relative to the pendant: a window, with parallax when the
 * pendant turns, not a picture pasted in the hole.
 */
export function createPortalWindow(
  hole: readonly Point[],
  mask: (portal: Node<'vec4'>) => { color: Node<'vec3'>; alpha: Node<'float'> },
): PortalWindow {
  const target = new RenderTarget(2, 2, { type: HalfFloatType, depthBuffer: true });
  const geometry = new ShapeGeometry(new Shape(hole.map((p) => new Vector2(p.x, p.y))));
  const material = new MeshBasicNodeMaterial({
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const view = mask(texture(target.texture, screenUV));
  material.colorNode = view.color;
  material.opacityNode = view.alpha;
  const surface = new Mesh(geometry, material);
  surface.name = 'portal-surface';
  const camera = new PerspectiveCamera(32, 1, 0.05, 400);
  const dispose = () => {
    geometry.dispose();
    material.dispose();
    target.dispose();
  };
  return { surface, camera, target, dispose };
}

const relative = new Matrix4();
const inverse = new Matrix4();
const pose = new Matrix4();

/** Size the target at half the drawing buffer. */
export function resizePortal(win: PortalWindow, width: number, height: number): void {
  const w = Math.max(2, Math.round(width * SCALE));
  const h = Math.max(2, Math.round(height * SCALE));
  if (win.target.width !== w || win.target.height !== h) win.target.setSize(w, h);
}

/** Render the portal world as seen through the hole, into the target. */
export function renderPortal(
  renderer: WebGPURenderer,
  win: PortalWindow,
  system: PortalSystem,
  eye: { camera: Camera; pendant: Object3D; elapsed: number },
): void {
  inverse.copy(eye.pendant.matrixWorld).invert();
  relative.multiplyMatrices(inverse, eye.camera.matrixWorld);
  // Set the pose through position/quaternion: the renderer rebuilds matrixWorld from them.
  pose.multiplyMatrices(ANCHOR, relative);
  pose.decompose(win.camera.position, win.camera.quaternion, win.camera.scale);
  win.camera.updateMatrixWorld();
  win.camera.projectionMatrix.copy(eye.camera.projectionMatrix);
  win.camera.projectionMatrixInverse.copy(eye.camera.projectionMatrixInverse);
  system.update(eye.elapsed);
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(win.target);
  renderer.render(system.scene, win.camera);
  renderer.setRenderTarget(previous);
}

/**
 * Arrival pose (SPEC §5.6, end of the dive): on the axis through the ring, facing the star
 * with a natural field of view (the vertigo FOV of the dive is left behind).
 */
export function poseArrival(camera: PerspectiveCamera, aspect: number, z: number): void {
  camera.position.set(0, ARRIVAL.y, z);
  camera.lookAt(0, 0, 0);
  camera.fov = 50;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
