import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { StageView } from '../stage';
import { useWebGPU } from '../useWebGPU';
import { createLensPipeline, renderLens, type LensUniforms } from './lens';

interface LensEffectsProps {
  uniforms: LensUniforms;
  /** Scene and camera to render instead of R3F's own (wormhole, planetary system). */
  stage: StageView;
}

/** Takes over R3F's render loop (positive useFrame priority) to render through the lens pipeline. */
export default function LensEffects({ uniforms, stage }: LensEffectsProps) {
  const { gl, scene, camera } = useWebGPU();
  const lens = useMemo(
    () => createLensPipeline(gl, scene, camera, uniforms),
    [gl, scene, camera, uniforms],
  );

  useEffect(() => () => lens.pipeline.dispose(), [lens]);
  useFrame(() => renderLens(lens, stage, { scene, camera }), 1);
  return null;
}
