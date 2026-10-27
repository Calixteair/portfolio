import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WebGPURenderer } from 'three/webgpu';
import { useLoader } from '../loader/useLoader';
import '../three/extend';
import Precompile from '../three/Precompile';
import Quality from '../three/Quality';
import LensEffects from '../three/post/LensEffects';
import { backendOf, createRenderer, supports3D, type Backend } from '../three/renderer';
import Explore from '../three/scenes/portal/Explore';
import Dive from '../three/scenes/wormhole/Dive';
import Wormhole from '../three/scenes/wormhole/Wormhole';
import BackendBadge from './BackendBadge';
import BodyLabel from './BodyLabel';
import Forge from './Forge';
import type { SystemEntry } from '../system/layout';
import RenderErrorBoundary from './RenderErrorBoundary';
import { useWorld } from './useWorld';

// Dev-only tuning panel: the dynamic import is dropped from the production build.
const DevControls = import.meta.env.DEV ? lazy(() => import('../dev/DevControls')) : null;

/**
 * Root of the 3D island: the forge scene with the pendant at its centre. It drives the
 * static loader: nothing renders until the shaders are compiled, then "Entrer" appears.
 */
export default function Experience({ entries }: { entries: SystemEntry[] }) {
  const loader = useLoader();
  const supported = useMemo(() => supports3D(), []);
  const [frameloop, setFrameloop] = useState<'never' | 'always'>('never');
  const [backend, setBackend] = useState<Backend | null>(null);
  // Driven by the quality monitor (a few changes per visit, never per frame).
  const [dpr, setDpr] = useState(1);
  const world = useWorld(entries);
  const { lens, lights, pendant, runtime, stage, system, tunnel } = world;
  const entered = loader.phase === 'entered';
  // A shared link to a body (#slug): no intro, the visitor came for that body.
  const linked = useMemo(() => entries.some((e) => `#${e.slug}` === location.hash), [entries]);
  const startRendering = useCallback(() => setFrameloop('always'), []);
  // Past the wormhole, the forge is never seen again: unmounting it releases its GPU
  // resources (SPEC §5.6, CLAUDE.md: dispose left scenes).
  const [arrived, setArrived] = useState(false);
  const onArrived = useCallback(() => setArrived(true), []);
  const texts = useMemo(() => new Map(entries.map((e) => [e.slug, e])), [entries]);
  const labelRef = useRef<HTMLDivElement>(null);
  const { fail, reach } = loader;

  useEffect(() => {
    if (!supported) fail(new Error('Neither WebGPU nor WebGL 2 is available'));
  }, [supported, fail]);
  if (!supported) return null;

  return (
    <RenderErrorBoundary onError={fail}>
      <Canvas
        frameloop={frameloop}
        dpr={dpr}
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
        {!arrived && <Forge world={world} entered={entered} />}
        {arrived && (
          <Explore
            system={system}
            eye={world.portalCamera}
            texts={texts}
            label={labelRef}
            lens={lens}
          />
        )}
        <Wormhole
          runtime={runtime}
          stage={stage}
          tunnel={tunnel}
          readiness={world.readiness}
          system={system}
          eye={world.portalCamera}
          dive={world.dive}
          quality={world.quality}
        />
        <Dive
          runtime={runtime}
          pendant={pendant}
          lens={lens}
          tunnel={tunnel}
          stage={stage}
          system={system}
          portalCamera={world.portalCamera}
          frozen={world.frozen}
          readiness={world.readiness}
          view={world.dive}
          portalOpen={world.forge.portal}
          loadAnimation={entered}
          bind={world.bindDive}
          skip={entered && (loader.skipped || linked)}
          onArrived={onArrived}
        />
        <Quality live={world.quality} setDpr={setDpr} />
        <LensEffects uniforms={lens} stage={stage} warmUp={world.warmUp} />
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
      <BodyLabel ref={labelRef} />
      {import.meta.env.DEV && backend && <BackendBadge backend={backend} />}
    </RenderErrorBoundary>
  );
}
