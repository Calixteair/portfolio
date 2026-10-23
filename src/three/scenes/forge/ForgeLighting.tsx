import { useEffect } from 'react';
import { useWebGPU } from '../../useWebGPU';
import { applyForgeAtmosphere, type ForgeLights } from './lighting';

/** Environment, tone mapping, fog and the two forge lights, all aimed at the origin. */
export default function ForgeLighting({ lights }: { lights: ForgeLights }) {
  const { gl, scene } = useWebGPU();
  useEffect(() => applyForgeAtmosphere(gl, scene), [gl, scene]);
  return (
    <>
      <primitive object={lights.target} />
      <primitive object={lights.key} />
      <primitive object={lights.rim} />
    </>
  );
}
