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
  Vector3,
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
 * The arrival axis: the visitor exits the wormhole through the ring (SPEC §5.6) along this
 * line of sight to the star, ~25° above the orbital plane so the orbits spread out instead
 * of stacking on the horizon. Distances from the star: glide from `from` to `to`; the ring
 * stands at `ring`.
 */
export const ARRIVAL = {
  axis: new Vector3(0, 0.42, 0.91).normalize(),
  from: 56,
  to: 44,
  ring: 47.5,
} as const;

/** A point on the arrival axis, `distance` from the star. */
export function arrivalPoint(distance: number, out = new Vector3()): Vector3 {
  return out.copy(ARRIVAL.axis).multiplyScalar(distance);
}

/**
 * Where the hole "is" in the portal world: on the arrival axis, facing the star, turned by
 * the pendant's resting yaw so that at rest the hole frames the star (turning the pendant
 * then pans the view, as a real opening would).
 */
const ANCHOR = new Matrix4()
  .lookAt(arrivalPoint(45), new Vector3(), new Vector3(0, 1, 0))
  .setPosition(arrivalPoint(45))
  .multiply(new Matrix4().makeRotationY(REST_ANGLE));

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
export function poseArrival(camera: PerspectiveCamera, aspect: number, distance: number): void {
  arrivalPoint(distance, camera.position);
  camera.lookAt(0, 0, 0);
  camera.fov = 50;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
