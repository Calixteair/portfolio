import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { useWebGPU } from '../useWebGPU';
import { createLensPipeline, type LensUniforms } from './lens';

/** Takes over R3F's render loop (positive useFrame priority) to render through the lens pipeline. */
export default function LensEffects({ uniforms }: { uniforms: LensUniforms }) {
  const { gl, scene, camera } = useWebGPU();
  const pipeline = useMemo(
    () => createLensPipeline(gl, scene, camera, uniforms),
    [gl, scene, camera, uniforms],
  );

  useEffect(() => () => pipeline.dispose(), [pipeline]);
  useFrame(() => pipeline.render(), 1);
  return null;
}
