import * as THREE from 'three/webgpu';
import { extend, type ThreeToJSXElements } from '@react-three/fiber';

// Register the WebGPU build of Three.js (node materials included) as R3F JSX elements,
// e.g. <meshStandardNodeMaterial />. Core classes are shared with `three`.
extend(THREE as unknown as Parameters<typeof extend>[0]);

declare module '@react-three/fiber' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
