import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { Camera, Scene, WebGPURenderer } from 'three/webgpu';
import { createLensPipeline, type LensUniforms } from './lens';

/** Takes over R3F's render loop (positive useFrame priority) to render through the lens pipeline. */
export default function LensEffects({ uniforms }: { uniforms: LensUniforms }) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene) as unknown as Scene;
  const camera = useThree((s) => s.camera) as unknown as Camera;
  const pipeline = useMemo(
    () => createLensPipeline(gl, scene, camera, uniforms),
    [gl, scene, camera, uniforms],
  );

  useEffect(() => () => pipeline.dispose(), [pipeline]);
  useFrame(() => pipeline.render(), 1);
  return null;
}
