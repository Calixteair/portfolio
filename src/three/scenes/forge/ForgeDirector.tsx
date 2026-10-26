import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { advanceJourney, type ForgeRuntime } from '../../../journey/runtime';
import { advancePortal, applyHeat, easeSwarm, setPortal, type ForgeUniforms } from './uniforms';

const MAX_FRAME_DT = 0.05; // no jump after a tab switch

interface ForgeDirectorProps {
  runtime: ForgeRuntime;
  uniforms: ForgeUniforms;
  /** Only once the visitor has entered: the forge stays cold under the loader. */
  active: boolean;
}

/** With the heat forced from the dev panel, show the swarm as if overheated near the top. */
const manualPhase = (heat: number) =>
  heat >= 0.95 ? 'portalOpen' : heat >= 0.85 ? 'overheated' : '';

/**
 * Runs the journey state machine every frame (before rendering) and feeds the shaders.
 * The current phase is mirrored on <html data-state> for e2e tests and debugging.
 */
export default function ForgeDirector({ runtime, uniforms, active }: ForgeDirectorProps) {
  const lastPhase = useRef('');
  useFrame((_, dt) => {
    if (!active) return;
    const step = Math.min(dt, MAX_FRAME_DT);
    const frame = advanceJourney(runtime, step);
    applyHeat(uniforms, frame.heat, frame.heatHistory);
    const phase = runtime.manual.enabled ? manualPhase(frame.heat) : frame.phase;
    easeSwarm(uniforms, phase, step);
    if (runtime.manual.scrubPortal) setPortal(uniforms, runtime.manual.portal);
    else advancePortal(uniforms, phase, step);
    if (frame.phase !== lastPhase.current) {
      lastPhase.current = frame.phase;
      document.documentElement.dataset.state = frame.phase;
    }
  });
  return null;
}
