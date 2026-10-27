import {
  DataTexture,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LinearFilter,
  Mesh,
  type MeshPhysicalNodeMaterial,
  Object3D,
  OctahedronGeometry,
  Path,
  RGBAFormat,
  Shape,
  Vector2,
} from 'three/webgpu';
import type { PlateHeat } from '../../shaders/heat';
import { createDiamondMaterial, createPlateMaterial, type EdgeMaskInfo } from '../../shaders/steel';
import { disposeMeshes } from '../dispose';
import { loadEdgeBytes } from './edgeFile';
import { PENDANT_SEED, pendantOutlines } from './outlines';
import { HOLE, PLATE, bakeEdgeFields, fieldLayout, type Point } from './shape';

/** Same interface as the artist's GLB will expose (SPEC §6). */
export interface Pendant {
  group: Group;
  body: Mesh<ExtrudeGeometry, MeshPhysicalNodeMaterial>;
  diamonds: InstancedMesh;
  edgeMask: EdgeMaskInfo;
  /** Plate-space outlines, for spark emitters and collisions (M3). */
  outline: { outer: Point[]; hole: Point[] };
  /** Resolves once the edge mask holds its data (fetched, or computed as a fallback). */
  ready: Promise<void>;
  dispose: () => void;
}

const DIAMOND_COUNT = 70;
const toVectors = (points: readonly Point[]) => points.map((p) => new Vector2(p.x, p.y));

/** The edge mask, empty until its data arrives (the shaders compile without it). */
function edgeMaskTexture(): EdgeMaskInfo & { fill: (data: Uint8Array) => void } {
  const layout = fieldLayout();
  const data = new Uint8Array(layout.width * layout.height * 4);
  const tex = new DataTexture(data, layout.width, layout.height, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  const fill = (bytes: Uint8Array) => {
    data.set(bytes);
    tex.needsUpdate = true;
  };
  return { texture: tex, min: layout.min, size: layout.size, range: layout.range, fill };
}

function buildBody(
  outer: Point[],
  hole: Point[],
  mask: EdgeMaskInfo,
  heat: PlateHeat,
): Pendant['body'] {
  const shape = new Shape(toVectors(outer));
  shape.holes.push(new Path(toVectors(hole)));
  const geometry = new ExtrudeGeometry(shape, {
    depth: PLATE.depth,
    bevelEnabled: true,
    bevelThickness: PLATE.bevel,
    // Barely rounded edges all round (0.35 mm), as on the real pendant. The offset keeps
    // the silhouette on the outline (the bevel would otherwise grow the plate by its size).
    bevelSize: PLATE.bevel,
    bevelOffset: -PLATE.bevel,
    bevelSegments: 3,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -PLATE.depth / 2);
  geometry.computeVertexNormals();
  const body = new Mesh(geometry, createPlateMaterial(mask, heat));
  return body;
}

/** Black diamonds set into the crust just outside the hole edge, on both faces. */
function buildDiamonds(hole: Point[], rand: () => number): InstancedMesh {
  const front = PLATE.depth / 2 + PLATE.bevel;
  const mesh = new InstancedMesh(
    new OctahedronGeometry(1, 0),
    createDiamondMaterial(),
    DIAMOND_COUNT,
  );
  const dummy = new Object3D();
  for (let i = 0; i < DIAMOND_COUNT; i++) {
    const p = hole[Math.floor(rand() * hole.length)] as Point;
    const dx = p.x - HOLE.cx;
    const dy = p.y - HOLE.cy;
    const len = Math.hypot(dx, dy);
    const out = 0.006 + rand() * 0.018;
    const size = 0.0035 + rand() * 0.0045;
    const side = i % 2 ? 1 : -1;
    dummy.position.set(
      p.x + (dx / len) * out,
      p.y + (dy / len) * out,
      side * (front - size * 0.35),
    );
    dummy.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
    dummy.scale.set(size, size, size * 0.7);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  return mesh;
}

/** Procedural stand-in for the final GLB: chamfered steel plate, eroded hole, black diamonds. */
export function createPendant(heat: PlateHeat, seed = PENDANT_SEED): Pendant {
  const { outer, hole, rand } = pendantOutlines(seed);
  const edgeMask = edgeMaskTexture();
  const ready = loadEdgeBytes(seed, () => bakeEdgeFields(hole, outer).data).then(edgeMask.fill);
  const body = buildBody(outer, hole, edgeMask, heat);
  const diamonds = buildDiamonds(hole, rand);
  const group = new Group();
  group.add(body, diamonds);
  const dispose = () => {
    disposeMeshes(group);
    edgeMask.texture.dispose();
  };
  return { group, body, diamonds, edgeMask, outline: { outer, hole }, ready, dispose };
}
