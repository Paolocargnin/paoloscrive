import { execFile } from 'node:child_process';

import { validateWorkspace } from '../scripts/workspace-lib.mjs';

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

function changedTexts(porcelain) {
  const refs = new Set();
  for (const line of porcelain.split('\n').filter(Boolean)) {
    const file = line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g, '');
    const [cartella, slug] = file.split('/');
    if (slug && !slug.startsWith('.')) {
      refs.add(`${cartella}/${slug}`);
    }
  }
  return [...refs].sort();
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
    modificati: changedTexts(porcelain),
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
        ? `scrittoio: aggiorna ${before.modificati[0]}`
        : `scrittoio: aggiorna ${count} testi`;
    await git(workspace, ['add', '-A']);
    await git(workspace, [
      'commit',
      '-m',
      subject,
      '-m',
      before.modificati.map((ref) => `- ${ref}`).join('\n'),
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
