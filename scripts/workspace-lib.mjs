import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  latestVersionDate,
  translationsDirectoryFor,
  validateContent,
  validatePublicContent,
  validateRaccontoFile,
} from './content-contract.mjs';
import {
  parseMarkdownDocument,
  serializeMarkdownDocument,
} from './markdown-lib.mjs';
import {
  contentContract,
  languageCodes,
  slugPattern,
} from '../src/content/contract.mjs';

const utf8 = 'utf8';
const { textFile } = contentContract.workspace;

export function workspacePath(value) {
  return path.resolve(value ?? 'content/workspace');
}

export function requireSlug(slug) {
  if (typeof slug !== 'string' || !slugPattern.test(slug)) {
    throw new Error('Serve --slug, in minuscole con i trattini.');
  }
  return slug;
}

/**
 * Publication and Firma are Paolo's acts (ADR 0023, ADR 0022). An agent must
 * stop and ask him to run the command, or to authorize it in his own words.
 */
export function requireHuman(name, flag) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(
      `Questo comando lo esegue l'Autore. Rilancialo tu con ${flag} "Il tuo nome".`,
    );
  }
  return name.trim();
}

export function today() {
  return new Date().toLocaleDateString('sv-SE');
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function textDirectory(workspace, lifecycle, slug) {
  return path.join(workspace, lifecycle, requireSlug(slug));
}

export async function scaffoldWorkspace(workspace) {
  await mkdir(workspace, { recursive: true });
  await writeFile(
    path.join(workspace, contentContract.workspace.manifest),
    `${JSON.stringify({ version: contentContract.version }, null, 2)}\n`,
    utf8,
  );
  await Promise.all(
    contentContract.workspace.lifecycleDirectories.map(async (lifecycle) => {
      await mkdir(path.join(workspace, lifecycle), { recursive: true });
      await writeFile(path.join(workspace, lifecycle, '.gitkeep'), '', utf8);
    }),
  );
}

/** Nota: raw material that may become a Racconto. */
export async function createNote({ workspace, slug }) {
  const directory = textDirectory(workspace, 'note', slug);
  for (const lifecycle of contentContract.workspace.lifecycleDirectories) {
    if (await exists(textDirectory(workspace, lifecycle, slug))) {
      throw new Error(
        `${slug} esiste già in ${lifecycle}/; scegli un altro slug.`,
      );
    }
  }
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, textFile),
    `# ${slug.replaceAll('-', ' ')}\n\nL'idea, la scena, la frase, il dialogo.\n`,
    utf8,
  );
  return directory;
}

/**
 * Nota → Bozza. The Nota's text is kept as appunti.md and a new testo.md
 * gets a stable id and the metadata a Racconto needs, still empty.
 */
export async function developNote({ workspace, slug }) {
  const noteDirectory = textDirectory(workspace, 'note', slug);
  const draftDirectory = textDirectory(workspace, 'bozze', slug);
  const noteFile = path.join(noteDirectory, textFile);
  if (!(await exists(noteFile))) {
    throw new Error(
      `${noteFile} non esiste; prima crea la Nota con pnpm nota.`,
    );
  }
  if (await exists(draftDirectory)) {
    throw new Error(`${draftDirectory} esiste già.`);
  }

  const noteText = await readFile(noteFile, utf8);
  const appuntiFile = path.join(noteDirectory, 'appunti.md');
  const earlier = (await exists(appuntiFile))
    ? `${(await readFile(appuntiFile, utf8)).trimEnd()}\n\n---\n\n`
    : '';
  await mkdir(path.dirname(draftDirectory), { recursive: true });
  await rename(noteDirectory, draftDirectory);
  await writeFile(
    path.join(draftDirectory, 'appunti.md'),
    `${earlier}${noteText}`,
    utf8,
  );
  await writeFile(
    path.join(draftDirectory, textFile),
    serializeMarkdownDocument(
      {
        id: randomUUID(),
        title: '',
        description: '',
        lang: contentContract.defaultLanguage,
        tags: [],
      },
      '',
    ),
    utf8,
  );
  return draftDirectory;
}

/**
 * Bozza → Racconto. Copies testo.md into the public Posts, dated today unless
 * the Bozza already carries a publishedAt, then files the Bozza under
 * pubblicati/. It never overwrites a Racconto.
 */
export async function publishDraft({
  workspace,
  postsDirectory,
  slug,
  approvedBy,
}) {
  requireHuman(approvedBy, '--approved-by');
  const draftDirectory = textDirectory(workspace, 'bozze', slug);
  const draftFile = path.join(draftDirectory, textFile);
  const postFile = path.join(postsDirectory, `${slug}.md`);
  if (!(await exists(draftFile))) {
    throw new Error(
      `${draftFile} non esiste; prima trasforma la Nota in Bozza.`,
    );
  }
  if (await exists(postFile)) {
    throw new Error(`${postFile} esiste già; un Racconto non si sovrascrive.`);
  }

  await validateContent({ postsDirectory, workspaceDirectory: workspace });
  const source = await readFile(draftFile, utf8);
  const { data, body } = parseMarkdownDocument(source, draftFile);
  const published = { ...data, publishedAt: data.publishedAt ?? today() };
  if (Array.isArray(published.tags) && published.tags.length === 0) {
    delete published.tags;
  }
  if (published.lang === contentContract.defaultLanguage) {
    delete published.lang;
  }

  await mkdir(postsDirectory, { recursive: true });
  await writeFile(postFile, serializeMarkdownDocument(published, body), utf8);
  try {
    await validateRaccontoFile(postFile, slug);
    await validatePublicContent({ postsDirectory });
  } catch (error) {
    await rm(postFile);
    throw error;
  }

  const publishedDirectory = textDirectory(workspace, 'pubblicati', slug);
  await mkdir(path.dirname(publishedDirectory), { recursive: true });
  await rename(draftDirectory, publishedDirectory);
  return postFile;
}

/**
 * Firma (ADR 0022): Paolo has re-read a Translation, with or without changes,
 * and makes it his. Records who signed and when; the notice disappears.
 */
export async function signTranslation({
  postsDirectory,
  slug,
  lang,
  signedBy,
  signedAt = today(),
}) {
  requireHuman(signedBy, '--signed-by');
  requireSlug(slug);
  if (!languageCodes.includes(lang)) {
    throw new Error(`Serve --lang, una di ${languageCodes.join(', ')}.`);
  }
  const translationFile = path.join(
    translationsDirectoryFor(postsDirectory),
    lang,
    `${slug}.md`,
  );
  const postFile = path.join(postsDirectory, `${slug}.md`);
  if (!(await exists(translationFile))) {
    throw new Error(`${translationFile} non esiste.`);
  }

  const translation = parseMarkdownDocument(
    await readFile(translationFile, utf8),
    translationFile,
  );
  const racconto = parseMarkdownDocument(
    await readFile(postFile, utf8),
    postFile,
  );
  const current = latestVersionDate(racconto.data);
  if (translation.data.basedOn !== current) {
    throw new Error(
      `La Traduzione segue la versione del ${translation.data.basedOn}, il Racconto è alla versione del ${current}. Aggiornala prima di firmarla.`,
    );
  }

  const signed = {
    ...translation.data,
    signedBy: signedBy.trim(),
    signedAt,
  };
  await writeFile(
    translationFile,
    serializeMarkdownDocument(signed, translation.body),
    utf8,
  );
  await validatePublicContent({ postsDirectory });
  return translationFile;
}

export async function validateWorkspace(workspace) {
  await validateContent({ workspaceDirectory: workspace });
}
