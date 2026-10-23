import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Object3D } from 'three/webgpu';
import { bindDragSpin, type DragController } from '../../pendant/dragSpin';
import { createPendant } from '../../pendant/placeholder';
import { SPIN, breathingTilt, createSpin, impulseSpin, stepSpin } from '../../pendant/spin';

const MAX_FRAME_DT = 0.05; // no jump after a tab switch

function pose(object: Object3D, tilt: number, yaw: number): void {
  object.rotation.set(tilt, yaw, 0);
}

/**
 * The procedural placeholder (the final GLB will replace createPendant() only), turned by
 * drags anywhere and pushed by clicks on the pendant itself, with inertia.
 */
export default function Pendant() {
  const pendant = useMemo(() => createPendant(), []);
  const spin = useMemo(() => createSpin(), []);
  const drag = useRef<DragController | null>(null);
  const canvas = useThree((s) => s.gl.domElement);
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => pendant.dispose, [pendant]);
  useEffect(() => {
    const controller = bindDragSpin(canvas, spin);
    drag.current = controller;
    return controller.dispose;
  }, [canvas, spin]);

  useFrame((state, dt) => {
    if (!drag.current?.isDragging()) stepSpin(spin, Math.min(dt, MAX_FRAME_DT));
    pose(pendant.group, breathingTilt(state.clock.elapsedTime, reducedMotion), spin.angle);
  });

  const strike = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta <= SPIN.clickSlop) impulseSpin(spin);
  };

  return <primitive object={pendant.group} onClick={strike} />;
}
