import { describe, expect, it } from 'vitest';
import { QUALITY, ceilingTier, dprFor, initialTier, shiftTier } from '../../src/three/quality';

describe('quality tiers', () => {
  it('starts low on touch devices and small CPUs, high on desktop WebGPU', () => {
    expect(initialTier({ backend: 'webgpu', coarsePointer: true, cores: 8 })).toBe('low');
    expect(initialTier({ backend: 'webgpu', coarsePointer: false, cores: 4 })).toBe('low');
    expect(initialTier({ backend: 'webgpu', coarsePointer: false, cores: 16 })).toBe('high');
    expect(initialTier({ backend: 'webgl2', coarsePointer: false, cores: 0 })).toBe('medium');
  });

  it('shifts one tier at a time, within bounds', () => {
    expect(shiftTier('high', -1)).toBe('medium');
    expect(shiftTier('low', -1)).toBe('low');
    expect(shiftTier('high', 1)).toBe('high');
    expect(shiftTier('medium', 1, 'medium')).toBe('medium');
  });

  it('caps touch devices at medium', () => {
    expect(ceilingTier({ backend: 'webgpu', coarsePointer: true, cores: 8 })).toBe('medium');
    expect(ceilingTier({ backend: 'webgpu', coarsePointer: false, cores: 8 })).toBe('high');
  });

  it('never asks for more pixels than the tier or the screen allow', () => {
    expect(dprFor('high', 1, 3)).toBe(2);
    expect(dprFor('high', 1, 1.25)).toBe(1.25);
    expect(dprFor('low', 1, 2)).toBe(1);
    expect(dprFor('medium', 0.5, 2)).toBe(1.25);
    expect(dprFor('high', 0, 2)).toBe(1);
  });

  it('keeps the mobile tier near the SPEC budget (about 8 000 particles)', () => {
    expect(QUALITY.low.sparks + QUALITY.low.swarm).toBeLessThanOrEqual(8192);
  });
});
