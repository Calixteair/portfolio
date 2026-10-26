import { describe, expect, it } from 'vitest';
import { sampleEdge } from '../../src/three/pendant/edges';
import { HOLE, holeOutline, outerOutline, polygonDistance } from '../../src/three/pendant/shape';
import { mulberry32 } from '../../src/three/random';

describe('sampleEdge', () => {
  const hole = holeOutline(mulberry32(7));
  const outer = outerOutline();

  it('places every emitter on its outline with a unit normal', () => {
    const samples = sampleEdge(hole, 200, mulberry32(1));
    expect(samples).toHaveLength(800);
    for (let i = 0; i < 200; i++) {
      const [x = 0, y = 0, nx = 0, ny = 0] = samples.subarray(i * 4, i * 4 + 4);
      expect(polygonDistance({ x, y }, hole)).toBeLessThan(1e-6);
      expect(Math.hypot(nx, ny)).toBeCloseTo(1);
    }
  });

  it('points hole normals into the hole', () => {
    const samples = sampleEdge(hole, 100, mulberry32(3), true);
    for (let i = 0; i < 100; i++) {
      const [x = 0, y = 0, nx = 0, ny = 0] = samples.subarray(i * 4, i * 4 + 4);
      expect((x - HOLE.cx) * nx + (y - HOLE.cy) * ny).toBeLessThanOrEqual(0);
    }
  });

  it('points outer-edge normals away from the hole centre', () => {
    const samples = sampleEdge(outer, 100, mulberry32(2));
    for (let i = 0; i < 100; i++) {
      const [x = 0, y = 0, nx = 0, ny = 0] = samples.subarray(i * 4, i * 4 + 4);
      expect((x - HOLE.cx) * nx + (y - HOLE.cy) * ny).toBeGreaterThanOrEqual(0);
    }
  });
});
