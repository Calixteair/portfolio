import {
  BufferAttribute,
  type BufferGeometry,
  type Matrix4,
  type Mesh,
  type Object3D,
} from 'three/webgpu';

/** The pendant model, built by tools/blender/pendant.py (npm run model:build). */
export const MODEL_URL = '/models/pendant.glb';

export interface PendantModel {
  /** The plate, erosion carved in; colour attribute R = 1 on the black crust. */
  body: BufferGeometry;
  diamond: BufferGeometry;
  /** One matrix per diamond, in pendant space. */
  diamonds: Matrix4[];
}

/**
 * UVs as the placeholder's extrusion lays them out: (x, y) on the faces, (x or y, z) on
 * the walls, picked from each vertex's normal. The brushed anisotropy derives its tangent
 * from them: (x, y) alone would not vary across a wall, a degenerate tangent (NaN, which
 * the bloom turns into a white blaze). Not stored in the GLB (float UVs would double it).
 */
function planarUvs(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const [nx, ny, nz] = [
      Math.abs(normal.getX(i)),
      Math.abs(normal.getY(i)),
      Math.abs(normal.getZ(i)),
    ];
    const face = nz >= Math.max(nx, ny);
    uv[2 * i] = face || ny > nx ? position.getX(i) : position.getY(i);
    uv[2 * i + 1] = face ? position.getY(i) : position.getZ(i);
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}

/** A quantised attribute (normalised ints) as plain floats, so a matrix can be applied. */
function toFloat(geometry: BufferGeometry, name: string): void {
  const source = geometry.getAttribute(name);
  if (!source) return;
  const out = new Float32Array(source.count * source.itemSize);
  for (let i = 0; i < source.count; i++) {
    for (let c = 0; c < source.itemSize; c++)
      out[i * source.itemSize + c] = source.getComponent(i, c);
  }
  geometry.setAttribute(name, new BufferAttribute(out, source.itemSize));
}

/**
 * The body's geometry in pendant space. Meshopt quantisation stores positions as
 * normalised integers and moves their real scale and offset into the node's matrix: bake
 * that matrix into float attributes, or the plate shows at the wrong size.
 */
function bakeNode(mesh: Mesh): BufferGeometry {
  const geometry = mesh.geometry;
  toFloat(geometry, 'position');
  toFloat(geometry, 'normal');
  geometry.applyMatrix4(mesh.matrixWorld);
  return geometry;
}

function readModel(scene: Object3D): PendantModel {
  let body: BufferGeometry | null = null;
  let diamond: BufferGeometry | null = null;
  const diamonds: Matrix4[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.name.startsWith('diamond')) {
      diamond ??= mesh.geometry;
      diamonds.push(mesh.matrixWorld.clone());
    } else {
      body = bakeNode(mesh);
    }
  });
  if (!body || !diamond) throw new Error('pendant model: body or diamonds missing');
  planarUvs(body);
  return { body, diamond, diamonds };
}

/** Fetch and decode the model; GLTFLoader comes in a chunk of its own, off the startup JS. */
export async function loadPendantModel(url = MODEL_URL): Promise<PendantModel> {
  const { createGltfLoader } = await import('../assets');
  const gltf = await createGltfLoader().loadAsync(url);
  return readModel(gltf.scene);
}
