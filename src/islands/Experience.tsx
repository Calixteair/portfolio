import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import type { WebGPURenderer } from 'three/webgpu';
import '../three/extend';
import { backendOf, createRenderer, type Backend } from '../three/renderer';
import ComputeProbe from '../three/scenes/forge/ComputeProbe';
import BackendBadge from './BackendBadge';

/** Root of the 3D island. Empty scene for now: proves Astro → React → R3F → WebGPU wiring. */
export default function Experience() {
  const [backend, setBackend] = useState<Backend | null>(null);

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 32, position: [0, 0, 3.3] }}
        gl={createRenderer}
        onCreated={({ gl }) => {
          const active = backendOf(gl as unknown as WebGPURenderer);
          // Exposed for e2e tests and debugging: which backend actually runs.
          document.documentElement.dataset.backend = active;
          setBackend(active);
        }}
      >
        <color attach="background" args={['#050302']} />
        <mesh>
          <boxGeometry args={[0.6, 0.9, 0.08]} />
          <meshNormalMaterial />
        </mesh>
        <ComputeProbe />
      </Canvas>
      {import.meta.env.DEV && backend && <BackendBadge backend={backend} />}
    </>
  );
}
