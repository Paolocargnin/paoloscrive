import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  contentContract,
  controlledTagIds,
  languageCodes,
  slugPattern,
  stableIdPattern,
  writtenAtPattern,
} from '../src/content/contract.mjs';
import {
  isIsoDate,
  isPlainObject,
  parseMarkdownDocument,
} from './markdown-lib.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const markdownExtension = '.md';

export class ContentContractError extends Error {
  constructor(errors) {
    super(
      `Il contratto dei contenuti non è rispettato:\n${errors.map((error) => `- ${error}`).join('\n')}`,
    );
    this.name = 'ContentContractError';
    this.errors = errors;
  }
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readMarkdown(filePath, errors) {
  const source = await readFile(filePath, 'utf8');
  try {
    return parseMarkdownDocument(source, filePath);
  } catch (error) {
    errors.push(error.message);
    return { data: {}, body: source };
  }
}

function requireString(data, field, filePath, errors) {
  if (typeof data[field] !== 'string' || data[field].trim() === '') {
    errors.push(`${filePath}: ${field} deve essere un testo non vuoto.`);
  }
}

function rejectUnknownFields(data, allowed, filePath, what, errors) {
  for (const field of Object.keys(data)) {
    if (!allowed.has(field)) {
      errors.push(`${filePath}: ${field} non è un metadato di ${what}.`);
    }
  }
}

/** The date of the version a reader sees: the last Revisione, or publication. */
export function latestVersionDate(data) {
  return isIsoDate(data.revisedAt) ? data.revisedAt : data.publishedAt;
}

export function raccontoLanguage(data) {
  return data.lang ?? contentContract.defaultLanguage;
}

function validateRaccontoMetadata(data, filePath, errors) {
  const { requiredMetadata, optionalMetadata, maxTags } =
    contentContract.racconto;
  rejectUnknownFields(
    data,
    new Set([...requiredMetadata, ...optionalMetadata]),
    filePath,
    'un Racconto (lo slug pubblico viene dal nome del file)',
    errors,
  );
  for (const field of requiredMetadata) {
    if (!(field in data)) {
      errors.push(`${filePath}: manca il metadato obbligatorio ${field}.`);
    }
  }

  if (typeof data.id !== 'string' || !stableIdPattern.test(data.id)) {
    errors.push(
      `${filePath}: id deve essere un UUID, così resta stabile dalla Bozza al Racconto.`,
    );
  }
  requireString(data, 'title', filePath, errors);
  requireString(data, 'description', filePath, errors);

  if (!isIsoDate(data.publishedAt)) {
    errors.push(`${filePath}: publishedAt deve essere una data AAAA-MM-GG.`);
  }
  if ('revisedAt' in data) {
    if (!isIsoDate(data.revisedAt)) {
      errors.push(`${filePath}: revisedAt deve essere una data AAAA-MM-GG.`);
    } else if (
      isIsoDate(data.publishedAt) &&
      data.revisedAt < data.publishedAt
    ) {
      errors.push(
        `${filePath}: revisedAt non può precedere la data di pubblicazione.`,
      );
    }
  }

  if ('writtenAt' in data && !writtenAtPattern.test(String(data.writtenAt))) {
    errors.push(
      `${filePath}: writtenAt è un anno, un mese o un giorno (2009, 2009-08 o 2009-08-14).`,
    );
  }

  if ('lang' in data && !languageCodes.includes(data.lang)) {
    errors.push(
      `${filePath}: lang deve essere una di ${languageCodes.join(', ')}.`,
    );
  }

  if ('tags' in data) {
    if (!Array.isArray(data.tags) || data.tags.length > maxTags) {
      errors.push(
        `${filePath}: tags deve essere una lista di al massimo ${maxTags} temi.`,
      );
    } else {
      const unknown = data.tags.filter(
        (tag) => !controlledTagIds.includes(tag),
      );
      if (unknown.length > 0) {
        errors.push(
          `${filePath}: temi sconosciuti: ${unknown.join(', ')}. Usa il vocabolario controllato.`,
        );
      }
      if (new Set(data.tags).size !== data.tags.length) {
        errors.push(`${filePath}: un tema compare due volte.`);
      }
    }
  }
}

/**
 * Validate one Markdown document before a Bozza is published as a Racconto.
 * The Bozza keeps its testo.md filename in the Workspace, so the intended
 * public slug is supplied separately.
 */
export async function validateRaccontoFile(filePath, slug, postsDirectory) {
  const errors = [];
  if (!slugPattern.test(slug)) {
    errors.push(`${slug}: lo slug usa solo minuscole, cifre e trattini.`);
  }
  const { data } = await readMarkdown(filePath, errors);
  validateRaccontoMetadata(data, filePath, errors);

  if (postsDirectory && (await exists(postsDirectory))) {
    for (const entry of await readdir(postsDirectory, {
      withFileTypes: true,
    })) {
      if (!entry.isFile() || path.extname(entry.name) !== markdownExtension) {
        continue;
      }
      const existing = path.join(postsDirectory, entry.name);
      const { data: existingData } = await readMarkdown(existing, errors);
      if (existingData.id === data.id) {
        errors.push(`${filePath}: id già usato da ${existing}.`);
      }
    }
  }
  if (errors.length > 0) {
    throw new ContentContractError(errors);
  }
}

async function validatePublicDirectory(postsDirectory, errors) {
  const racconti = new Map();
  if (!(await exists(postsDirectory))) {
    errors.push(`${postsDirectory}: la cartella dei Racconti è obbligatoria.`);
    return racconti;
  }

  const ids = new Map();
  for (const entry of await readdir(postsDirectory, { withFileTypes: true })) {
    const entryPath = path.join(postsDirectory, entry.name);
    if (entry.isSymbolicLink() || entry.isDirectory()) {
      errors.push(
        `${entryPath}: i Racconti sono file Markdown al primo livello, così l'URL viene dal nome del file.`,
      );
      continue;
    }
    if (path.extname(entry.name) !== markdownExtension) {
      if (entry.name !== '.gitkeep') {
        errors.push(`${entryPath}: qui sono ammessi solo file Markdown.`);
      }
      continue;
    }

    const slug = path.basename(entry.name, markdownExtension);
    if (!slugPattern.test(slug)) {
      errors.push(
        `${entryPath}: il nome del file usa solo minuscole, cifre e trattini.`,
      );
    }
    const { data } = await readMarkdown(entryPath, errors);
    validateRaccontoMetadata(data, entryPath, errors);
    if (typeof data.id === 'string' && stableIdPattern.test(data.id)) {
      if (ids.has(data.id)) {
        errors.push(`${entryPath}: id già usato da ${ids.get(data.id)}.`);
      } else {
        ids.set(data.id, entryPath);
      }
    }
    racconti.set(slug, data);
  }
  return racconti;
}

export function translationsDirectoryFor(postsDirectory) {
  return path.join(path.dirname(postsDirectory), 'translations');
}

// ADR 0022: a Translation lives at translations/<lang>/<slug>.md. It names the
// version of the Racconto it follows (basedOn) and may carry Paolo's Firma.
async function validateTranslationsDirectory(
  translationsDirectory,
  racconti,
  errors,
) {
  if (!(await exists(translationsDirectory))) {
    return;
  }
  const { requiredMetadata, optionalMetadata } = contentContract.translation;
  const allowed = new Set([...requiredMetadata, ...optionalMetadata]);

  for (const entry of await readdir(translationsDirectory, {
    withFileTypes: true,
  })) {
    const languagePath = path.join(translationsDirectory, entry.name);
    if (!entry.isDirectory() || !languageCodes.includes(entry.name)) {
      if (entry.name !== '.gitkeep') {
        errors.push(
          `${languagePath}: le Traduzioni stanno in una cartella per lingua (${languageCodes.join(', ')}).`,
        );
      }
      continue;
    }
    const lang = entry.name;
    for (const file of await readdir(languagePath, { withFileTypes: true })) {
      const filePath = path.join(languagePath, file.name);
      if (!file.isFile() || path.extname(file.name) !== markdownExtension) {
        errors.push(`${filePath}: qui sono ammessi solo file Markdown.`);
        continue;
      }
      const slug = path.basename(file.name, markdownExtension);
      const racconto = racconti.get(slug);
      if (!racconto) {
        errors.push(`${filePath}: non esiste un Racconto pubblicato ${slug}.`);
        continue;
      }
      if (raccontoLanguage(racconto) === lang) {
        errors.push(
          `${filePath}: ${slug} è già scritto in questa lingua; la Traduzione va nell'altra.`,
        );
      }

      const { data } = await readMarkdown(filePath, errors);
      rejectUnknownFields(data, allowed, filePath, 'una Traduzione', errors);
      requireString(data, 'title', filePath, errors);
      requireString(data, 'description', filePath, errors);

      const current = latestVersionDate(racconto);
      if (!isIsoDate(data.basedOn)) {
        errors.push(`${filePath}: basedOn deve essere una data AAAA-MM-GG.`);
      } else if (data.basedOn !== current) {
        errors.push(
          `${filePath}: segue la versione del ${data.basedOn}, ma il Racconto è alla versione del ${current}. La Revisione non esce finché la Traduzione non la segue (basedOn: ${current}).`,
        );
      }

      const hasSigner = 'signedBy' in data;
      const hasDate = 'signedAt' in data;
      if (hasSigner !== hasDate) {
        errors.push(
          `${filePath}: la Firma ha bisogno di signedBy e signedAt insieme.`,
        );
      }
      if (hasSigner) {
        requireString(data, 'signedBy', filePath, errors);
        if (!isIsoDate(data.signedAt)) {
          errors.push(`${filePath}: signedAt deve essere una data AAAA-MM-GG.`);
        } else if (isIsoDate(data.basedOn) && data.signedAt < data.basedOn) {
          errors.push(
            `${filePath}: la Firma del ${data.signedAt} è precedente alla versione che la Traduzione segue. Se l'ha aggiornata l'IA, togli signedBy e signedAt; se l'hai riletta, firma di nuovo con pnpm firma.`,
          );
        }
      }
    }
  }
}

// ADR 0021: raw material (voice memos, photos of notebook pages, scans) lives
// beside a working text in a flat materiali/ folder. Publication copies only
// testo.md, so material never reaches the public repository.
async function validateMaterials(materialsPath, errors) {
  const { materialExtensions } = contentContract.workspace;
  for (const entry of await readdir(materialsPath, { withFileTypes: true })) {
    const entryPath = path.join(materialsPath, entry.name);
    if (!entry.isFile()) {
      errors.push(`${entryPath}: materiali/ contiene solo file.`);
    } else if (
      !materialExtensions.includes(path.extname(entry.name).toLowerCase())
    ) {
      errors.push(
        `${entryPath}: tipo di materiale non ammesso (${materialExtensions.join(', ')}).`,
      );
    }
  }
}

async function validateWorkingText(textPath, lifecycle, errors) {
  const { textFile, acceptedSidecars, materialsDirectory } =
    contentContract.workspace;
  if (!slugPattern.test(path.basename(textPath))) {
    errors.push(
      `${textPath}: le cartelle del Workspace usano solo minuscole, cifre e trattini.`,
    );
  }

  const accepted = new Set([textFile, ...acceptedSidecars]);
  for (const entry of await readdir(textPath, { withFileTypes: true })) {
    const entryPath = path.join(textPath, entry.name);
    if (entry.isDirectory() && entry.name === materialsDirectory) {
      await validateMaterials(entryPath, errors);
    } else if (!entry.isFile() || !accepted.has(entry.name)) {
      errors.push(
        `${entryPath}: file non previsto. Il contratto v${contentContract.version} accetta ${[...accepted].join(', ')} e la cartella ${materialsDirectory}/.`,
      );
    }
  }

  const textFilePath = path.join(textPath, textFile);
  if (!(await exists(textFilePath))) {
    errors.push(`${textPath}: manca ${textFile}.`);
    return;
  }
  if (lifecycle === 'note') {
    return;
  }
  const { data } = await readMarkdown(textFilePath, errors);
  if (typeof data.id !== 'string' || !stableIdPattern.test(data.id)) {
    errors.push(
      `${textFilePath}: una Bozza ha un id UUID nel frontmatter, creato da pnpm bozza.`,
    );
  }
}

async function validateWorkspaceDirectory(workspaceDirectory, errors) {
  if (!(await exists(workspaceDirectory))) {
    return false;
  }
  const { manifest, lifecycleDirectories } = contentContract.workspace;

  const manifestPath = path.join(workspaceDirectory, manifest);
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!isPlainObject(parsed) || parsed.version !== contentContract.version) {
      errors.push(
        `${manifestPath}: atteso {"version": ${contentContract.version}}. Migra il Workspace prima di continuare.`,
      );
    }
  } catch {
    errors.push(
      `${manifestPath}: serve un JSON valido con la versione ${contentContract.version} del contratto.`,
    );
  }

  const allowedRoot = new Set([
    manifest,
    ...lifecycleDirectories,
    '.git',
    'README.md',
  ]);
  for (const entry of await readdir(workspaceDirectory, {
    withFileTypes: true,
  })) {
    if (!allowedRoot.has(entry.name)) {
      errors.push(
        `${path.join(workspaceDirectory, entry.name)}: voce non prevista nel Workspace.`,
      );
    }
  }

  for (const lifecycle of lifecycleDirectories) {
    const lifecycleDirectory = path.join(workspaceDirectory, lifecycle);
    if (!(await exists(lifecycleDirectory))) {
      continue;
    }
    for (const entry of await readdir(lifecycleDirectory, {
      withFileTypes: true,
    })) {
      const entryPath = path.join(lifecycleDirectory, entry.name);
      if (!entry.isDirectory()) {
        if (entry.name !== '.gitkeep') {
          errors.push(`${entryPath}: ${lifecycle}/ contiene solo cartelle.`);
        }
        continue;
      }
      await validateWorkingText(entryPath, lifecycle, errors);
    }
  }
  return true;
}

async function assertWorkspaceIsPrivate(
  postsDirectory,
  workspaceDirectory,
  errors,
) {
  if (!(await exists(workspaceDirectory)) || !(await exists(postsDirectory))) {
    return;
  }
  const relative = path.relative(
    await realpath(postsDirectory),
    await realpath(workspaceDirectory),
  );
  if (relative === '' || !relative.startsWith('..')) {
    errors.push(
      `${workspaceDirectory}: il Workspace deve stare fuori dalla cartella dei Racconti.`,
    );
  }
}

const defaultPostsDirectory = path.join(projectRoot, 'src/content/posts');
const defaultWorkspaceDirectory = path.join(projectRoot, 'content/workspace');

export async function validatePublicContent({
  postsDirectory = defaultPostsDirectory,
} = {}) {
  const errors = [];
  const resolved = path.resolve(postsDirectory);
  const racconti = await validatePublicDirectory(resolved, errors);
  await validateTranslationsDirectory(
    translationsDirectoryFor(resolved),
    racconti,
    errors,
  );
  if (errors.length > 0) {
    throw new ContentContractError(errors);
  }
}

export async function validateContent({
  postsDirectory = defaultPostsDirectory,
  workspaceDirectory = defaultWorkspaceDirectory,
  publicOnly = false,
} = {}) {
  const errors = [];
  const resolvedPosts = path.resolve(postsDirectory);
  const resolvedWorkspace = path.resolve(workspaceDirectory);

  const racconti = await validatePublicDirectory(resolvedPosts, errors);
  await validateTranslationsDirectory(
    translationsDirectoryFor(resolvedPosts),
    racconti,
    errors,
  );
  let workspacePresent = false;
  if (!publicOnly) {
    await assertWorkspaceIsPrivate(resolvedPosts, resolvedWorkspace, errors);
    workspacePresent = await validateWorkspaceDirectory(
      resolvedWorkspace,
      errors,
    );
  }

  if (errors.length > 0) {
    throw new ContentContractError(errors);
  }
  return { workspacePresent };
}
