import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { PerspectiveCamera } from 'three/webgpu';
import { createLook, stepLook, viewDirection, type LookState } from '../../../system/look';
import { bindLook } from '../../../system/lookInput';
import type { PortalSystem } from './system';
import { hideLabel, showLabel, type LabelText } from './label';
import { pickBody, screenPoint } from './picking';
import { ARRIVAL } from './window';

const MAX_FRAME_DT = 0.05;

/** The arrival view looks at the star: its yaw and pitch, the base of the 360° look. */
const BASE = { yaw: 0, pitch: Math.atan2(-ARRIVAL.y, ARRIVAL.toZ) };

type LookBinding = ReturnType<typeof bindLook>;

/** Binds the look input in an effect, exposing it to the frame loop through a holder. */
function attachLook(
  holder: { binding: LookBinding | null; hovered: string | null },
  canvas: HTMLElement,
  look: LookState,
  onPick: (slug: string) => void,
) {
  const binding = bindLook(canvas, look, () => {
    if (holder.hovered) onPick(holder.hovered);
  });
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

/** Hover: pick the body under the pointer, label it, show a pointer cursor. */
function hoverFrame(
  holder: { binding: LookBinding | null; hovered: string | null },
  scene: {
    system: PortalSystem;
    camera: PerspectiveCamera;
    size: { width: number; height: number };
  },
  ui: { label: HTMLElement | null; canvas: HTMLElement; texts: ReadonlyMap<string, LabelText> },
): void {
  const pointer = holder.binding?.isDragging() ? null : holder.binding?.hover.pointer;
  const objects = scene.system.bodies.objects;
  const slug = pointer ? pickBody(pointer, scene.camera, objects.values()) : null;
  holder.hovered = slug;
  ui.canvas.style.cursor = slug ? 'pointer' : 'grab';
  const object = slug ? objects.get(slug) : undefined;
  const text = slug ? ui.texts.get(slug) : undefined;
  const at = object ? screenPoint(object, scene.camera, scene.size) : null;
  if (!ui.label) return;
  if (slug && text && at) showLabel(ui.label, slug, text, at);
  else hideLabel(ui.label);
}

interface ExploreProps {
  system: PortalSystem;
  /** Titles and summaries by slug, for the hover label. */
  texts: ReadonlyMap<string, LabelText>;
  label: { current: HTMLElement | null };
  onPick: (slug: string) => void;
  /** The portal camera, now the visitor's eye in the system. */
  eye: { current: PerspectiveCamera | null };
}

/** Once arrived: the system keeps orbiting, and the visitor looks around 360° (SPEC §5.7). */
export default function Explore({ system, eye, texts, label, onPick }: ExploreProps) {
  const canvas = useThree((s) => s.gl.domElement);
  const look = useMemo(() => createLook(), []);
  const input = useMemo(
    () => ({ binding: null as LookBinding | null, hovered: null as string | null }),
    [],
  );
  useEffect(() => attachLook(input, canvas, look, onPick), [input, canvas, look, onPick]);

  useFrame((state, dt) => {
    const binding = input.binding;
    if (!eye.current || !binding) return;
    const frame = {
      elapsed: state.clock.elapsedTime,
      dt,
      aspect: state.size.width / state.size.height,
    };
    exploreFrame(frame, system, eye.current, look, binding);
    hoverFrame(
      input,
      { system, camera: eye.current, size: state.size },
      { label: label.current, canvas, texts },
    );
  });
  return null;
}
