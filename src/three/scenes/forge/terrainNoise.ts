/** CPU value noise used to sculpt the decor geometry once, at build time. Pure functions. */

function hash1(i: number, seed: number): number {
  const v = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function hash2(i: number, j: number): number {
  const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

const smooth = (f: number) => f * f * (3 - 2 * f);

/** 1D value noise in [0, 1]. */
export function valueNoise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const u = smooth(x - i);
  return hash1(i, seed) * (1 - u) + hash1(i + 1, seed) * u;
}

/** 2D value noise in [0, 1]. */
export function valueNoise2(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const ux = smooth(x - i);
  const uy = smooth(y - j);
  const a = hash2(i, j) * (1 - ux) + hash2(i + 1, j) * ux;
  const b = hash2(i, j + 1) * (1 - ux) + hash2(i + 1, j + 1) * ux;
  return a * (1 - uy) + b * uy;
}

const FBM_OCTAVES = [1, 2.1, 4.3, 8.7];

/** 4-octave fBm, in [0, about 0.94]. */
export function fbm2(x: number, y: number): number {
  return FBM_OCTAVES.reduce(
    (sum, f, k) => sum + valueNoise2(x * f + k * 17, y * f) / 2 ** (k + 1),
    0,
  );
}

/** Ridged multi-octave profile for distant ranges: sharp crests, soft valleys. */
export function ridgeProfile(x: number, seed: number): number {
  const octaves: [number, number][] = [
    [0.02, 1],
    [0.05, 0.5],
    [0.12, 0.22],
    [0.3, 0.08],
  ];
  return octaves.reduce(
    (y, [f, a]) => y + a * (1 - Math.abs(valueNoise1(x * f, seed + f) * 2 - 1)) ** 2,
    0,
  );
}
