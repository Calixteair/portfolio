import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { WebGPURenderer } from 'three/webgpu';

/** Where `npm run bake` puts the Basis transcoder (self-hosted, SPEC §8). */
export const BASIS_PATH = '/generated/basis/';

/**
 * Loader for the optimised GLB (`npm run optimize:assets`: Meshopt geometry, KTX2
 * textures). Every decoder is served by us: Meshopt is bundled, Basis comes from
 * BASIS_PATH (its worker runs from a blob: URL and compiles WASM, hence the CSP's
 * `worker-src blob:` and `'wasm-unsafe-eval'`). Used from M9, with the artist's model.
 */
export function createGltfLoader(renderer: WebGPURenderer): GLTFLoader {
  const ktx2 = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(renderer);
  return new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
}
