import { describe, expect, it } from 'vitest';
import {
  LAYOUT,
  hash01,
  layoutSystem,
  positionAt,
  type SystemEntry,
} from '../../src/system/layout';

const base = { summary: 's', orbits: [] as string[] };
const entries: SystemEntry[] = [
  { ...base, slug: 'vps', title: 'VPS', category: 'project', order: 1 },
  {
    ...base,
    slug: 'kalidoku',
    title: 'kalidoku',
    category: 'project',
    order: 2,
    planet: { type: 'gas', hue: 30 },
  },
  { ...base, slug: 'ratp', title: 'RATP', category: 'experience', order: 1, station: 'work' },
  {
    ...base,
    slug: 'rust',
    title: 'Rust',
    category: 'skill',
    order: 1,
    kind: 'technical',
    orbits: ['kalidoku', 'vps'],
  },
  {
    ...base,
    slug: 'docker',
    title: 'Docker',
    category: 'skill',
    order: 2,
    kind: 'technical',
    orbits: ['vps'],
  },
  {
    ...base,
    slug: 'talk',
    title: 'Talk',
    category: 'skill',
    order: 3,
    kind: 'soft',
    orbits: ['ratp'],
  },
  { ...base, slug: 'net', title: 'Net', category: 'skill', order: 4, kind: 'technical' },
];

const bodies = layoutSystem(entries);
const bySlug = new Map(bodies.map((b) => [b.slug, b]));

describe('layoutSystem', () => {
  it('turns projects into planets, experiences into stations, skills into moons or asteroids', () => {
    expect(bySlug.get('vps')?.kind).toBe('planet');
    expect(bySlug.get('ratp')?.kind).toBe('station');
    expect(bySlug.get('rust')).toMatchObject({ kind: 'moon', host: 'kalidoku' });
    expect(bySlug.get('talk')).toMatchObject({ kind: 'moon', host: 'ratp' });
    expect(bySlug.get('net')?.kind).toBe('asteroid');
  });

  it('makes more important projects bigger and closer to the star', () => {
    const vps = bySlug.get('vps');
    const kalidoku = bySlug.get('kalidoku');
    expect(vps && kalidoku && vps.radius > kalidoku.radius).toBe(true);
    expect(vps && kalidoku && vps.orbit < kalidoku.orbit).toBe(true);
    expect(kalidoku?.look.type).toBe('gas');
  });

  it('keeps every planet inside the arrival point and moons outside their host', () => {
    for (const b of bodies.filter((b) => b.kind === 'planet')) {
      expect(b.orbit).toBeLessThanOrEqual(LAYOUT.maxOrbit);
    }
    const docker = bySlug.get('docker');
    const vps = bySlug.get('vps');
    expect(docker && vps && docker.orbit > vps.radius + docker.radius).toBe(true);
  });

  it('is deterministic', () => {
    expect(layoutSystem(entries)).toEqual(bodies);
    expect(hash01('vps')).toBe(hash01('vps'));
  });
});

describe('positionAt', () => {
  it('keeps a planet on its orbit and moves it over time', () => {
    const vps = bySlug.get('vps');
    if (!vps) throw new Error('missing');
    const [x, y, z] = positionAt(vps, 0, bySlug);
    expect(Math.hypot(x, y, z)).toBeCloseTo(vps.orbit);
    expect(positionAt(vps, 10, bySlug)).not.toEqual([x, y, z]);
  });

  it('places a moon around its host', () => {
    const rust = bySlug.get('rust');
    const host = bySlug.get('kalidoku');
    if (!rust || !host) throw new Error('missing');
    const [mx, my, mz] = positionAt(rust, 3, bySlug);
    const [hx, hy, hz] = positionAt(host, 3, bySlug);
    expect(Math.hypot(mx - hx, my - hy, mz - hz)).toBeCloseTo(rust.orbit);
  });
});
