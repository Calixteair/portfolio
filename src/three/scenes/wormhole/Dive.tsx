import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { PerspectiveCamera } from 'three/webgpu';
import { createDiveController, type DiveSetup } from './dive';

interface DiveProps extends DiveSetup {
  /** Fetch GSAP once true (after Entrer): out of the startup bundle, ready on click. */
  loadAnimation: boolean;
  /** Receives the dive trigger: the pendant's click and Space call it on the open portal. */
  bind: (start: () => void) => void;
}

/** Click, Space (both via the pendant) or Enter on the open portal: the dive (SPEC §5.6). */
export default function Dive({ loadAnimation, bind, ...setup }: DiveProps) {
  const camera = useThree((s) => s.camera) as unknown as PerspectiveCamera;
  // The setup objects are stable (built once in useWorld): the controller is built once too.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dive = useMemo(() => createDiveController(setup, camera), [camera]);

  useEffect(() => {
    if (!loadAnimation) return;
    import('gsap')
      .then((m) => dive.setGsap(m.gsap))
      .catch((error: unknown) => console.error('[dive] GSAP failed to load', error));
  }, [loadAnimation, dive]);

  useEffect(() => {
    bind(dive.start);
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Enter') dive.start();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [bind, dive]);

  useFrame((state) => setup.tunnel.resize(state.size.width / state.size.height));
  return null;
}
