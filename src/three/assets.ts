import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** Where `npm run bake` puts the Basis transcoder, for KTX2 textures (SPEC §8). */
export const BASIS_PATH = '/generated/basis/';

/**
 * Loader for the optimised GLB (`npm run optimize:assets`): Meshopt geometry, decoded by
 * the bundled decoder (WASM compiled in place, hence the CSP's 'wasm-unsafe-eval'). The
 * pendant model has no texture (its look is in the shaders), so no KTX2 loader: add one
 * here, with BASIS_PATH, when a model brings textures.
 */
export function createGltfLoader(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
