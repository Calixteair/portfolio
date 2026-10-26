import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { entrySchema, type EntryData } from '../../src/content/schema';

const DIR = join(import.meta.dirname, '../../src/content/projects');

function frontmatter(file: string): unknown {
  const text = readFileSync(join(DIR, file), 'utf8');
  return parse(text.split('---')[1] ?? '');
}

const entries = new Map<string, EntryData>(
  readdirSync(DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => [f.replace(/\.md$/, ''), entrySchema.parse(frontmatter(f))]),
);

describe('portfolio content', () => {
  it('validates every entry against the schema', () => {
    expect(entries.size).toBeGreaterThan(30);
  });

  it('has projects, technical and soft skills, jobs and schools', () => {
    const all = [...entries.values()];
    expect(all.filter((e) => e.category === 'project').length).toBeGreaterThanOrEqual(10);
    expect(all.some((e) => e.kind === 'technical')).toBe(true);
    expect(all.some((e) => e.kind === 'soft')).toBe(true);
    expect(all.some((e) => e.station === 'work')).toBe(true);
    expect(all.some((e) => e.station === 'education')).toBe(true);
  });

  it('makes every moon orbit existing projects or experiences', () => {
    for (const [slug, e] of entries) {
      for (const host of e.orbits) {
        const target = entries.get(host);
        expect(target, `${slug} orbits unknown "${host}"`).toBeDefined();
        expect(target?.category, `${slug} orbits a skill`).not.toBe('skill');
      }
    }
  });

  it('keeps orders unique within a category', () => {
    const seen = new Set<string>();
    for (const [slug, e] of entries) {
      const key = `${e.category}/${e.kind ?? e.station ?? ''}/${e.order}`;
      expect(seen.has(key), `${slug}: duplicate order ${key}`).toBe(false);
      seen.add(key);
    }
  });
});
