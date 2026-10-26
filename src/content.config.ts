import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { entrySchema } from './content/schema';

/** Portfolio entries (SPEC §6): the planetary system and the HTML version are built from them. */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: entrySchema,
});

export const collections = { projects };
