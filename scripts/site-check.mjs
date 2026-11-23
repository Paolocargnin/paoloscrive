import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { contentContract } from '../src/content/contract.mjs';

const outputDirectory = path.resolve('dist');
const postsDirectory = path.resolve('src/content/posts');
const translationsDirectory = path.resolve('src/content/translations');

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(filePath) : [filePath];
    }),
  );

  return files.flat();
}

function outputFileForPathname(pathname) {
  const decoded = decodeURIComponent(pathname);
  return path.join(outputDirectory, decoded, 'index.html');
}

async function assertFile(filePath, message) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(
      `${message}: ${filePath.replace(`${outputDirectory}/`, '')}`,
    );
  }
}

function internalLinks(html) {
  return [...html.matchAll(/\shref="([^"]+)"/g)]
    .map(([, href]) => href)
    .filter((href) => href.startsWith('/') && !href.startsWith('//'))
    .map((href) => href.split('#')[0].split('?')[0])
    .filter((href) => Boolean(href) && !path.extname(href));
}

const outputFiles = await filesIn(outputDirectory);
const htmlFiles = outputFiles.filter((filePath) => filePath.endsWith('.html'));

if (htmlFiles.length === 0) {
  throw new Error(
    'Site check failed: no built HTML files found. Run pnpm build first.',
  );
}

// Every Racconto is built at /racconti/<slug>/ and every Translation at
// /racconti/<slug>/<lang>/ (ADR 0022). Built routes must match the sources
// exactly, in both directions.
const markdownNames = async (directory) => {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && path.extname(entry.name) === '.md')
      .map((entry) => path.basename(entry.name, '.md'));
  } catch {
    return [];
  }
};

const expectedRoutes = (await markdownNames(postsDirectory)).map(
  (slug) => slug,
);
for (const lang of Object.keys(contentContract.languages)) {
  for (const slug of await markdownNames(
    path.join(translationsDirectory, lang),
  )) {
    expectedRoutes.push(`${slug}/${lang}`);
  }
}

const raccontiDirectory = path.join(outputDirectory, 'racconti');
await assertFile(
  path.join(raccontiDirectory, 'index.html'),
  'Site check failed: missing Racconti archive',
);
const builtRoutes = [];
for (const entry of await readdir(raccontiDirectory, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }
  builtRoutes.push(entry.name);
  for (const child of await readdir(path.join(raccontiDirectory, entry.name), {
    withFileTypes: true,
  })) {
    if (child.isDirectory()) {
      builtRoutes.push(`${entry.name}/${child.name}`);
    }
  }
}

expectedRoutes.sort();
builtRoutes.sort();
const missingRoutes = expectedRoutes.filter(
  (route) => !builtRoutes.includes(route),
);
const unexpectedRoutes = builtRoutes.filter(
  (route) => !expectedRoutes.includes(route),
);
if (missingRoutes.length > 0 || unexpectedRoutes.length > 0) {
  throw new Error(
    `Site check failed: built Racconto routes do not match their sources (missing: ${missingRoutes.join(', ') || 'none'}; unexpected: ${unexpectedRoutes.join(', ') || 'none'}).`,
  );
}

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  const relativePath = path.relative(outputDirectory, htmlFile);

  for (const pattern of [
    /<link rel="canonical" href="https:\/\//,
    /<link rel="alternate" type="application\/rss\+xml"/,
    /<meta property="og:title"/,
    /<meta property="og:description"/,
    /<meta name="twitter:card" content="summary"/,
    /<script type="application\/ld\+json">/,
  ]) {
    if (!pattern.test(html)) {
      throw new Error(
        `Site check failed: ${relativePath} is missing ${pattern}.`,
      );
    }
  }

  for (const href of internalLinks(html)) {
    await assertFile(
      outputFileForPathname(href),
      'Site check failed: broken internal link',
    );
  }
}

const rss = await readFile(path.join(outputDirectory, 'rss.xml'), 'utf8');
if (!rss.includes('<rss') || !rss.includes('<channel>')) {
  throw new Error('Site check failed: rss.xml is not a valid RSS channel.');
}

const robots = await readFile(path.join(outputDirectory, 'robots.txt'), 'utf8');
if (
  !robots.includes('Sitemap: https://') ||
  !robots.includes('/sitemap-index.xml')
) {
  throw new Error(
    'Site check failed: robots.txt does not advertise the sitemap index.',
  );
}

const sitemapIndex = await readFile(
  path.join(outputDirectory, 'sitemap-index.xml'),
  'utf8',
);
if (!sitemapIndex.includes('sitemap-0.xml')) {
  throw new Error(
    'Site check failed: sitemap index does not point to the generated sitemap.',
  );
}

const sitemap = await readFile(
  path.join(outputDirectory, 'sitemap-0.xml'),
  'utf8',
);
if (!sitemap.includes('<urlset') || !sitemap.includes('/come-scrivo/')) {
  throw new Error(
    'Site check failed: sitemap does not include the public Come scrivo page.',
  );
}

const builtPages = await Promise.all(
  htmlFiles.map((htmlFile) => readFile(htmlFile, 'utf8')),
);
if (
  builtPages.some((html) =>
    html.includes('static.cloudflareinsights.com/beacon.min.js'),
  )
) {
  throw new Error(
    'Site check failed: analytics beacon unexpectedly appeared in local output.',
  );
}

console.log(`Site check passed for ${htmlFiles.length} HTML pages.`);
