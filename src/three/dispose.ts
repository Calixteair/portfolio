import { Mesh, type Material, type Object3D } from 'three/webgpu';

/** Frees the geometry and material(s) of every mesh under `root` (CLAUDE.md: dispose left scenes). */
export function disposeMeshes(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) material.dispose();
  });
}
