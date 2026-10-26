import { getCollection } from 'astro:content';
import type { SystemEntry } from '../system/layout';

/** Content entries as the 3D island needs them (serializable props, no body HTML). */
export async function systemEntries(): Promise<SystemEntry[]> {
  const entries = await getCollection('projects');
  return entries.map(({ id, data }) => ({
    slug: id,
    title: data.title,
    summary: data.summary,
    category: data.category,
    order: data.order,
    orbits: data.orbits,
    kind: data.kind,
    station: data.station,
    planet: data.planet,
  }));
}
