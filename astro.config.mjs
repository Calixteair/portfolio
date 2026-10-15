import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Static output only (no SSR): the site is served by nginx-unprivileged.
export default defineConfig({
  site: 'https://portfolio.calixteair.fr',
  output: 'static',
  integrations: [react()],
});
