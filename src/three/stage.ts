import type { Camera, Scene } from 'three/webgpu';

/**
 * What the main pipeline renders. Null means R3F's own scene and camera (the forge); the
 * wormhole dive switches it to the tunnel, then to the planetary system (SPEC §5.6).
 */
export interface StageView {
  scene: Scene | null;
  camera: Camera | null;
}

export function createStageView(): StageView {
  return { scene: null, camera: null };
}

export function showStage(view: StageView, scene: Scene | null, camera: Camera | null): void {
  view.scene = scene;
  view.camera = camera;
}
