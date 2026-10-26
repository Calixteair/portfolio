import { Raycaster, Vector2, Vector3, type Camera, type Object3D } from 'three/webgpu';

const raycaster = new Raycaster();
const ndc = new Vector2();

/** Slug of the body an object belongs to (a station is a group of meshes). */
function slugOf(object: Object3D | null): string | null {
  for (let o = object; o; o = o.parent) {
    if (typeof o.userData.slug === 'string') return o.userData.slug;
  }
  return null;
}

/** Body under a pointer given in normalized device coordinates, or null. */
export function pickBody(
  pointer: { x: number; y: number },
  camera: Camera,
  bodies: Iterable<Object3D>,
): string | null {
  ndc.set(pointer.x, pointer.y);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects([...bodies], true)[0];
  return hit ? slugOf(hit.object) : null;
}

const projected = new Vector3();

/** Screen position (CSS px) of an object, or null when behind the camera. */
export function screenPoint(
  object: Object3D,
  camera: Camera,
  size: { width: number; height: number },
): { x: number; y: number } | null {
  object.getWorldPosition(projected).project(camera);
  if (projected.z > 1) return null;
  return {
    x: ((projected.x + 1) / 2) * size.width,
    y: ((1 - projected.y) / 2) * size.height,
  };
}
