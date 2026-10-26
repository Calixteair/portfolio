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
import { mulberry32 } from '../random';
import {
  HOLE,
  PLATE,
  bakeEdgeFields,
  holeOutline,
  outerOutline,
  type EdgeFields,
  type Point,
} from './shape';

/** Same interface as the artist's GLB will expose (SPEC §6). */
export interface Pendant {
  group: Group;
  body: Mesh<ExtrudeGeometry, MeshPhysicalNodeMaterial>;
  diamonds: InstancedMesh;
  edgeMask: EdgeMaskInfo;
  /** Plate-space outlines, for spark emitters and collisions (M3). */
  outline: { outer: Point[]; hole: Point[] };
  dispose: () => void;
}

const DIAMOND_COUNT = 70;
const toVectors = (points: readonly Point[]) => points.map((p) => new Vector2(p.x, p.y));

function edgeMaskTexture(fields: EdgeFields): EdgeMaskInfo {
  const tex = new DataTexture(fields.data, fields.width, fields.height, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return { texture: tex, min: fields.min, size: fields.size, range: fields.range };
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
    bevelSize: 0.006,
    bevelSegments: 4,
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
export function createPendant(heat: PlateHeat, seed = 7): Pendant {
  const rand = mulberry32(seed);
  const outer = outerOutline();
  const hole = holeOutline(rand);
  const edgeMask = edgeMaskTexture(bakeEdgeFields(hole, outer));
  const body = buildBody(outer, hole, edgeMask, heat);
  const diamonds = buildDiamonds(hole, rand);
  const group = new Group();
  group.add(body, diamonds);
  const dispose = () => {
    disposeMeshes(group);
    edgeMask.texture.dispose();
  };
  return { group, body, diamonds, edgeMask, outline: { outer, hole }, dispose };
}
