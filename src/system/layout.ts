/**
 * Planetary system layout (SPEC §5.7), pure: content entries in, bodies with orbits out.
 * Projects are planets, skills are moons of their first host (or belt asteroids), and
 * experiences are orbital stations. Deterministic: same content, same system.
 */

export type BodyKind = 'planet' | 'moon' | 'asteroid' | 'station';
export type PlanetType = 'rocky' | 'gas' | 'ice' | 'lava' | 'ocean';

/** What the island receives for each content entry (serializable). */
export interface SystemEntry {
  slug: string;
  title: string;
  summary: string;
  category: 'project' | 'skill' | 'experience';
  order: number;
  orbits: string[];
  kind?: 'technical' | 'soft';
  station?: 'work' | 'education';
  planet?: { type: PlanetType; hue: number };
}

export interface Body {
  slug: string;
  kind: BodyKind;
  /** Slug of the body it orbits (moons), none for bodies orbiting the star. */
  host?: string;
  radius: number;
  orbit: number;
  /** Orbit tilt (rad) and angular speed (rad/s); phase is the angle at t = 0. */
  tilt: number;
  speed: number;
  phase: number;
  look: { type: PlanetType; hue: number; soft: boolean };
}

export const LAYOUT = {
  firstOrbit: 5,
  orbitStep: 2.4,
  stationOrbit: 24,
  beltOrbit: [30, 34] as const,
  /** Every planet orbit stays inside this, so the arrival point (z = 44) looks at all. */
  maxOrbit: 40,
} as const;

/** Stable 0-1 pseudo-random value from a string (FNV-1a). */
export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const TYPES: PlanetType[] = ['rocky', 'gas', 'ice', 'lava', 'ocean'];

function lookOf(e: SystemEntry) {
  const type = e.planet?.type ?? TYPES[Math.floor(hash01(e.slug) * TYPES.length)] ?? 'rocky';
  const hue = e.planet?.hue ?? Math.round(hash01(e.slug + '/hue') * 360);
  return { type, hue, soft: e.kind === 'soft' };
}

/** Keplerian feel: farther bodies are slower; everything stays slow enough to aim at. */
const speedAt = (orbit: number) => 0.6 / orbit ** 1.2;

function planets(entries: SystemEntry[]): Body[] {
  const projects = entries
    .filter((e) => e.category === 'project')
    .sort((a, b) => a.order - b.order);
  return projects.map((e, i) => {
    const orbit = Math.min(LAYOUT.maxOrbit, LAYOUT.firstOrbit + i * LAYOUT.orbitStep);
    return {
      slug: e.slug,
      kind: 'planet',
      radius: Math.max(0.35, 0.95 - (e.order - 1) * 0.045),
      orbit,
      tilt: (hash01(e.slug + '/tilt') - 0.5) * 0.12,
      speed: speedAt(orbit),
      phase: hash01(e.slug) * Math.PI * 2,
      look: lookOf(e),
    };
  });
}

function stations(entries: SystemEntry[]): Body[] {
  const list = entries.filter((e) => e.category === 'experience').sort((a, b) => a.order - b.order);
  return list.map((e, i) => ({
    slug: e.slug,
    kind: 'station',
    radius: e.station === 'work' ? 0.55 : 0.45,
    orbit: LAYOUT.stationOrbit,
    // Spread evenly on one inclined ring, like a constellation of outposts.
    tilt: 0.26,
    speed: speedAt(LAYOUT.stationOrbit),
    phase: (i / Math.max(1, list.length)) * Math.PI * 2 + 0.4,
    look: lookOf(e),
  }));
}

function moonsAndBelt(entries: SystemEntry[], hosts: Map<string, Body>): Body[] {
  const skills = entries.filter((e) => e.category === 'skill').sort((a, b) => a.order - b.order);
  const perHost = new Map<string, number>();
  return skills.map((e) => {
    const host = e.orbits.map((slug) => hosts.get(slug)).find((b) => b !== undefined);
    if (!host) return asteroid(e);
    const rank = perHost.get(host.slug) ?? 0;
    perHost.set(host.slug, rank + 1);
    const orbit = host.radius * 1.9 + 0.35 + rank * 0.32;
    return {
      slug: e.slug,
      kind: 'moon',
      host: host.slug,
      radius: e.kind === 'soft' ? 0.1 : 0.13,
      orbit,
      tilt: (hash01(e.slug + '/tilt') - 0.5) * 0.8,
      speed: 0.9 / orbit,
      phase: hash01(e.slug) * Math.PI * 2,
      look: lookOf(e),
    };
  });
}

function asteroid(e: SystemEntry): Body {
  const [inner, outer] = LAYOUT.beltOrbit;
  const orbit = inner + hash01(e.slug + '/orbit') * (outer - inner);
  return {
    slug: e.slug,
    kind: 'asteroid',
    radius: 0.22,
    orbit,
    tilt: (hash01(e.slug + '/tilt') - 0.5) * 0.1,
    speed: speedAt(orbit),
    phase: hash01(e.slug) * Math.PI * 2,
    look: lookOf(e),
  };
}

/** The whole system, star at the origin. */
export function layoutSystem(entries: SystemEntry[]): Body[] {
  const big = [...planets(entries), ...stations(entries)];
  const hosts = new Map(big.map((b) => [b.slug, b]));
  return [...big, ...moonsAndBelt(entries, hosts)];
}

/** Position of a body at time t (seconds), hosts resolved, in world units. */
export function positionAt(
  body: Body,
  t: number,
  bodies: ReadonlyMap<string, Body>,
): [number, number, number] {
  const a = body.phase + t * body.speed;
  const x = Math.cos(a) * body.orbit;
  const flat = Math.sin(a) * body.orbit;
  const local: [number, number, number] = [
    x,
    flat * Math.sin(body.tilt),
    flat * Math.cos(body.tilt),
  ];
  const host = body.host ? bodies.get(body.host) : undefined;
  if (!host) return local;
  const [hx, hy, hz] = positionAt(host, t, bodies);
  return [hx + local[0], hy + local[1], hz + local[2]];
}
