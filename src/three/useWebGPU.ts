import { useThree } from '@react-three/fiber';
import type { Camera, Scene, WebGPURenderer } from 'three/webgpu';

/**
 * R3F types its state with the WebGL classes from `three`; this app always runs a
 * WebGPURenderer (WebGPU or its WebGL 2 backend), so the cast lives here, once.
 */
export function useWebGPU() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene) as unknown as Scene;
  const camera = useThree((s) => s.camera) as unknown as Camera;
  return { gl, scene, camera };
}
