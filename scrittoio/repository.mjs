import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { validateWorkspace } from '../scripts/workspace-lib.mjs';
import { cartelle, parseRef, titleOf } from './archivio.mjs';

function git(workspace, args) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', workspace, ...args],
      { maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stderr: String(stderr).trim() }));
        } else {
          resolve(String(stdout));
        }
      },
    );
  });
}

// One line of `git status --porcelain` per file; a text is its folder.
function changesByText(porcelain) {
  const texts = new Map();
  for (const line of porcelain.split('\n').filter(Boolean)) {
    const code = line.slice(0, 2);
    const file = line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g, '');
    const [cartella, slug, ...rest] = file.split('/');
    if (!slug || slug.startsWith('.') || !Object.hasOwn(cartelle, cartella)) {
      continue;
    }
    const ref = `${cartella}/${slug}`;
    texts.set(ref, [...(texts.get(ref) ?? []), { code, file: rest.join('/') }]);
  }
  return texts;
}

function kindOfChange(changes) {
  if (
    changes.some(({ code, file }) => file === 'testo.md' && code.includes('D'))
  ) {
    return 'cancellato';
  }
  if (changes.every(({ code }) => code === '??' || code.includes('A'))) {
    return 'nuovo';
  }
  return 'modificato';
}

async function titleIn(workspace, ref, kind) {
  const slug = ref.split('/')[1];
  try {
    const source =
      kind === 'cancellato'
        ? await git(workspace, ['show', `HEAD:${ref}/testo.md`])
        : await readFile(path.join(workspace, ref, 'testo.md'), 'utf8');
    return titleOf(source, slug);
  } catch {
    return slug.replaceAll('-', ' ');
  }
}

/**
 * Each text that differs from the private repository, with its title and
 * what happened to it. A Nota that became a Bozza counts once, as trasformato.
 */
async function changedTexts(workspace, porcelain) {
  const texts = [...changesByText(porcelain)].map(([ref, changes]) => ({
    ref,
    cambiamento: kindOfChange(changes),
  }));
  const developed = new Set(
    texts
      .filter(
        ({ ref, cambiamento }) =>
          ref.startsWith('bozze/') &&
          cambiamento === 'nuovo' &&
          texts.some(
            (other) =>
              other.ref === `note/${ref.split('/')[1]}` &&
              other.cambiamento === 'cancellato',
          ),
      )
      .map(({ ref }) => ref.split('/')[1]),
  );
  const result = [];
  for (const text of texts) {
    const slug = text.ref.split('/')[1];
    if (developed.has(slug) && text.ref.startsWith('note/')) {
      continue;
    }
    const cambiamento =
      developed.has(slug) && text.ref.startsWith('bozze/')
        ? 'trasformato'
        : text.cambiamento;
    result.push({
      ...text,
      cambiamento,
      title: await titleIn(workspace, text.ref, cambiamento),
    });
  }
  return result.sort((a, b) => a.title.localeCompare(b.title, 'it'));
}

/** What the private repository still lacks: uncommitted texts, unpushed commits. */
export async function repositoryStatus(workspace) {
  const porcelain = await git(workspace, [
    'status',
    '--porcelain',
    '--untracked-files=all',
  ]);
  let daInviare = 0;
  try {
    daInviare = Number(
      (await git(workspace, ['rev-list', '--count', '@{u}..HEAD'])).trim(),
    );
  } catch {
    daInviare = 0;
  }
  const [data, messaggio] = (
    await git(workspace, ['log', '-1', '--format=%cI%x09%s'])
  )
    .trim()
    .split('\t');
  return {
    modificati: await changedTexts(workspace, porcelain),
    daInviare,
    ultimo: { data, messaggio },
  };
}

/**
 * Whether a text is safe in the private repository: 'salvato' (committed as
 * it is), 'modificato' (committed, changed since) or 'nuovo' (never saved).
 */
export async function textStatus(workspace, ref) {
  try {
    const tracked = await git(workspace, ['ls-files', '--', ref]);
    if (tracked.trim() === '') {
      return 'nuovo';
    }
    const changes = await git(workspace, ['status', '--porcelain', '--', ref]);
    return changes.trim() === '' ? 'salvato' : 'modificato';
  } catch {
    return 'nuovo';
  }
}

/**
 * Paolo's "Salva nel repository": check the contract, commit every change
 * and push to the private remote. A failed push keeps the commit; the next
 * save tries again.
 */
export async function saveRepository(workspace) {
  await validateWorkspace(workspace);
  const before = await repositoryStatus(workspace);
  if (before.modificati.length > 0) {
    const count = before.modificati.length;
    const subject =
      count === 1
        ? `scrittoio: ${before.modificati[0].cambiamento} ${before.modificati[0].ref}`
        : `scrittoio: aggiorna ${count} testi`;
    await git(workspace, ['add', '-A']);
    await git(workspace, [
      'commit',
      '-m',
      subject,
      '-m',
      before.modificati
        .map(
          ({ ref, title, cambiamento }) =>
            `- ${cambiamento}: ${ref} (${title})`,
        )
        .join('\n'),
    ]);
  }
  let errore = null;
  try {
    await git(workspace, ['push']);
  } catch (error) {
    errore = error.stderr || error.message;
  }
  return { ...(await repositoryStatus(workspace)), errore };
}

/**
 * Brings back a text deleted since the last save, as the repository has it.
 * Only a deletion can be undone here; edits stay Paolo's to keep or change.
 */
export async function restoreFromRepository(workspace, ref) {
  const { ref: checked } = parseRef(ref);
  const { modificati } = await repositoryStatus(workspace);
  const change = modificati.find((text) => text.ref === checked);
  if (change?.cambiamento !== 'cancellato') {
    throw Object.assign(
      new Error('Dal repository si ripristina solo un testo cancellato.'),
      { status: 400 },
    );
  }
  await git(workspace, [
    'restore',
    '--source=HEAD',
    '--staged',
    '--worktree',
    '--',
    checked,
  ]);
  return { ...(await repositoryStatus(workspace)), ripristinato: change };
}
