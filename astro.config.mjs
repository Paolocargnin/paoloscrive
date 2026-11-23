// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';

import rehypeCapolettera from './src/markdown/rehype-capolettera.mjs';

import { validatePublicContent } from './scripts/content-contract.mjs';

// https://paoloscrive.it is the canonical origin (ADR 0021). Production sets
// PUBLIC_SITE_URL to the same value; see docs/deployment.md.
const site = process.env.PUBLIC_SITE_URL || 'https://paoloscrive.it';

export default defineConfig({
  site,
  markdown: {
    // The drop cap and hanging dash of the Collana (ADR 0025) need a rehype
    // plugin, which runs on the unified processor.
    processor: unified({ rehypePlugins: [rehypeCapolettera] }),
  },
  integrations: [
    sitemap(),
    {
      name: 'public-content-contract',
      hooks: {
        'astro:build:start': async () => {
          await validatePublicContent();
        },
      },
    },
  ],
});
