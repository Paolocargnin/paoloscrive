import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { optionsFromArguments } from '../scripts/workspace-cli.mjs';
import {
  createNote,
  developNote,
  publishDraft,
  scaffoldWorkspace,
  signTranslation,
  validateWorkspace,
} from '../scripts/workspace-lib.mjs';
import { parseMarkdownDocument } from '../scripts/markdown-lib.mjs';

const temporaryDirectories = [];

async function project() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'paoloscrive-'));
  temporaryDirectories.push(directory);
  const workspace = path.join(directory, 'content', 'workspace');
  const postsDirectory = path.join(directory, 'src', 'content', 'posts');
  await scaffoldWorkspace(workspace);
  await mkdir(postsDirectory, { recursive: true });
  return { workspace, postsDirectory };
}

async function writeDraftText(workspace, slug, data) {
  const file = path.join(workspace, 'bozze', slug, 'testo.md');
  const { data: current } = parseMarkdownDocument(
    await readFile(file, 'utf8'),
    file,
  );
  const frontmatter = Object.entries({ ...current, ...data })
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${key}: [${value.join(', ')}]`
        : `${key}: ${JSON.stringify(value)}`,
    )
    .join('\n');
  await writeFile(file, `---\n${frontmatter}\n---\n\nIl testo.\n`, 'utf8');
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('Workspace: Nota → Bozza → Racconto', () => {
  it('turns a Nota into a Bozza and keeps the Nota as appunti', async () => {
    const { workspace } = await project();
    await createNote({ workspace, slug: 'il-faro' });
    await writeFile(
      path.join(workspace, 'note', 'il-faro', 'testo.md'),
      'Una luce che aspetta.\n',
    );

    const draft = await developNote({ workspace, slug: 'il-faro' });

    expect(await readFile(path.join(draft, 'appunti.md'), 'utf8')).toBe(
      'Una luce che aspetta.\n',
    );
    const { data } = parseMarkdownDocument(
      await readFile(path.join(draft, 'testo.md'), 'utf8'),
      'testo.md',
    );
    expect(data.id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(validateWorkspace(workspace)).resolves.toBeUndefined();
  });

  it('will not publish without the Autore’s name', async () => {
    const { workspace, postsDirectory } = await project();
    await createNote({ workspace, slug: 'il-faro' });
    await developNote({ workspace, slug: 'il-faro' });

    await expect(
      publishDraft({ workspace, postsDirectory, slug: 'il-faro' }),
    ).rejects.toThrow("Questo comando lo esegue l'Autore");
  });

  it('publishes a complete Bozza once, dated, and files it under pubblicati', async () => {
    const { workspace, postsDirectory } = await project();
    await createNote({ workspace, slug: 'il-faro' });
    await developNote({ workspace, slug: 'il-faro' });
    await writeDraftText(workspace, 'il-faro', {
      title: 'Il faro',
      description: 'Una luce che aspetta una nave.',
      tags: ['memoria'],
    });

    const postFile = await publishDraft({
      workspace,
      postsDirectory,
      slug: 'il-faro',
      approvedBy: 'Paolo Cargnin',
    });

    const { data } = parseMarkdownDocument(
      await readFile(postFile, 'utf8'),
      postFile,
    );
    expect(data.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.lang).toBeUndefined();
    await expect(
      readFile(path.join(workspace, 'pubblicati', 'il-faro', 'testo.md')),
    ).resolves.toBeDefined();
    await expect(
      publishDraft({
        workspace,
        postsDirectory,
        slug: 'il-faro',
        approvedBy: 'Paolo Cargnin',
      }),
    ).rejects.toThrow('non esiste');
  });

  it('refuses an incomplete Bozza and leaves nothing public behind', async () => {
    const { workspace, postsDirectory } = await project();
    await createNote({ workspace, slug: 'il-faro' });
    await developNote({ workspace, slug: 'il-faro' });

    await expect(
      publishDraft({
        workspace,
        postsDirectory,
        slug: 'il-faro',
        approvedBy: 'Paolo Cargnin',
      }),
    ).rejects.toThrow('title deve essere un testo non vuoto');
    await expect(
      readFile(path.join(postsDirectory, 'il-faro.md')),
    ).rejects.toThrow();
  });

  it('signs a Translation only when it follows the current version', async () => {
    const { postsDirectory } = await project();
    await writeFile(
      path.join(postsDirectory, 'il-faro.md'),
      '---\nid: 6a4de3e2-126e-4bd7-a6ba-cd458e2a84ad\ntitle: Il faro\ndescription: Una luce.\npublishedAt: 2026-07-31\nrevisedAt: 2026-09-01\n---\n\nTesto.\n',
    );
    const translations = path.join(
      path.dirname(postsDirectory),
      'translations',
      'en',
    );
    await mkdir(translations, { recursive: true });
    const translation = path.join(translations, 'il-faro.md');
    await writeFile(
      translation,
      '---\ntitle: The lighthouse\ndescription: A light.\nbasedOn: 2026-07-31\n---\n\nText.\n',
    );

    await expect(
      signTranslation({
        postsDirectory,
        slug: 'il-faro',
        lang: 'en',
        signedBy: 'Paolo Cargnin',
      }),
    ).rejects.toThrow('Aggiornala prima di firmarla');

    await writeFile(
      translation,
      '---\ntitle: The lighthouse\ndescription: A light.\nbasedOn: 2026-09-01\n---\n\nText.\n',
    );
    await signTranslation({
      postsDirectory,
      slug: 'il-faro',
      lang: 'en',
      signedBy: 'Paolo Cargnin',
      signedAt: '2026-09-02',
    });
    const { data } = parseMarkdownDocument(
      await readFile(translation, 'utf8'),
      translation,
    );
    expect(data).toMatchObject({
      signedBy: 'Paolo Cargnin',
      signedAt: '2026-09-02',
    });
  });

  it('reads CLI options after the pnpm separator', () => {
    expect(
      optionsFromArguments([
        '--',
        '--slug',
        'il-faro',
        '--approved-by',
        'Paolo',
      ]),
    ).toEqual(
      new Map([
        ['--slug', 'il-faro'],
        ['--approved-by', 'Paolo'],
      ]),
    );
  });
});
