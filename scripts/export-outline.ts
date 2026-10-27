/**
 * Writes the pendant's outlines and dimensions for the Blender model (tools/blender/),
 * so the model's plate and hole are exactly the ones the site uses for its loader wire,
 * edge fields, sparks and portal. Run with `npm run model:outline`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PENDANT_SEED, pendantOutlines } from '../src/three/pendant/outlines.ts';
import { HOLE, PLATE } from '../src/three/pendant/shape.ts';

const { outer, hole } = pendantOutlines(PENDANT_SEED);
const out = new URL('../tools/blender/build/', import.meta.url);
mkdirSync(out, { recursive: true });
const file = new URL('outline.json', out);
writeFileSync(
  file,
  JSON.stringify({ plate: PLATE, hole: HOLE, outer, holeOutline: hole }, null, 1),
);
console.log(`wrote ${file.pathname} (${outer.length} + ${hole.length} points)`);
