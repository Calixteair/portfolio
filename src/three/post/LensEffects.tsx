import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { PerspectiveCamera, Scene } from 'three/webgpu';
import { markReady, type DiveReadiness } from '../readiness';
import type { StageView } from '../stage';
import { useWebGPU } from '../useWebGPU';
import { warmFrame, createLensPipeline, renderLens, type LensUniforms } from './lens';

interface LensEffectsProps {
  uniforms: LensUniforms;
  /** Scene and camera to render instead of R3F's own (wormhole, planetary system). */
  stage: StageView;
  /** Scenes the dive will show full screen, compiled ahead for this pipeline. */
  warmUp: {
    /** Each with the camera that will show it (null until it exists). */
    views: Array<{ scene: Scene; camera: { current: PerspectiveCamera | null } }>;
    readiness: DiveReadiness;
  };
}

type WarmView = LensEffectsProps['warmUp']['views'][number];

/**
 * While the loader still covers the canvas, the first frames show the dive's scenes, one
 * per frame (see warmFrame). Returns whether this frame was one of them.
 */
function warmNext(
  queue: WarmView[],
  lens: ReturnType<typeof createLensPipeline>,
  readiness: DiveReadiness,
): boolean {
  const next = queue[0];
  if (!next?.camera.current) return false;
  warmFrame(lens, { scene: next.scene, camera: next.camera.current });
  queue.shift();
  if (queue.length === 0) markReady(readiness, 'lens');
  return true;
}

/** Takes over R3F's render loop (positive useFrame priority) to render through the lens pipeline. */
export default function LensEffects({ uniforms, stage, warmUp }: LensEffectsProps) {
  const { gl, scene, camera } = useWebGPU();
  const lens = useMemo(
    () => createLensPipeline(gl, scene, camera, uniforms),
    [gl, scene, camera, uniforms],
  );

  useEffect(() => () => lens.pipeline.dispose(), [lens]);
  const queue = useMemo(() => [...warmUp.views], [warmUp]);
  useFrame(() => {
    if (!warmNext(queue, lens, warmUp.readiness)) renderLens(lens, stage, { scene, camera });
  }, 1);
  return null;
}
