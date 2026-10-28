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

/** Where a body's panel opens (EntryArticle.astro, same 4:5 breakpoint in CSS). */
export type PanelSide = 'right' | 'bottom';

export function panelSide(aspect: number): PanelSide {
  return aspect <= MIN_ASPECT ? 'bottom' : 'right';
}

/**
 * The bottom drawer covers at most the lower half of the screen: the body is framed at the
 * centre of the upper half (NDC y = 0.5).
 */
export const DRAWER_RISE = 0.5;

/** Orbit distance factor above a drawer: the body has half the screen's height to fit in. */
export const DRAWER_BACKOFF = 1.6;
