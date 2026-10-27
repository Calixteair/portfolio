import { expect, test } from '@playwright/test';

test.describe('self-hosted build outputs', () => {
  test('serves the baked edge fields and the Basis transcoder', async ({ request }) => {
    const edges = await request.get('/generated/pendant-edges-7.bin');
    expect(edges.status()).toBe(200);
    expect((await edges.body()).byteLength).toBe(160 * 232 * 4);
    const wasm = await request.get('/generated/basis/basis_transcoder.wasm');
    expect(wasm.status()).toBe(200);
    expect(wasm.headers()['content-type']).toBe('application/wasm');
    expect((await request.get('/generated/basis/basis_transcoder.js')).status()).toBe(200);
    const model = await request.get('/models/pendant.glb');
    expect(model.status()).toBe(200);
    expect((await model.body()).subarray(0, 4).toString()).toBe('glTF');
  });
});
