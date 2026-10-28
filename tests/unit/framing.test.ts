import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three/webgpu';
import { MIN_ASPECT, fitCamera, fitZoom } from '../../src/three/framing';

const halfWidth = (camera: PerspectiveCamera) =>
  (Math.tan(((camera.fov / 2) * Math.PI) / 180) / camera.zoom) * camera.aspect;

describe('fitZoom', () => {
  it('leaves landscape and square-ish screens untouched', () => {
    expect(fitZoom(16 / 9)).toBe(1);
    expect(fitZoom(MIN_ASPECT)).toBe(1);
  });

  it('widens a portrait screen to the horizontal field of the narrowest framing', () => {
    const phone = new PerspectiveCamera(32);
    const reference = new PerspectiveCamera(32);
    fitCamera(phone, 390 / 844);
    fitCamera(reference, MIN_ASPECT);
    expect(phone.zoom).toBeLessThan(1);
    expect(halfWidth(phone)).toBeCloseTo(halfWidth(reference), 6);
  });
});
