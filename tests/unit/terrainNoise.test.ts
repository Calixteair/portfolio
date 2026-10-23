import { describe, expect, it } from 'vitest';
import { glowIntensity } from '../../src/three/scenes/forge/uniforms';
import {
  fbm2,
  ridgeProfile,
  valueNoise1,
  valueNoise2,
} from '../../src/three/scenes/forge/terrainNoise';

const samples = Array.from({ length: 200 }, (_, i) => [i * 0.37 - 30, i * 0.91 - 50] as const);

describe('terrain noise', () => {
  it('keeps value noise in [0, 1] and deterministic', () => {
    for (const [x, y] of samples) {
      const n = valueNoise2(x, y);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
      expect(valueNoise2(x, y)).toBe(n);
      expect(valueNoise1(x, 3)).toBeGreaterThanOrEqual(0);
      expect(valueNoise1(x, 3)).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous: close inputs give close values', () => {
    for (const [x, y] of samples) {
      expect(Math.abs(valueNoise2(x, y) - valueNoise2(x + 1e-4, y))).toBeLessThan(0.01);
    }
  });

  it('bounds fBm and the ridge profile', () => {
    for (const [x, y] of samples) {
      expect(fbm2(x, y)).toBeGreaterThanOrEqual(0);
      expect(fbm2(x, y)).toBeLessThan(0.94);
      expect(ridgeProfile(x * 10, -50)).toBeGreaterThanOrEqual(0);
      expect(ridgeProfile(x * 10, -50)).toBeLessThanOrEqual(1.8);
    }
  });
});

describe('glowIntensity', () => {
  it('stays faint when cold and grows monotonically with the heat', () => {
    expect(glowIntensity(0)).toBeCloseTo(0.3);
    expect(glowIntensity(0.5)).toBeLessThan(glowIntensity(1));
    expect(glowIntensity(1)).toBeCloseTo(30.3);
  });
});
