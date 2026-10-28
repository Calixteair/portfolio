import { describe, expect, it } from 'vitest';
import { CylinderGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three/webgpu';
import {
  MAX_ROCKS,
  type Cone,
  fitCone,
  groundField,
  reachableRocks,
  sampleGround,
} from '../../src/three/scenes/forge/colliders';
import { groundGeometry } from '../../src/three/scenes/forge/decor';
import { mulberry32 } from '../../src/three/random';

describe('spark colliders', () => {
  const ground = new Mesh(groundGeometry(), new MeshBasicMaterial());
  const field = groundField(ground.geometry);

  it('covers the sparks’ reach (5.5 m) around the pendant, and knows its top', () => {
    const far = field.origin + (field.size - 1) * field.step;
    expect(field.origin).toBeLessThan(-6);
    expect(far).toBeGreaterThan(6);
    expect(field.top).toBe(Math.max(...field.heights));
  });

  it('follows the drawn ground facet by facet, not a smoothed copy', () => {
    const ray = new Raycaster();
    const rand = mulberry32(3);
    for (let k = 0; k < 300; k++) {
      const x = (rand() - 0.5) * 12;
      const z = (rand() - 0.5) * 12;
      ray.set(new Vector3(x, 50, z), new Vector3(0, -1, 0));
      const [hit] = ray.intersectObject(ground);
      expect(hit).toBeDefined();
      expect(sampleGround(field, x, z)).toBeCloseTo(hit?.point.y ?? NaN, 4);
    }
  });

  it('fits an upright cone to a truncated cylinder', () => {
    const geometry = new CylinderGeometry(0.5, 1, 2, 64);
    geometry.translate(3, 1, -4);
    const cone = fitCone(geometry);
    expect(cone.x).toBeCloseTo(3, 2);
    expect(cone.z).toBeCloseTo(-4, 2);
    expect(cone.y).toBeCloseTo(0, 5);
    expect(cone.height).toBeCloseTo(2, 5);
    expect(cone.bottom).toBeCloseTo(0.9, 2);
    expect(cone.top).toBeLessThan(cone.bottom);
  });

  it('keeps the nearest reachable rocks only, nearest first, at most MAX_ROCKS', () => {
    const rock = (d: number): Cone => ({ x: d, y: 0, z: 0, height: 1, bottom: 0.5, top: 0.2 });
    const rocks = reachableRocks([20, 4, 9, 3, ...Array.from({ length: 50 }, () => 5)].map(rock));
    expect(rocks.length).toBe(MAX_ROCKS);
    expect(rocks[0]?.x).toBe(3);
    expect(rocks.every((c) => c.x < 8)).toBe(true);
  });
});
