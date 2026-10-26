import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PerspectiveCamera } from 'three/webgpu';
import { strike } from '../journey/machine';
import { createForgeRuntime } from '../journey/runtime';
import { createPendant } from '../three/pendant/placeholder';
import { createLensUniforms } from '../three/post/lens';
import { createForgeLights } from '../three/scenes/forge/lighting';
import { createForgeUniforms } from '../three/scenes/forge/uniforms';
import { createPortalSystem } from '../three/scenes/portal/system';
import { createTunnel } from '../three/scenes/wormhole/tunnel';
import { createDiveReadiness } from '../three/readiness';
import { createStageView } from '../three/stage';
import type { SystemEntry } from '../system/layout';

/**
 * Every long-lived object of the experience, built once and passed down by reference (the
 * dev panel and the dive act on these exact objects; nothing goes through React state).
 */
export function useWorld(entries: SystemEntry[]) {
  const lens = useMemo(() => createLensUniforms(), []);
  const forge = useMemo(() => createForgeUniforms(), []);
  const lights = useMemo(() => createForgeLights(), []);
  const pendant = useMemo(() => createPendant(forge), [forge]);
  const runtime = useMemo(() => createForgeRuntime(), []);
  const stage = useMemo(() => createStageView(), []);
  const system = useMemo(() => createPortalSystem(entries), [entries]);
  const tunnel = useMemo(() => createTunnel(), []);
  const portalCamera = useRef<PerspectiveCamera | null>(null);
  const frozen = useMemo(() => ({ value: false }), []);
  const readiness = useMemo(() => createDiveReadiness(), []);
  const dive = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      system.dispose();
      tunnel.dispose();
    },
    [system, tunnel],
  );

  /** Click or Space on the pendant: heat it, or dive in once the portal is open. */
  const onStrike = useCallback(() => {
    if (runtime.journey.phase === 'portalOpen') dive.current?.();
    else strike(runtime.journey, runtime.rules);
  }, [runtime]);
  const bindDive = useCallback((start: () => void) => {
    dive.current = start;
  }, []);
  const setPortalCamera = useCallback((camera: PerspectiveCamera) => {
    portalCamera.current = camera;
  }, []);

  return {
    lens,
    forge,
    lights,
    pendant,
    runtime,
    stage,
    system,
    tunnel,
    portalCamera,
    frozen,
    readiness,
    onStrike,
    bindDive,
    setPortalCamera,
  };
}
