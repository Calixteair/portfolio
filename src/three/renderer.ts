import { WebGPURenderer } from 'three/webgpu';

export type Backend = 'webgpu' | 'webgl2';

/** `?gl=webgl2` forces the WebGL 2 fallback, to test it on a WebGPU-capable browser. */
export function isWebGLForced(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('gl') === 'webgl2';
}

/** WebGPU, or the WebGL 2 the fallback backend needs. Otherwise: classic version (SPEC §4). */
export function supports3D(): boolean {
  if ('gpu' in navigator) return true;
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

export function backendOf(renderer: WebGPURenderer): Backend {
  return 'isWebGPUBackend' in renderer.backend ? 'webgpu' : 'webgl2';
}

/**
 * Renderer factory for R3F's `gl` prop. WebGPURenderer picks WebGPU when available
 * and falls back to WebGL 2 on its own; `init()` must resolve before the first frame.
 */
// Generic on purpose: R3F ships its own OffscreenCanvas type, incompatible with the DOM one.
export async function createRenderer<P extends { canvas: object }>({
  canvas,
}: P): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({
    canvas: canvas as HTMLCanvasElement,
    antialias: true,
    forceWebGL: isWebGLForced(),
  });
  await renderer.init();
  return renderer;
}
