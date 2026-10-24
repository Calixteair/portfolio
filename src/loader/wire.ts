import { Vector3, type Camera, type Object3D } from 'three/webgpu';
import { PLATE, WIRE_PAD, outerOutline } from '../three/pendant/shape';

export interface WireBox {
  /** Centre and height of the SVG in CSS pixels. */
  x: number;
  y: number;
  height: number;
}

const FRONT_Z = PLATE.depth / 2 + PLATE.bevel;
const corners = outerOutline();
const v = new Vector3();

/**
 * Where the loader wire must sit to overlay the pendant's front face exactly on screen
 * (SPEC §4: the 3D pendant appears at the same position and size as the outline).
 */
export function projectWire(
  object: Object3D,
  camera: Camera,
  size: { width: number; height: number },
): WireBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    v.set(p.x, p.y, FRONT_Z).applyMatrix4(object.matrixWorld).project(camera);
    const x = ((v.x + 1) / 2) * size.width;
    const y = ((1 - v.y) / 2) * size.height;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const plateHeight = maxY - minY;
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    height: (plateHeight * (PLATE.hh + WIRE_PAD)) / PLATE.hh,
  };
}

let last = '';

/** Writes the box to the loader's CSS variables (only when it changed, to the half pixel). */
export function alignWire(box: WireBox): void {
  const loader = document.getElementById('loader');
  if (!loader) return;
  const key = [box.x, box.y, box.height].map((n) => Math.round(n * 2)).join();
  if (key === last) return;
  last = key;
  loader.style.setProperty('--wire-x', `${box.x.toFixed(1)}px`);
  loader.style.setProperty('--wire-y', `${box.y.toFixed(1)}px`);
  loader.style.setProperty('--wire-h', `${box.height.toFixed(1)}px`);
}
