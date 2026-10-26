import { z } from 'astro/zod';

/**
 * Frontmatter of a portfolio entry (SPEC §6). One schema for the three kinds of bodies:
 * projects (planets), skills (moons, or belt asteroids) and experiences (stations).
 */
export const entrySchema = z
  .object({
    title: z.string().min(1),
    category: z.enum(['project', 'skill', 'experience']),
    /** One line: the label of the body, and the HTML version's teaser. */
    summary: z.string().min(1).max(160),
    tags: z.array(z.string()).default([]),
    links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
    /** Importance, 1 = most important: drives size and orbit. */
    order: z.number().int().positive(),
    /**
     * Skills only: slugs of the projects or experiences showing it, the first being the
     * body it orbits as a moon (SPEC §6 widened to a list in M6). None: asteroid belt.
     */
    orbits: z.array(z.string()).default([]),
    /** Skills only: technical, or a soft skill. */
    kind: z.enum(['technical', 'soft']).optional(),
    /** Experiences only: a job, or a school. */
    station: z.enum(['work', 'education']).optional(),
    /** Experiences only, e.g. "2026 – 2028". */
    period: z.string().optional(),
    planet: z
      .object({
        type: z.enum(['rocky', 'gas', 'ice', 'lava', 'ocean']),
        hue: z.number().min(0).max(360),
      })
      .optional(),
  })
  .refine((e) => e.category === 'skill' || e.orbits.length === 0, {
    message: 'only skills orbit other bodies',
    path: ['orbits'],
  })
  .refine((e) => (e.category === 'skill') === (e.kind !== undefined), {
    message: 'skills, and only skills, have a kind (technical or soft)',
    path: ['kind'],
  })
  .refine((e) => (e.category === 'experience') === (e.station !== undefined), {
    message: 'experiences, and only experiences, have a station type',
    path: ['station'],
  });

export type EntryData = z.infer<typeof entrySchema>;
