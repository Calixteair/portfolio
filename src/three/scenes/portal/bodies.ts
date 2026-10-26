import {
  BoxGeometry,
  BufferGeometry,
  DodecahedronGeometry,
  Group,
  Line,
  LineBasicNodeMaterial,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three/webgpu';
import { color, float } from 'three/tsl';
import { PALETTE_B } from '../../../shaders/nebula';
import { createMoonMaterial, createPlanetMaterial } from '../../../shaders/planets';
import { mulberry32 } from '../../random';
import { positionAt, type Body } from '../../../system/layout';

/** Brutalist orbital station: stacked slabs around a spine, a few emissive windows. */
function station(body: Body): Group {
  const group = new Group();
  const rand = mulberry32(Math.floor(body.phase * 1e6));
  const concrete = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0.1 });
  concrete.colorNode = color(0x3a3d44);
  const windows = new MeshStandardNodeMaterial({ roughness: 0.5 });
  windows.colorNode = color(0x101318);
  windows.emissiveNode = color(body.look.soft ? PALETTE_B.ember : PALETTE_B.core).mul(float(1.6));
  const r = body.radius;
  const spine = new Mesh(new BoxGeometry(r * 0.3, r * 2.4, r * 0.3), concrete);
  group.add(spine);
  for (let i = 0; i < 4; i++) {
    const w = r * (0.8 + rand() * 0.9);
    const slab = new Mesh(new BoxGeometry(w, r * 0.22, w * (0.5 + rand() * 0.6)), concrete);
    slab.position.y = (i - 1.5) * r * 0.55;
    slab.rotation.y = rand() * Math.PI;
    const strip = new Mesh(new BoxGeometry(w * 1.01, r * 0.05, w * 0.2), windows);
    strip.position.copy(slab.position);
    strip.rotation.copy(slab.rotation);
    group.add(slab, strip);
  }
  return group;
}

function meshFor(body: Body): Object3D {
  const { kind, radius, look } = body;
  if (kind === 'station') return station(body);
  if (kind === 'asteroid') {
    return new Mesh(new DodecahedronGeometry(radius, 1), createMoonMaterial(look.soft, look.hue));
  }
  const detail = kind === 'planet' ? 64 : 24;
  const material =
    kind === 'planet'
      ? createPlanetMaterial(look.type, look.hue)
      : createMoonMaterial(look.soft, look.hue);
  return new Mesh(new SphereGeometry(radius, detail, detail / 2), material);
}

/** Faint orbit trace for planets and stations: makes the system readable at a glance. */
function orbitLine(body: Body, material: LineBasicNodeMaterial): Line {
  const points = Array.from({ length: 161 }, (_, i) => {
    const probe = { ...body, phase: (i / 160) * Math.PI * 2, speed: 0, host: undefined };
    return new Vector3(...positionAt(probe, 0, new Map()));
  });
  return new Line(new BufferGeometry().setFromPoints(points), material);
}

/**
 * Invisible, generous hit sphere: small moons 40 m away would be a few pixels wide; the
 * SPEC wants every body easy to aim at. Not rendered (material.visible = false), still
 * hit by the raycaster.
 */
function hitProxy(body: Body, material: MeshBasicNodeMaterial): Mesh {
  const radius = Math.max(body.radius * 2.2, body.kind === 'planet' ? 0.9 : 0.55);
  return new Mesh(new SphereGeometry(radius, 12, 8), material);
}

export interface SystemBodies {
  group: Group;
  /** slug → its object (for picking, labels and the travel). */
  objects: Map<string, Object3D>;
  update: (elapsed: number) => void;
}

export function createBodies(bodies: Body[]): SystemBodies {
  const group = new Group();
  const objects = new Map<string, Object3D>();
  const lookup = new Map(bodies.map((b) => [b.slug, b]));
  const orbitMaterial = new LineBasicNodeMaterial({ transparent: true, depthWrite: false });
  orbitMaterial.colorNode = color(PALETTE_B.filament);
  orbitMaterial.opacityNode = float(0.12);
  const hitMaterial = new MeshBasicNodeMaterial({ visible: false });
  for (const body of bodies) {
    const object = meshFor(body);
    object.add(hitProxy(body, hitMaterial));
    object.name = body.slug;
    object.userData.slug = body.slug;
    objects.set(body.slug, object);
    group.add(object);
    if (body.kind === 'planet' || body.kind === 'station')
      group.add(orbitLine(body, orbitMaterial));
  }
  const update = (elapsed: number) => {
    for (const body of bodies) {
      const object = objects.get(body.slug);
      object?.position.set(...positionAt(body, elapsed, lookup));
      if (object) object.rotation.y = elapsed * (body.kind === 'station' ? 0.05 : 0.08);
    }
  };
  update(0);
  return { group, objects, update };
}
