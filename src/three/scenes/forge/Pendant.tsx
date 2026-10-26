import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Object3D } from 'three/webgpu';
import type { JourneyState } from '../../../journey/machine';
import { alignWire, projectWire } from '../../../loader/wire';
import { bindDragSpin, type DragController } from '../../pendant/dragSpin';
import type { Pendant as PendantModel } from '../../pendant/placeholder';
import {
  SPIN,
  breathingTilt,
  impulseSpin,
  settleSpin,
  stepSpin,
  type SpinState,
} from '../../pendant/spin';

const MAX_FRAME_DT = 0.05; // no jump after a tab switch
/** Resting three-quarter view; the pendant starts face-on to match the loader outline. */
const REST_ANGLE = 0.35;

/** Amplitude of the overheat tremor (SPEC §2), none with prefers-reduced-motion. */
const SHAKE = 0.0025;

function pose(object: Object3D, tilt: number, yaw: number, shake: number): void {
  object.rotation.set(tilt, yaw, 0);
  object.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0);
}

interface PendantProps {
  pendant: PendantModel;
  spin: SpinState;
  journey: JourneyState;
  /** False under the loader: no input until "Entrer". */
  interactive: boolean;
  /** A click on the pendant itself (not a drag): heats it (SPEC §2). */
  onStrike: () => void;
}

/**
 * Mounts the pendant (procedural placeholder now, the artist's GLB later: same interface),
 * turned by drags anywhere and pushed by clicks on the pendant itself, with inertia.
 * Face-on under the loader, it coasts to its three-quarter view once the visitor enters.
 */
export default function Pendant({ pendant, spin, journey, interactive, onStrike }: PendantProps) {
  const drag = useRef<DragController | null>(null);
  /** Clock time of "Entrer": breathing starts from there, smoothly (sin(0) = 0). */
  const enteredAt = useRef<number | null>(null);
  const canvas = useThree((s) => s.gl.domElement);
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => pendant.dispose, [pendant]);
  useEffect(() => {
    if (!interactive) return;
    settleSpin(spin, REST_ANGLE);
    const controller = bindDragSpin(canvas, spin);
    drag.current = controller;
    return controller.dispose;
  }, [canvas, spin, interactive]);

  useFrame((state, dt) => {
    if (!drag.current?.isDragging()) stepSpin(spin, Math.min(dt, MAX_FRAME_DT));
    const t = state.clock.elapsedTime;
    if (interactive && enteredAt.current === null) enteredAt.current = t;
    // Still under the loader: no breathing, so the wire (and Entrer below it) stays put.
    const breathing = enteredAt.current === null ? 0 : t - enteredAt.current;
    const shake = journey.phase === 'overheated' && !reducedMotion ? SHAKE : 0;
    pose(pendant.group, breathingTilt(breathing, reducedMotion), spin.angle, shake);
    // Under the loader, keep its wire exactly on the pendant's outline (handoff, SPEC §4).
    if (!interactive) {
      pendant.group.updateMatrixWorld();
      alignWire(projectWire(pendant.group, state.camera, state.size));
    }
  });

  const strike = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!interactive || e.delta > SPIN.clickSlop) return;
    impulseSpin(spin);
    onStrike();
  };

  return <primitive object={pendant.group} onClick={strike} />;
}
