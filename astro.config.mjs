// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { validatePublicContent } from './scripts/content-contract.mjs';

// Set PUBLIC_SITE_URL in the production build environment (docs/deployment.md).
// The reserved .example domain keeps local and CI builds from ever claiming a
// real origin by accident.
const site = process.env.PUBLIC_SITE_URL || 'https://paoloscrive.example';

export default defineConfig({
  site,
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
