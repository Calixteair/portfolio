import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { PerspectiveCamera } from 'three/webgpu';
import { createLook, stepLook, viewDirection, type LookState } from '../../../system/look';
import { bindLook } from '../../../system/lookInput';
import type { PortalSystem } from './system';
import { ARRIVAL } from './window';

const MAX_FRAME_DT = 0.05;

/** The arrival view looks at the star: its yaw and pitch, the base of the 360° look. */
const BASE = { yaw: 0, pitch: Math.atan2(-ARRIVAL.y, ARRIVAL.toZ) };

type LookBinding = ReturnType<typeof bindLook>;

/** Binds the look input in an effect, exposing it to the frame loop through a holder. */
function attachLook(holder: { binding: LookBinding | null }, canvas: HTMLElement, look: LookState) {
  const binding = bindLook(canvas, look);
  holder.binding = binding;
  return () => {
    binding.dispose();
    holder.binding = null;
  };
}

/** One frame: orbits advance, the look coasts (unless dragged), the eye turns accordingly. */
function exploreFrame(
  frame: { elapsed: number; dt: number; aspect: number },
  system: PortalSystem,
  camera: PerspectiveCamera,
  look: LookState,
  binding: LookBinding,
): void {
  system.update(frame.elapsed);
  if (!binding.isDragging()) stepLook(look, Math.min(frame.dt, MAX_FRAME_DT), binding.keys);
  const [x, y, z] = viewDirection(look, BASE);
  camera.lookAt(camera.position.x + x, camera.position.y + y, camera.position.z + z);
  if (Math.abs(camera.aspect - frame.aspect) > 1e-3) {
    camera.aspect = frame.aspect;
    camera.updateProjectionMatrix();
  }
}

interface ExploreProps {
  system: PortalSystem;
  /** The portal camera, now the visitor's eye in the system. */
  eye: { current: PerspectiveCamera | null };
}

/** Once arrived: the system keeps orbiting, and the visitor looks around 360° (SPEC §5.7). */
export default function Explore({ system, eye }: ExploreProps) {
  const canvas = useThree((s) => s.gl.domElement);
  const look = useMemo(() => createLook(), []);
  const input = useMemo(() => ({ binding: null as LookBinding | null }), []);
  useEffect(() => attachLook(input, canvas, look), [input, canvas, look]);

  useFrame((state, dt) => {
    const binding = input.binding;
    if (!eye.current || !binding) return;
    const frame = {
      elapsed: state.clock.elapsedTime,
      dt,
      aspect: state.size.width / state.size.height,
    };
    exploreFrame(frame, system, eye.current, look, binding);
  });
  return null;
}
