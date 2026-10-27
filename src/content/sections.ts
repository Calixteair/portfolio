import { getCollection, render, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'projects'>;

/** How an entry is labelled: its category, soft skills apart. */
export function kindLabel(e: Entry): string {
  if (e.data.category === 'skill') return e.data.kind === 'soft' ? 'Savoir-être' : 'Compétence';
  return e.data.category === 'project' ? 'Projet' : 'Parcours';
}

/**
 * The content, grouped as both the 3D system's panels and the classic page present it:
 * projects, experiences, technical skills, soft skills. Plus what links entries together
 * (a skill orbits projects; a project has skills as moons) and each rendered body.
 */
export async function loadSections() {
  const entries = (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order);
  const isSkill = (e: Entry, kind: 'technical' | 'soft') =>
    e.data.category === 'skill' && e.data.kind === kind;
  const groups = [
    {
      id: 'projets',
      title: 'Projets',
      items: entries.filter((e) => e.data.category === 'project'),
    },
    {
      id: 'parcours',
      title: 'Parcours',
      items: entries.filter((e) => e.data.category === 'experience'),
    },
    {
      id: 'competences',
      title: 'Compétences techniques',
      items: entries.filter((e) => isSkill(e, 'technical')),
    },
    { id: 'savoir-etre', title: 'Savoir-être', items: entries.filter((e) => isSkill(e, 'soft')) },
  ];
  const titles = new Map(entries.map((e) => [e.id, e.data.title]));
  const related = (e: Entry): Entry[] =>
    e.data.category === 'skill'
      ? entries.filter((o) => e.data.orbits.includes(o.id))
      : entries.filter((o) => o.data.category === 'skill' && o.data.orbits.includes(e.id));
  const bodies = new Map(
    await Promise.all(entries.map(async (e) => [e.id, (await render(e)).Content] as const)),
  );
  return { entries, groups, titles, related, bodies };
}

export type Sections = Awaited<ReturnType<typeof loadSections>>;
