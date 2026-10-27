/**
 * Self-hosts the Basis Universal transcoder (KTX2 textures, SPEC §8: no CDN) by copying
 * it from the installed three.js into public/generated/basis/ (run with `npm run bake`):
 * always the version matching three, no binary committed.
 */
import { copyFileSync, mkdirSync } from 'node:fs';

const from = new URL('../node_modules/three/examples/jsm/libs/basis/', import.meta.url);
const to = new URL('../public/generated/basis/', import.meta.url);
mkdirSync(to, { recursive: true });
for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  copyFileSync(new URL(file, from), new URL(file, to));
}
console.log('copied the Basis transcoder to /generated/basis/');
