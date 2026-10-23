import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { useWebGPU } from '../../useWebGPU';
import { applyForgeAtmosphere, driveForgeLights, type ForgeLights } from './lighting';
import type { ForgeUniforms } from './uniforms';

interface ForgeLightingProps {
  lights: ForgeLights;
  uniforms: ForgeUniforms;
}

/** Environment, tone mapping, fog and the two forge lights; the warmth follows the heat. */
export default function ForgeLighting({ lights, uniforms }: ForgeLightingProps) {
  const { gl, scene } = useWebGPU();
  useEffect(() => applyForgeAtmosphere(gl, scene, uniforms.heat), [gl, scene, uniforms]);
  useFrame(() => driveForgeLights(lights, uniforms.heat.value));
  return (
    <>
      <primitive object={lights.target} />
      <primitive object={lights.key} />
      <primitive object={lights.rim} />
    </>
  );
}
