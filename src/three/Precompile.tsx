import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Stage } from '../loader/progress';
import { useWebGPU } from './useWebGPU';

/** Frames rendered under the loader before "Entrer": the post pipeline compiles on the first. */
const WARMUP_FRAMES = 2;

interface PrecompileProps {
  onStage: (stage: Stage) => void;
  /** Starts the render loop, which stays stopped while the shaders compile. */
  onCompiled: () => void;
  onError: (error: unknown) => void;
}

/**
 * Mount last inside the Canvas, so every scene object exists. Compiles all materials
 * asynchronously (SPEC §4: before hiding the loader) instead of stalling on the first frame,
 * then renders a few hidden frames before reporting the scene ready.
 */
export default function Precompile({ onStage, onCompiled, onError }: PrecompileProps) {
  const { gl, scene, camera } = useWebGPU();
  const frames = useRef(-1);

  useEffect(() => {
    let alive = true;
    onStage('scene');
    // No downloaded asset yet (procedural placeholder): drei's useProgress joins with the GLB.
    onStage('assets');
    gl.compileAsync(scene, camera)
      .then(() => {
        if (!alive) return;
        frames.current = 0;
        onCompiled();
      })
      .catch((error: unknown) => alive && onError(error));
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, onStage, onCompiled, onError]);

  useFrame(() => {
    if (frames.current < 0 || frames.current >= WARMUP_FRAMES) return;
    frames.current += 1;
    if (frames.current === WARMUP_FRAMES) onStage('compiled');
  });
  return null;
}
