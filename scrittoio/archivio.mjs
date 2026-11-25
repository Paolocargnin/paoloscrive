import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import {
  contentContract,
  slugPattern,
  writtenAtPattern,
} from '../src/content/contract.mjs';
import {
  isPlainObject,
  parseMarkdownDocument,
  serializeMarkdownDocument,
} from '../scripts/markdown-lib.mjs';
import { developNote, today } from '../scripts/workspace-lib.mjs';

/**
 * The Scrittoio's view of the Workspace (ADR 0026). Every text is a folder
 * with testo.md; the folder it lives in says what it is.
 */
const { textFile, materialsDirectory, forme } = contentContract.workspace;

export const cartelle = Object.freeze({
  note: { genere: 'nota', stato: 'nota' },
  bozze: { genere: 'racconto', stato: 'bozza' },
  pubblicati: { genere: 'racconto', stato: 'pubblicato' },
  personaggi: { genere: 'personaggio', stato: 'personaggio' },
});

const cartellaDelGenere = Object.freeze({
  nota: 'note',
  racconto: 'bozze',
  personaggio: 'personaggi',
});

const utf8 = 'utf8';

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/** A text is addressed as cartella/slug, for example note/il-finto-genio. */
export function parseRef(ref) {
  const [cartella, slug, ...rest] = String(ref).split('/');
  if (
    rest.length > 0 ||
    !Object.hasOwn(cartelle, cartella) ||
    !slugPattern.test(slug ?? '')
  ) {
    throw Object.assign(new Error(`Testo sconosciuto: ${ref}`), {
      status: 404,
    });
  }
  return { cartella, slug, ref: `${cartella}/${slug}` };
}

export function slugify(title) {
  const slug = String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const short =
    slug.length > 60 ? slug.slice(0, 60).replace(/-[^-]*$/, '') : slug;
  return short || 'senza-titolo';
}

// The blank line between the frontmatter and the text is not part of the text.
function readDocument(source, file) {
  if (!source.startsWith('---')) {
    return { data: {}, body: source };
  }
  const { data, body } = parseMarkdownDocument(source, file);
  return { data, body: body.replace(/^(?:[ \t]*\n)+/, '') };
}

const comparable = (value) =>
  value
    .replace(/[*_\\]/g, '')
    .trim()
    .toLowerCase();

/** A text that opens with its own title as a heading shows it only once. */
export function withoutTitleHeading(body, title) {
  return body.replace(/^\s*#\s+(.+?)\s*\n/, (heading, text) =>
    comparable(text) === comparable(title) ? '' : heading,
  );
}

/** The title a reader sees, from the source of a testo.md. */
export function titleOf(source, slug) {
  const { data, body } = readDocument(source, `${slug}/testo.md`);
  return (
    (typeof data.title === 'string' && data.title.trim()) ||
    headingTitle(body) ||
    slug.replaceAll('-', ' ')
  );
}

function headingTitle(body) {
  return body
    .match(/^#\s+(.+?)\s*$/m)?.[1]
    ?.replace(/[*_]/g, '')
    .trim();
}

/** The text as a reader sees it: no markup, no image references. */
export function plainText(body) {
  return body
    .replace(/^\[[^\]]+\]:\s.*$/gm, '')
    .replace(/!\[[^\]]*\](\[[^\]]*\]|\([^)]*\))/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function countWords(text) {
  return text.match(/\S+/g)?.length ?? 0;
}

async function materialsOf(directory) {
  const materials = path.join(directory, materialsDirectory);
  if (!(await exists(materials))) {
    return [];
  }
  const entries = await readdir(materials, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

async function readEntry(workspace, cartella, slug) {
  const directory = path.join(workspace, cartella, slug);
  const file = path.join(directory, textFile);
  const source = await readFile(file, utf8);
  const { data, body } = readDocument(source, file);
  const { mtime } = await stat(file);
  const { genere, stato } = cartelle[cartella];
  const title =
    (typeof data.title === 'string' && data.title.trim()) ||
    headingTitle(body) ||
    slug.replaceAll('-', ' ');
  const plain = plainText(withoutTitleHeading(body, title));
  return {
    ref: `${cartella}/${slug}`,
    cartella,
    slug,
    genere,
    stato,
    title,
    forma: typeof data.forma === 'string' ? data.forma : null,
    writtenAt: data.writtenAt == null ? null : String(data.writtenAt),
    lang: typeof data.lang === 'string' ? data.lang : 'it',
    origine: isPlainObject(data.origine) ? data.origine : null,
    words: countWords(plain),
    excerpt: plain.replace(/\s+/g, ' ').slice(0, 220),
    updatedAt: mtime.toISOString(),
    materiali: await materialsOf(directory),
    data,
    body,
    plain,
  };
}

function summary(entry) {
  const { data: _data, body: _body, plain, ...rest } = entry;
  return { ...rest, testo: plain };
}

/** Every text in the Workspace, newest first. */
export async function listTexts(workspace) {
  const texts = [];
  for (const cartella of Object.keys(cartelle)) {
    const root = path.join(workspace, cartella);
    if (!(await exists(root))) {
      continue;
    }
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !slugPattern.test(entry.name)) {
        continue;
      }
      if (!(await exists(path.join(root, entry.name, textFile)))) {
        continue;
      }
      texts.push(summary(await readEntry(workspace, cartella, entry.name)));
    }
  }
  // Newest first by the date of writing; undated texts go last.
  return texts.sort(
    (a, b) =>
      Number(!a.writtenAt) - Number(!b.writtenAt) ||
      (b.writtenAt ?? b.updatedAt).localeCompare(a.writtenAt ?? a.updatedAt),
  );
}

function mentionPattern(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${escaped}(?=$|[^\\p{L}])`, 'iu');
}

/** Texts that name a Personaggio, so Paolo can find where it appears. */
export async function mentionsOf(workspace, entry) {
  const pattern = mentionPattern(entry.title);
  const texts = await listTexts(workspace);
  return texts
    .filter((text) => text.ref !== entry.ref && pattern.test(text.testo))
    .map((text) => {
      const index = text.testo.search(pattern);
      const start = Math.max(0, index - 60);
      return {
        ref: text.ref,
        title: text.title,
        genere: text.genere,
        snippet: `${start > 0 ? '…' : ''}${text.testo
          .slice(start, index + entry.title.length + 100)
          .replace(/\s+/g, ' ')
          .trim()}…`,
      };
    });
}

async function readSidecar(directory, name) {
  const file = path.join(directory, name);
  if (!(await exists(file))) {
    return null;
  }
  const source = await readFile(file, utf8);
  return readDocument(source, file).body.trim() || null;
}

export async function readText(workspace, ref) {
  const { cartella, slug } = parseRef(ref);
  const directory = path.join(workspace, cartella, slug);
  if (!(await exists(path.join(directory, textFile)))) {
    throw Object.assign(new Error(`${ref} non esiste.`), { status: 404 });
  }
  const entry = await readEntry(workspace, cartella, slug);
  return {
    ...summary(entry),
    body: entry.body,
    id: typeof entry.data.id === 'string' ? entry.data.id : null,
    description:
      typeof entry.data.description === 'string' ? entry.data.description : '',
    appunti: await readSidecar(directory, 'appunti.md'),
    letturaCritica: await readSidecar(directory, 'lettura-critica.md'),
    menzioni:
      entry.genere === 'personaggio' ? await mentionsOf(workspace, entry) : [],
  };
}

function checkedFields({ title, forma, writtenAt, lang }) {
  const fields = {};
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      throw Object.assign(new Error('Serve un titolo.'), { status: 400 });
    }
    fields.title = title.trim();
  }
  if (forma !== undefined) {
    if (forma !== null && forma !== '' && !Object.hasOwn(forme, forma)) {
      throw Object.assign(new Error(`Forma sconosciuta: ${forma}`), {
        status: 400,
      });
    }
    fields.forma = forma || null;
  }
  if (writtenAt !== undefined) {
    const value = writtenAt == null ? '' : String(writtenAt).trim();
    if (value !== '' && !writtenAtPattern.test(value)) {
      throw Object.assign(
        new Error(
          'La data è un anno, un mese o un giorno: 2009, 2009-08, 2009-08-14.',
        ),
        { status: 400 },
      );
    }
    fields.writtenAt = value || null;
  }
  if (lang !== undefined) {
    if (!Object.hasOwn(contentContract.languages, lang)) {
      throw Object.assign(new Error(`Lingua sconosciuta: ${lang}`), {
        status: 400,
      });
    }
    fields.lang = lang;
  }
  return fields;
}

/**
 * Saves what Paolo edits (title, forma, date, language, text) and keeps
 * everything else in the frontmatter, such as a Bozza's id and the origine.
 */
export async function saveText(workspace, ref, changes) {
  const { cartella, slug } = parseRef(ref);
  const file = path.join(workspace, cartella, slug, textFile);
  if (!(await exists(file))) {
    throw Object.assign(new Error(`${ref} non esiste.`), { status: 404 });
  }
  const current = readDocument(await readFile(file, utf8), file);
  const fields = checkedFields(changes);
  const data = { ...current.data };
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) {
      delete data[key];
    } else {
      data[key] = value;
    }
  }
  if (cartelle[cartella].genere !== 'nota') {
    delete data.forma;
  }
  if (!data.title) {
    data.title = headingTitle(current.body) ?? slug.replaceAll('-', ' ');
  }
  const body =
    typeof changes.body === 'string'
      ? changes.body.replace(/\r\n?/g, '\n')
      : current.body;
  await writeFile(
    file,
    serializeMarkdownDocument(
      data,
      body.trimEnd() === '' ? '' : `${body.trimEnd()}\n`,
    ),
    utf8,
  );
  return readText(workspace, ref);
}

async function freeSlug(workspace, title) {
  const base = slugify(title);
  let slug = base;
  for (let n = 2; ; n += 1) {
    let taken = false;
    for (const cartella of Object.keys(cartelle)) {
      if (await exists(path.join(workspace, cartella, slug))) {
        taken = true;
      }
    }
    if (!taken) {
      return slug;
    }
    slug = `${base}-${n}`;
  }
}

/** A new Nota, Racconto (as a Bozza) or Personaggio, dated today. */
export async function createText(workspace, { genere, title, forma }) {
  if (!Object.hasOwn(cartellaDelGenere, genere)) {
    throw Object.assign(new Error(`Genere sconosciuto: ${genere}`), {
      status: 400,
    });
  }
  const fields = checkedFields({
    title,
    forma: genere === 'nota' ? (forma ?? null) : undefined,
  });
  const cartella = cartellaDelGenere[genere];
  const slug = await freeSlug(workspace, fields.title);
  const data =
    genere === 'racconto'
      ? {
          id: randomUUID(),
          title: fields.title,
          description: '',
          lang: contentContract.defaultLanguage,
          tags: [],
          writtenAt: today(),
        }
      : {
          title: fields.title,
          ...(fields.forma ? { forma: fields.forma } : {}),
          writtenAt: today(),
        };
  const directory = path.join(workspace, cartella, slug);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, textFile),
    serializeMarkdownDocument(data, ''),
    utf8,
  );
  return readText(workspace, `${cartella}/${slug}`);
}

/**
 * Nota → Bozza (ADR 0023): the Nota stays beside the Bozza as appunti.md and
 * the Bozza starts empty, with the Nota's title, date and origine.
 */
export async function developText(workspace, ref) {
  const { cartella, slug } = parseRef(ref);
  if (cartella !== 'note') {
    throw Object.assign(new Error('Solo una Nota diventa un Racconto.'), {
      status: 400,
    });
  }
  const note = await readText(workspace, ref);
  await developNote({ workspace, slug });
  const draftRef = `bozze/${slug}`;
  const file = path.join(workspace, 'bozze', slug, textFile);
  const draft = parseMarkdownDocument(await readFile(file, utf8), file);
  const data = {
    ...draft.data,
    title: note.title,
    lang: note.lang,
    ...(note.writtenAt ? { writtenAt: note.writtenAt } : {}),
    ...(note.origine ? { origine: note.origine } : {}),
  };
  await writeFile(file, serializeMarkdownDocument(data, draft.body), utf8);
  return readText(workspace, draftRef);
}

// What Paolo deleted while the Scrittoio is open, so "Annulla" can bring it
// back. Once he saves to the repository, Git history keeps it instead.
const cestino = new Map();

async function filesIn(directory) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const file = path.join(entry.parentPath, entry.name);
        return {
          relative: path.relative(directory, file),
          content: await readFile(file),
        };
      }),
  );
}

/**
 * Deletes a Nota, a Bozza or a Personaggio with its sidecars and materiali.
 * A published Racconto keeps its working folder: the public text depends on it.
 */
export async function deleteText(workspace, ref) {
  const { cartella, slug } = parseRef(ref);
  if (cartella === 'pubblicati') {
    throw Object.assign(
      new Error('Un Racconto pubblicato non si cancella dallo Scrittoio.'),
      { status: 400 },
    );
  }
  const directory = path.join(workspace, cartella, slug);
  if (!(await exists(path.join(directory, textFile)))) {
    throw Object.assign(new Error(`${ref} non esiste.`), { status: 404 });
  }
  const { title } = await readEntry(workspace, cartella, slug);
  cestino.set(`${workspace}\0${ref}`, await filesIn(directory));
  await rm(directory, { recursive: true, force: true });
  return { ref, title };
}

/** Brings back a text deleted while this Scrittoio has been open. */
export async function restoreText(workspace, ref) {
  const { cartella, slug } = parseRef(ref);
  const key = `${workspace}\0${ref}`;
  const files = cestino.get(key);
  if (!files) {
    throw Object.assign(new Error('Non c’è niente da ripristinare.'), {
      status: 404,
    });
  }
  const directory = path.join(workspace, cartella, slug);
  if (await exists(directory)) {
    throw Object.assign(
      new Error('C’è già un altro testo con questo nome: rinominalo prima.'),
      { status: 409 },
    );
  }
  for (const file of files) {
    const target = path.join(directory, file.relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
  cestino.delete(key);
  return readText(workspace, ref);
}

const materialTypes = Object.freeze({
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
});

export async function readMaterial(workspace, ref, name) {
  const { cartella, slug } = parseRef(ref);
  if (!/^[^/\\]+$/.test(name) || name.startsWith('.')) {
    throw Object.assign(new Error('Materiale sconosciuto.'), { status: 404 });
  }
  const file = path.join(workspace, cartella, slug, materialsDirectory, name);
  if (!(await exists(file))) {
    throw Object.assign(new Error('Materiale sconosciuto.'), { status: 404 });
  }
  return {
    content: await readFile(file),
    type:
      materialTypes[path.extname(name).toLowerCase()] ??
      'application/octet-stream',
  };
}
