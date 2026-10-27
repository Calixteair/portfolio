import { afterEach, describe, expect, it, vi } from 'vitest';
import { EDGE_BYTES, checkEdgeBytes, loadEdgeBytes } from '../../src/three/pendant/edgeFile';
import { PENDANT_SEED, pendantOutlines } from '../../src/three/pendant/outlines';
import { bakeEdgeFields } from '../../src/three/pendant/shape';

const baked = new Uint8Array(EDGE_BYTES).fill(7);
const fallback = () => new Uint8Array(EDGE_BYTES).fill(1);

function serve(response: Response | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response))),
  );
}

describe('baked edge fields', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('matches the size of the fields the runtime would compute', () => {
    const { hole, outer } = pendantOutlines(PENDANT_SEED);
    expect(bakeEdgeFields(hole, outer).data.byteLength).toBe(EDGE_BYTES);
    expect(checkEdgeBytes(new ArrayBuffer(EDGE_BYTES - 4))).toBeNull();
  });

  it('uses the baked file when it is there', async () => {
    serve(new Response(baked));
    expect((await loadEdgeBytes(PENDANT_SEED, fallback))[0]).toBe(7);
  });

  it('computes them when the file is missing, truncated or unreachable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const response of [
      new Response(null, { status: 404 }),
      new Response(new Uint8Array(10)),
      new Error('offline'),
    ]) {
      serve(response);
      expect((await loadEdgeBytes(PENDANT_SEED, fallback))[0]).toBe(1);
    }
  });
});
