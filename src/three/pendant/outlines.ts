// Explicit .ts extensions: also run by Node (scripts/bake-edges.ts), which needs them.
import { mulberry32 } from '../random.ts';
import { holeOutline, outerOutline } from './shape.ts';

/** The placeholder's seed: its hole, and the baked fields, depend on it. */
export const PENDANT_SEED = 7;

/**
 * The placeholder's outlines for a seed, and the generator left after the hole (the
 * diamonds draw from it next), so the build-time bake and the runtime agree exactly.
 */
export function pendantOutlines(seed: number) {
  const rand = mulberry32(seed);
  return { outer: outerOutline(), hole: holeOutline(rand), rand };
}
