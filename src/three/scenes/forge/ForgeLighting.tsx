import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Object3D, type Scene, type WebGPURenderer } from 'three/webgpu';
import { applyForgeAtmosphere, createForgeLights } from './lighting';

/** Environment, tone mapping, fog and the two forge lights, all aimed at the origin. */
export default function ForgeLighting() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene) as unknown as Scene;
  const target = useMemo(() => new Object3D(), []);
  const lights = useMemo(() => createForgeLights(target), [target]);

  useEffect(() => applyForgeAtmosphere(gl, scene), [gl, scene]);

  return (
    <>
      <primitive object={target} />
      <primitive object={lights.key} />
      <primitive object={lights.rim} />
    </>
  );
}
