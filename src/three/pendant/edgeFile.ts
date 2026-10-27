import { FIELD } from './shape.ts';

/**
 * The placeholder's edge fields, baked at build time (scripts/bake-edges.ts) instead of
 * on every visit (~70-110 ms of main thread while the loader animates). Raw RGBA8 bytes,
 * FIELD.width × FIELD.height; the seed is in the name since the hole depends on it.
 */
export const edgeFieldsPath = (seed: number) => `/generated/pendant-edges-${seed}.bin`;

export const EDGE_BYTES = FIELD.width * FIELD.height * 4;

/** The baked bytes if the file is the right size, else null (stale or truncated file). */
export function checkEdgeBytes(buffer: ArrayBuffer): Uint8Array | null {
  return buffer.byteLength === EDGE_BYTES ? new Uint8Array(buffer) : null;
}

/**
 * Fetch the baked fields; on any failure (offline dev, missing file, wrong size) compute
 * them here instead: slower, never wrong.
 */
export async function loadEdgeBytes(seed: number, bake: () => Uint8Array): Promise<Uint8Array> {
  try {
    const response = await fetch(edgeFieldsPath(seed));
    if (response.ok) {
      const bytes = checkEdgeBytes(await response.arrayBuffer());
      if (bytes) return bytes;
    }
    console.warn('[pendant] baked edge fields unusable, computing them');
  } catch (error) {
    console.warn('[pendant] baked edge fields unavailable, computing them', error);
  }
  return bake();
}
