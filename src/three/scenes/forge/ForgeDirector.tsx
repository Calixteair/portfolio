import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { advanceJourney, type ForgeRuntime } from '../../../journey/runtime';
import { applyHeat, type ForgeUniforms } from './uniforms';

const MAX_FRAME_DT = 0.05; // no jump after a tab switch

interface ForgeDirectorProps {
  runtime: ForgeRuntime;
  uniforms: ForgeUniforms;
  /** Only once the visitor has entered: the forge stays cold under the loader. */
  active: boolean;
}

/**
 * Runs the journey state machine every frame (before rendering) and feeds the shaders.
 * The current phase is mirrored on <html data-state> for e2e tests and debugging.
 */
export default function ForgeDirector({ runtime, uniforms, active }: ForgeDirectorProps) {
  const lastPhase = useRef('');
  useFrame((_, dt) => {
    if (!active) return;
    const frame = advanceJourney(runtime, Math.min(dt, MAX_FRAME_DT));
    applyHeat(uniforms, frame.heat, frame.heatHistory);
    if (frame.phase !== lastPhase.current) {
      lastPhase.current = frame.phase;
      document.documentElement.dataset.state = frame.phase;
    }
  });
  return null;
}
