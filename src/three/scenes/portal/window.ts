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
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import type { Point } from '../../pendant/shape';
import { QUALITY, type LiveQuality } from '../../quality';
import { REST_ANGLE } from '../../pendant/spin';
import type { PortalSystem } from './system';
import { fitCamera } from '../../framing';

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
  /** Field of view once settled in the system. */
  fov: 50,
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

/**
 * Size a window's target to a fraction of the drawing buffer (SPEC §5.5: half resolution,
 * less on the low quality tier). A no-op when unchanged, so it can run every frame.
 */
export function resizeTarget(target: RenderTarget, width: number, height: number, scale: number) {
  const w = Math.max(2, Math.round(width * scale));
  const h = Math.max(2, Math.round(height * scale));
  if (target.width !== w || target.height !== h) target.setSize(w, h);
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

/** Keep a window's target at the live tier's scale of the drawing buffer (every frame). */
export function fitWindow(
  target: RenderTarget,
  state: { size: { width: number; height: number }; viewport: { dpr: number } },
  quality: LiveQuality,
): void {
  const { width, height } = state.size;
  const dpr = state.viewport.dpr;
  resizeTarget(target, width * dpr, height * dpr, QUALITY[quality.tier].portalScale);
}

/**
 * Arrival pose (SPEC §5.6, end of the dive): on the axis through the ring, facing the star.
 * `fov` lets the exit start from the tunnel's field of view, then settle to a natural one.
 */
export function poseArrival(
  camera: PerspectiveCamera,
  aspect: number,
  distance: number,
  fov: number = ARRIVAL.fov,
): void {
  arrivalPoint(distance, camera.position);
  camera.lookAt(0, 0, 0);
  camera.fov = fov;
  fitCamera(camera, aspect);
  camera.updateMatrixWorld();
}

/**
 * Render `scene` from `camera` into `target`, with the projection of `lens` (the camera
 * whose screen the target is sampled in): a window shows exactly what full screen would.
 */
export function renderView(
  renderer: WebGPURenderer,
  target: RenderTarget,
  view: { scene: Scene; camera: PerspectiveCamera },
  lens: Camera,
): void {
  view.camera.projectionMatrix.copy(lens.projectionMatrix);
  view.camera.projectionMatrixInverse.copy(lens.projectionMatrixInverse);
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(view.scene, view.camera);
  renderer.setRenderTarget(previous);
}
