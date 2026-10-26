import { describe, expect, it } from 'vitest';
import { PARTICLE_BUDGET, particleBudget } from '../../src/three/scenes/forge/budget';

describe('particleBudget', () => {
  it('gives the WebGL 2 fallback fewer particles than WebGPU', () => {
    expect(PARTICLE_BUDGET.webgl2.sparks).toBeLessThan(PARTICLE_BUDGET.webgpu.sparks);
    expect(PARTICLE_BUDGET.webgl2.swarm).toBeLessThan(PARTICLE_BUDGET.webgpu.swarm);
  });

  it('accepts a positive integer override in dev, and ignores junk', () => {
    expect(particleBudget('webgpu', '?sparks=1000&swarm=10')).toEqual({ sparks: 1000, swarm: 10 });
    expect(particleBudget('webgl2', '?sparks=-5&swarm=abc')).toEqual(PARTICLE_BUDGET.webgl2);
  });
});
