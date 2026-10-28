import type { PerspectiveCamera } from 'three/webgpu';

/**
 * Narrowest screen the scenes are framed for. Narrower (a phone held upright), the view
 * widens instead of cropping the sides: the pendant and the system keep their margins.
 */
export const MIN_ASPECT = 0.8;

/**
 * Zoom (< 1 widens) that keeps the horizontal field of view of a `MIN_ASPECT` screen.
 * Through `camera.zoom`, not the FOV: the dive tweens and copies FOVs between cameras,
 * and every camera given the same aspect gets the same zoom, so the hand-offs still match.
 */
export function fitZoom(aspect: number): number {
  return Math.min(1, aspect / MIN_ASPECT);
}

/** Sets the camera's aspect and the matching zoom, then its projection. */
export function fitCamera(camera: PerspectiveCamera, aspect: number): void {
  camera.aspect = aspect;
  camera.zoom = fitZoom(aspect);
  camera.updateProjectionMatrix();
}
