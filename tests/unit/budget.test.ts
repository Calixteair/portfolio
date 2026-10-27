import { describe, expect, it } from 'vitest';
import { QUALITY } from '../../src/three/quality';
import { particleBudget } from '../../src/three/scenes/forge/budget';

describe('particleBudget', () => {
  it('follows the quality tier', () => {
    expect(particleBudget('low', '').swarm).toBeLessThan(particleBudget('high', '').swarm);
  });

  it('accepts a positive integer override in dev, and ignores junk', () => {
    expect(particleBudget('high', '?sparks=1000&swarm=10')).toEqual({ sparks: 1000, swarm: 10 });
    expect(particleBudget('medium', '?sparks=-5&swarm=abc')).toEqual({
      sparks: QUALITY.medium.sparks,
      swarm: QUALITY.medium.swarm,
    });
  });
});
