import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { WebGPURenderer } from 'three/webgpu';
import { useLoader } from '../loader/useLoader';
import '../three/extend';
import Precompile from '../three/Precompile';
import LensEffects from '../three/post/LensEffects';
import { backendOf, createRenderer, supports3D, type Backend } from '../three/renderer';
import ForgeDirector from '../three/scenes/forge/ForgeDirector';
import ForgeLighting from '../three/scenes/forge/ForgeLighting';
import ForgeWorld from '../three/scenes/forge/ForgeWorld';
import Pendant from '../three/scenes/forge/Pendant';
import Sparks from '../three/scenes/forge/Sparks';
import Swarm from '../three/scenes/forge/Swarm';
import Portal from '../three/scenes/portal/Portal';
import Dive from '../three/scenes/wormhole/Dive';
import Wormhole from '../three/scenes/wormhole/Wormhole';
import BackendBadge from './BackendBadge';
import RenderErrorBoundary from './RenderErrorBoundary';
import { useWorld } from './useWorld';

const noop = () => {};

// Dev-only tuning panel: the dynamic import is dropped from the production build.
const DevControls = import.meta.env.DEV ? lazy(() => import('../dev/DevControls')) : null;

/**
 * Root of the 3D island: the forge scene with the pendant at its centre. It drives the
 * static loader: nothing renders until the shaders are compiled, then "Entrer" appears.
 */
export default function Experience() {
  const loader = useLoader();
  const supported = useMemo(() => supports3D(), []);
  const [frameloop, setFrameloop] = useState<'never' | 'always'>('never');
  const [backend, setBackend] = useState<Backend | null>(null);
  const world = useWorld();
  const { lens, forge, lights, pendant, runtime, stage, system, tunnel } = world;
  const entered = loader.phase === 'entered';
  const startRendering = useCallback(() => setFrameloop('always'), []);
  const { fail, reach } = loader;

  useEffect(() => {
    if (!supported) fail(new Error('Neither WebGPU nor WebGL 2 is available'));
  }, [supported, fail]);
  if (!supported) return null;

  return (
    <RenderErrorBoundary onError={fail}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 2]}
        // Drags turn the pendant: no browser panning or zooming on touch screens.
        style={{ touchAction: 'none', cursor: 'grab' }}
        camera={{ fov: 32, near: 0.05, far: 400, position: [0, 0.18, 3.3] }}
        gl={createRenderer}
        onCreated={({ gl, camera }) => {
          camera.lookAt(0, 0.02, 0);
          const active = backendOf(gl as unknown as WebGPURenderer);
          // Exposed for e2e tests and debugging: which backend actually runs.
          document.documentElement.dataset.backend = active;
          setBackend(active);
          reach('renderer');
        }}
      >
        <ForgeLighting lights={lights} uniforms={forge} />
        <ForgeWorld uniforms={forge} />
        <ForgeDirector runtime={runtime} uniforms={forge} active={entered} />
        <Pendant
          pendant={pendant}
          spin={runtime.spin}
          journey={runtime.journey}
          interactive={entered}
          onStrike={world.onStrike}
        />
        <Sparks pendant={pendant} forge={forge} spin={runtime.spin} />
        <Swarm pendant={pendant} forge={forge} />
        <Portal
          pendant={pendant}
          forge={forge}
          system={system}
          frozen={world.frozen}
          onReady={world.setPortalCamera}
        />
        <Wormhole runtime={runtime} stage={stage} tunnel={tunnel} />
        <Dive
          runtime={runtime}
          pendant={pendant}
          lens={lens}
          tunnel={tunnel}
          stage={stage}
          system={system}
          portalCamera={world.portalCamera}
          frozen={world.frozen}
          loadAnimation={entered}
          bind={world.bindDive}
          onArrived={noop}
        />
        <LensEffects uniforms={lens} stage={stage} />
        {DevControls && (
          <Suspense fallback={null}>
            <DevControls
              runtime={runtime}
              lens={lens}
              lights={lights}
              steel={pendant.body.material}
            />
          </Suspense>
        )}
        <Precompile onStage={reach} onCompiled={startRendering} onError={fail} />
      </Canvas>
      {import.meta.env.DEV && backend && <BackendBadge backend={backend} />}
    </RenderErrorBoundary>
  );
}
