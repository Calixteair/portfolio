/**
 * Bakes the placeholder pendant's edge fields into public/generated/ (run before dev and
 * build, Node 24 strips the types). Same code as the runtime fallback: they cannot drift.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { edgeFieldsPath } from '../src/three/pendant/edgeFile.ts';
import { PENDANT_SEED, pendantOutlines } from '../src/three/pendant/outlines.ts';
import { bakeEdgeFields } from '../src/three/pendant/shape.ts';

const { hole, outer } = pendantOutlines(PENDANT_SEED);
const fields = bakeEdgeFields(hole, outer);
const file = new URL(`../public${edgeFieldsPath(PENDANT_SEED)}`, import.meta.url);
mkdirSync(new URL('.', file), { recursive: true });
writeFileSync(file, fields.data);
console.log(`baked ${file.pathname.split('/public')[1]} (${fields.data.byteLength} bytes)`);
