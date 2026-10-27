import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DodecahedronGeometry,
  Group,
  Line,
  LineBasicNodeMaterial,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  SphereGeometry,
  Vector3,
  type Node,
  type Object3D,
  type UniformNode,
} from 'three/webgpu';
import { attribute, color, float, uniform, uniformArray } from 'three/tsl';
import { PALETTE_B } from '../../../shaders/nebula';
import { createMoonMaterial, createPlanetMaterial, rimGlow } from '../../../shaders/planets';
import {
  createHighlight,
  dimTarget,
  easeGlow,
  glowTarget,
  type HighlightState,
} from '../../../system/highlight';
import { mulberry32 } from '../../random';
import { positionAt, type Body } from '../../../system/layout';

/** Brutalist orbital station: stacked slabs around a spine, a few emissive windows. */
function station(body: Body, highlight: UniformNode<'float', number>): Group {
  const group = new Group();
  const rand = mulberry32(Math.floor(body.phase * 1e6));
  const concrete = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0.1 });
  concrete.colorNode = color(0x3a3d44);
  concrete.emissiveNode = rimGlow(highlight, color(PALETTE_B.filament).mul(1.4));
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

function meshFor(body: Body, highlight: UniformNode<'float', number>): Object3D {
  const { kind, radius, look } = body;
  if (kind === 'station') return station(body, highlight);
  if (kind === 'asteroid') {
    const material = createMoonMaterial(look.soft, look.hue, highlight);
    return new Mesh(new DodecahedronGeometry(radius, 1), material);
  }
  const detail = kind === 'planet' ? 64 : 24;
  const material =
    kind === 'planet'
      ? createPlanetMaterial(look.type, look.hue, highlight)
      : createMoonMaterial(look.soft, look.hue, highlight);
  return new Mesh(new SphereGeometry(radius, detail, detail / 2), material);
}

/** How dark a faded body gets (search non-matches): it stays visible, matches stand out. */
const FADED = 0.7;

/** Scale a body's colour and emission down by its fade (0 = untouched, 1 = faded). */
function fadeWith(object: Object3D, fade: UniformNode<'float', number>): void {
  const keep = float(1).sub(fade.mul(FADED));
  object.traverse((child) => {
    const material = (child as Mesh).material as MeshStandardNodeMaterial | undefined;
    if (!(material instanceof MeshStandardNodeMaterial) || material.userData.faded) return;
    material.userData.faded = true; // station materials are shared by several meshes
    if (material.colorNode) material.colorNode = material.colorNode.mul(keep);
    if (material.emissiveNode)
      material.emissiveNode = (material.emissiveNode as Node<'vec3'>).mul(keep);
  });
}

/** How much an orbit trace takes its body's hue over the palette's blue: a slight shift. */
const ORBIT_TINT = 0.6;

/**
 * Faint orbit trace for planets and stations: makes the system readable at a glance. Each
 * is tinted towards its body's hue, so neighbouring orbits tell apart. The colour is a
 * vertex attribute: all traces share one material, hence one shader. They brighten with
 * their body's highlight (hover, search).
 */
function orbitLine(body: Body, index: number, material: LineBasicNodeMaterial): Line {
  const points = Array.from({ length: 161 }, (_, i) => {
    const probe = { ...body, phase: (i / 160) * Math.PI * 2, speed: 0, host: undefined };
    return new Vector3(...positionAt(probe, 0, new Map()));
  });
  const tint = new Color(PALETTE_B.filament).lerp(
    new Color().setHSL(body.look.hue / 360, 0.85, 0.55),
    ORBIT_TINT,
  );
  const colors = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) tint.toArray(colors, i * 3);
  const geometry = new BufferGeometry().setFromPoints(points);
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  // Which body the trace belongs to, to light it up with its body (one shared material).
  geometry.setAttribute(
    'orbit',
    new BufferAttribute(new Float32Array(points.length).fill(index), 1),
  );
  return new Line(geometry, material);
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

/** Camera distance in orbit: a few radii, and far enough to frame all of its moons. */
function reachOf(body: Body, bodies: Body[]): number {
  const moons = bodies.filter((b) => b.host === body.slug).map((b) => b.orbit);
  return Math.max(2.2, body.radius * 4.5, Math.max(0, ...moons) * 2.2);
}

export interface SystemBodies {
  group: Group;
  /** slug → its object (for picking, labels and the travel). */
  objects: Map<string, Object3D>;
  /** slug → how far the travel stays from it: its moons must fit in the frame. */
  reach: Map<string, number>;
  /** Visiting this body (or none): its moons glow faintly, easing in and out. */
  focus: (slug: string | null) => void;
  /** The body under the pointer (or none): it glows, its orbit trace too. */
  hover: (slug: string | null) => void;
  /** Search matches (null: no search): they glow. */
  mark: (slugs: ReadonlySet<string> | null) => void;
  update: (elapsed: number) => void;
}

export function createBodies(bodies: Body[]): SystemBodies {
  const group = new Group();
  const objects = new Map<string, Object3D>();
  const lookup = new Map(bodies.map((b) => [b.slug, b]));
  const glows = new Map(bodies.map((b) => [b.slug, uniform(0)]));
  const fades = new Map(bodies.map((b) => [b.slug, uniform(0)]));
  const traced = bodies.filter((b) => b.kind === 'planet' || b.kind === 'station');
  const traceGlow = uniformArray<'float'>(new Array<number>(traced.length).fill(0), 'float');
  const traceFade = uniformArray<'float'>(new Array<number>(traced.length).fill(0), 'float');
  const orbitMaterial = new LineBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  });
  const trace = attribute<'float'>('orbit', 'float').toUint();
  const lit = traceGlow.element(trace);
  const faded = float(1).sub(traceFade.element(trace).mul(FADED));
  orbitMaterial.opacityNode = float(0.16).add(lit.mul(0.5)).mul(faded);
  const hitMaterial = new MeshBasicNodeMaterial({ visible: false });
  for (const body of bodies) {
    const object = meshFor(body, glows.get(body.slug) ?? uniform(0));
    fadeWith(object, fades.get(body.slug) ?? uniform(0));
    object.add(hitProxy(body, hitMaterial));
    object.name = body.slug;
    object.userData.slug = body.slug;
    objects.set(body.slug, object);
    group.add(object);
  }
  traced.forEach((body, i) => group.add(orbitLine(body, i, orbitMaterial)));
  const state: HighlightState = createHighlight();
  let last = 0;
  const easeGlows = (elapsed: number) => {
    const dt = elapsed - last;
    last = elapsed;
    for (const body of bodies) {
      const glow = glows.get(body.slug);
      if (glow) glow.value = easeGlow(glow.value, glowTarget(body, state), dt);
      const fade = fades.get(body.slug);
      if (fade) fade.value = easeGlow(fade.value, dimTarget(body, state), dt);
    }
    traced.forEach((body, i) => {
      traceGlow.array[i] = glows.get(body.slug)?.value ?? 0;
      traceFade.array[i] = fades.get(body.slug)?.value ?? 0;
    });
  };
  const update = (elapsed: number) => {
    easeGlows(elapsed);
    for (const body of bodies) {
      const object = objects.get(body.slug);
      object?.position.set(...positionAt(body, elapsed, lookup));
      if (object) object.rotation.y = elapsed * (body.kind === 'station' ? 0.05 : 0.08);
    }
  };
  update(0);
  const reach = new Map(bodies.map((b) => [b.slug, reachOf(b, bodies)]));
  return {
    group,
    objects,
    reach,
    focus: (slug) => void (state.focused = slug),
    hover: (slug) => void (state.hovered = slug),
    mark: (slugs) => void (state.marked = slugs),
    update,
  };
}
