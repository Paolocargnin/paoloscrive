import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path) => readFile(path, 'utf8');

describe('reading surfaces', () => {
  it('keeps a skip link, reduced motion and the Collana typefaces in the layout', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');

    expect(layout).toContain('Vai al contenuto');
    expect(layout).toContain('prefers-reduced-motion: reduce');
    expect(layout).toContain("'Bodoni Moda Variable'");
    expect(layout).toContain("'EB Garamond Variable'");
    expect(layout).toContain('prefers-color-scheme: dark');
  });

  it('keeps the page shell free of a minimum width so enlarged text can reflow', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');
    const bodyRule = layout.match(/\n  body \{([\s\S]*?)\n  \}/)?.[1];

    expect(bodyRule).toBeDefined();
    expect(bodyRule).not.toMatch(/\bmin-width\s*:/);
    expect(bodyRule).toContain('overflow-wrap: anywhere;');
  });

  it('keeps canonical, social, structured and production-only analytics metadata', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');

    expect(layout).toContain('rel="canonical"');
    expect(layout).toContain('application/rss+xml');
    expect(layout).toContain('property="og:title"');
    expect(layout).toContain('application/ld+json');
    expect(layout).toContain('import.meta.env.PROD');
    expect(layout).toContain('PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN');
  });

  it('provides the home, archive, Racconto, Translation, Temi, about, process and 404 routes', async () => {
    const pages = await Promise.all(
      [
        'src/pages/index.astro',
        'src/pages/racconti/index.astro',
        'src/pages/racconti/[slug]/index.astro',
        'src/pages/racconti/[slug]/[lang].astro',
        'src/pages/temi/index.astro',
        'src/pages/temi/[tag].astro',
        'src/pages/chi-sono.astro',
        'src/pages/come-scrivo.astro',
        'src/pages/404.astro',
        'src/pages/rss.xml.js',
        'src/pages/robots.txt.ts',
      ].map(read),
    );

    expect(pages[0]).toContain('<Shelf');
    expect(pages[2]).toContain('<PostArticle');
    expect(pages[3]).toContain('translation={translation}');
    expect(pages[4]).toContain('controlledTagIds');
    expect(pages[7]).toContain('Le traduzioni');
    expect(pages[9]).toContain('@astrojs/rss');
    expect(pages[10]).toContain('Sitemap:');
  });

  it('turns the frontispiece band into the AI notice until a Translation is signed', async () => {
    const article = await read('src/components/PostArticle.astro');

    expect(article).toContain(
      'const unsigned = translation !== undefined && !isSigned(translation);',
    );
    expect(article).toContain(
      '<p class="band small-caps" role="note">{text.notice}</p>',
    );
    expect(article).toContain('Rivisto il');
    expect(article).toContain('Finito di scrivere');
  });

  it('draws the home as a shelf of spines with a card for each volume', async () => {
    const shelf = await read('src/components/Shelf.astro');

    expect(shelf).toContain('writing-mode: vertical-rl');
    expect(shelf).toContain('in preparazione');
    expect(shelf).toContain('flex-direction: column-reverse');
  });
});
