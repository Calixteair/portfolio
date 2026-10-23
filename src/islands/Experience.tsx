import { Canvas } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import type { WebGPURenderer } from 'three/webgpu';
import '../three/extend';
import LensEffects from '../three/post/LensEffects';
import { createLensUniforms } from '../three/post/lens';
import { backendOf, createRenderer, type Backend } from '../three/renderer';
import ForgeLighting from '../three/scenes/forge/ForgeLighting';
import Pendant from '../three/scenes/forge/Pendant';
import BackendBadge from './BackendBadge';

/** Root of the 3D island: the forge scene with the pendant at its centre. */
export default function Experience() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const lens = useMemo(() => createLensUniforms(), []);

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 32, near: 0.05, far: 400, position: [0, 0.18, 3.3] }}
        gl={createRenderer}
        onCreated={({ gl, camera }) => {
          camera.lookAt(0, 0.02, 0);
          const active = backendOf(gl as unknown as WebGPURenderer);
          // Exposed for e2e tests and debugging: which backend actually runs.
          document.documentElement.dataset.backend = active;
          setBackend(active);
        }}
      >
        <color attach="background" args={['#050302']} />
        <ForgeLighting />
        <Pendant />
        <LensEffects uniforms={lens} />
      </Canvas>
      {import.meta.env.DEV && backend && <BackendBadge backend={backend} />}
    </>
  );
}
