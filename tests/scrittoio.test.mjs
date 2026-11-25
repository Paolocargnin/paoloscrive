import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { parseMarkdownDocument } from '../scripts/markdown-lib.mjs';
import {
  scaffoldWorkspace,
  validateWorkspace,
} from '../scripts/workspace-lib.mjs';
import {
  createText,
  deleteText,
  developText,
  listTexts,
  parseRef,
  readMaterial,
  readText,
  restoreText,
  saveText,
  slugify,
} from '../scrittoio/archivio.mjs';
import {
  keepLineBreaks,
  markChanges,
  renderChanges,
  renderText,
} from '../scrittoio/pagina.mjs';
import {
  repositoryStatus,
  restoreFromRepository,
  textChanges,
} from '../scrittoio/repository.mjs';

const temporaryDirectories = [];

async function workspace() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'scrittoio-'));
  temporaryDirectories.push(directory);
  const root = path.join(directory, 'workspace');
  await scaffoldWorkspace(root);
  return root;
}

async function writeText(root, ref, source) {
  await mkdir(path.join(root, ref), { recursive: true });
  await writeFile(path.join(root, ref, 'testo.md'), source, 'utf8');
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('Scrittoio', () => {
  it('lists Note, Racconti and Personaggi, newest first', async () => {
    const root = await workspace();
    await writeText(
      root,
      'note/il-faro',
      '---\ntitle: Il faro\nforma: scena\nwrittenAt: 2009-08\n---\n\nUna luce.\n',
    );
    await writeText(
      root,
      'note/senza-frontmatter',
      '# Il memo\n\nUna frase.\n',
    );
    await writeText(
      root,
      'bozze/la-nave',
      '---\nid: 7b0e8f3e-8f4a-4c55-9a39-5d2f1c0b9e11\ntitle: La nave\nwrittenAt: 2025-04-29\n---\n\nUna nave in tempesta.\n',
    );
    await writeText(
      root,
      'personaggi/fiorellone',
      '---\ntitle: Fiorellone\n---\n\nUn fiore enorme.\n',
    );

    const texts = await listTexts(root);

    expect(texts.map((text) => text.ref)).toEqual([
      'bozze/la-nave',
      'note/il-faro',
      expect.any(String),
      expect.any(String),
    ]);
    const memo = texts.find((text) => text.slug === 'senza-frontmatter');
    expect(memo).toMatchObject({ title: 'Il memo', genere: 'nota', words: 2 });
    expect(memo.testo).toBe('Una frase.');
    expect(texts.find((text) => text.slug === 'la-nave')).toMatchObject({
      genere: 'racconto',
      stato: 'bozza',
    });
  });

  it('saves the text and keeps the id and the origine', async () => {
    const root = await workspace();
    await writeText(
      root,
      'bozze/la-nave',
      '---\nid: 7b0e8f3e-8f4a-4c55-9a39-5d2f1c0b9e11\ntitle: La nave\ndescription: ""\norigine:\n  drive: abc\n  cartella: Testi\n  file: La nave\n---\n\nPrima.\n',
    );

    await saveText(root, 'bozze/la-nave', {
      title: 'La nave nella tempesta',
      writtenAt: '2009',
      body: 'Dopo.',
      forma: 'scena',
    });

    const file = path.join(root, 'bozze', 'la-nave', 'testo.md');
    const { data, body } = parseMarkdownDocument(
      await readFile(file, 'utf8'),
      file,
    );
    expect(data).toMatchObject({
      id: '7b0e8f3e-8f4a-4c55-9a39-5d2f1c0b9e11',
      title: 'La nave nella tempesta',
      writtenAt: '2009',
      origine: { drive: 'abc' },
    });
    expect(data.forma).toBeUndefined();
    expect(body.trim()).toBe('Dopo.');
    await expect(validateWorkspace(root)).resolves.toBeUndefined();
  });

  it('refuses a date the colophon cannot read', async () => {
    const root = await workspace();
    await writeText(
      root,
      'note/il-faro',
      '---\ntitle: Il faro\n---\n\nUna luce.\n',
    );

    await expect(
      saveText(root, 'note/il-faro', { writtenAt: 'ieri' }),
    ).rejects.toThrow('un anno, un mese o un giorno');
  });

  it('creates texts with a free slug, inside the Workspace contract', async () => {
    const root = await workspace();

    const nota = await createText(root, {
      genere: 'nota',
      title: 'L’ultimo caffè',
      forma: 'dialogo',
    });
    const altra = await createText(root, {
      genere: 'nota',
      title: 'L’ultimo caffè',
    });
    const racconto = await createText(root, {
      genere: 'racconto',
      title: 'Il faro',
    });
    const personaggio = await createText(root, {
      genere: 'personaggio',
      title: 'Botteghino',
    });

    expect(nota.ref).toBe('note/lultimo-caffe');
    expect(nota.forma).toBe('dialogo');
    expect(altra.ref).toBe('note/lultimo-caffe-2');
    expect(racconto.ref).toBe('bozze/il-faro');
    expect(racconto.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(personaggio.ref).toBe('personaggi/botteghino');
    await expect(validateWorkspace(root)).resolves.toBeUndefined();
  });

  it('turns a Nota into a Bozza with the Nota as appunti', async () => {
    const root = await workspace();
    await writeText(
      root,
      'note/il-faro',
      '---\ntitle: Il faro\nforma: scena\nwrittenAt: 2009-08\n---\n\nUna luce che aspetta.\n',
    );

    const bozza = await developText(root, 'note/il-faro');

    expect(bozza).toMatchObject({
      ref: 'bozze/il-faro',
      title: 'Il faro',
      writtenAt: '2009-08',
      body: '',
    });
    expect(bozza.appunti).toContain('Una luce che aspetta.');
    await expect(validateWorkspace(root)).resolves.toBeUndefined();
  });

  it('shows where a Personaggio is named', async () => {
    const root = await workspace();
    await writeText(
      root,
      'personaggi/fiorellone',
      '---\ntitle: Fiorellone\n---\n\nUn fiore enorme.\n',
    );
    await writeText(
      root,
      'note/il-giardino',
      '---\ntitle: Il giardino\n---\n\nLe api cercano Fiorellone.\n',
    );
    await writeText(
      root,
      'note/altro',
      '---\ntitle: Altro\n---\n\nFiorellonesco non conta.\n',
    );

    const fiorellone = await readText(root, 'personaggi/fiorellone');

    expect(fiorellone.menzioni.map((menzione) => menzione.ref)).toEqual([
      'note/il-giardino',
    ]);
  });

  it('deletes a text with its materiali and can bring it back', async () => {
    const root = await workspace();
    await writeText(
      root,
      'note/il-faro',
      '---\ntitle: Il faro\n---\n\nUna luce.\n',
    );
    await mkdir(path.join(root, 'note', 'il-faro', 'materiali'));
    const memo = Buffer.from([0, 1, 2, 250, 255]);
    await writeFile(
      path.join(root, 'note', 'il-faro', 'materiali', 'memo.m4a'),
      memo,
    );

    await expect(deleteText(root, 'note/il-faro')).resolves.toEqual({
      ref: 'note/il-faro',
      title: 'Il faro',
    });
    expect(await listTexts(root)).toEqual([]);

    const restored = await restoreText(root, 'note/il-faro');
    expect(restored).toMatchObject({
      title: 'Il faro',
      materiali: ['memo.m4a'],
    });
    expect(
      await readFile(
        path.join(root, 'note', 'il-faro', 'materiali', 'memo.m4a'),
      ),
    ).toEqual(memo);
    await expect(restoreText(root, 'note/il-faro')).rejects.toThrow(
      'niente da ripristinare',
    );
  });

  it('keeps a published Racconto and refuses to overwrite on restore', async () => {
    const root = await workspace();
    await writeText(
      root,
      'pubblicati/il-faro',
      '---\nid: 7b0e8f3e-8f4a-4c55-9a39-5d2f1c0b9e11\ntitle: Il faro\n---\n\nX.\n',
    );
    await expect(deleteText(root, 'pubblicati/il-faro')).rejects.toThrow(
      'non si cancella',
    );

    await writeText(root, 'note/doppio', '---\ntitle: Primo\n---\n\nA.\n');
    await deleteText(root, 'note/doppio');
    await writeText(root, 'note/doppio', '---\ntitle: Secondo\n---\n\nB.\n');
    await expect(restoreText(root, 'note/doppio')).rejects.toThrow(
      'un altro testo con questo nome',
    );
  });

  it('says which texts changed since the last save, and brings back a deleted one', async () => {
    const root = await workspace();
    const git = (...args) =>
      execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
    await writeText(root, 'note/resta', '---\ntitle: Resta\n---\n\nA.\n');
    await writeText(root, 'note/cambia', '---\ntitle: Cambia\n---\n\nB.\n');
    await writeText(root, 'note/sparisce', '---\ntitle: Sparisce\n---\n\nC.\n');
    await writeText(root, 'note/il-faro', '---\ntitle: Il faro\n---\n\nD.\n');
    git('init', '-q');
    git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'add',
      '-A',
    );
    git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'inizio',
    );

    await saveText(root, 'note/cambia', { body: 'B, riscritta.' });
    await deleteText(root, 'note/sparisce');
    await createText(root, { genere: 'personaggio', title: 'Botteghino' });
    await developText(root, 'note/il-faro');

    const { modificati } = await repositoryStatus(root);
    expect(modificati).toEqual([
      {
        ref: 'personaggi/botteghino',
        cambiamento: 'nuovo',
        title: 'Botteghino',
      },
      { ref: 'note/cambia', cambiamento: 'modificato', title: 'Cambia' },
      { ref: 'bozze/il-faro', cambiamento: 'trasformato', title: 'Il faro' },
      { ref: 'note/sparisce', cambiamento: 'cancellato', title: 'Sparisce' },
    ]);

    const changes = await textChanges(root, 'note/cambia');
    expect(changes.stato).toBe('modificato');
    expect(changes.campi).toEqual([]);
    expect(
      changes.testo
        .filter((part) => part.added)
        .map((part) => part.value)
        .join(''),
    ).toContain('riscritta');
    expect((await textChanges(root, 'note/resta')).stato).toBe('salvato');
    expect((await textChanges(root, 'personaggi/botteghino')).stato).toBe(
      'nuovo',
    );

    const restored = await restoreFromRepository(root, 'note/sparisce');
    expect(restored.ripristinato.title).toBe('Sparisce');
    expect((await readText(root, 'note/sparisce')).body.trim()).toBe('C.');
    await expect(restoreFromRepository(root, 'note/cambia')).rejects.toThrow(
      'solo un testo cancellato',
    );
  });

  it('never reads outside the Workspace', async () => {
    const root = await workspace();

    expect(() => parseRef('../etc')).toThrow('Testo sconosciuto');
    expect(() => parseRef('note/../../segreto')).toThrow('Testo sconosciuto');
    await writeText(root, 'note/il-faro', '---\ntitle: Il faro\n---\n\nX.\n');
    await expect(
      readMaterial(root, 'note/il-faro', '../testo.md'),
    ).rejects.toThrow('Materiale sconosciuto');
  });

  it('keeps Paolo’s line breaks on screen and links materiali', async () => {
    expect(keepLineBreaks('Riga uno\nRiga due\n\nAltro')).toBe(
      'Riga uno  \nRiga due\n\nAltro',
    );
    const html = await renderText({
      body: '# Il faro\n\nUna luce\nche aspetta.\n\n![][image1]\n\n[image1]: materiali/image1.png\n',
      title: 'Il faro',
      genere: 'nota',
      ref: 'note/il-faro',
    });
    expect(html).not.toContain('<h1>');
    expect(html).toContain('Una luce<br>');
    expect(html).toContain('/api/materiali/note/il-faro/image1.png');
  });

  it('marks changes without breaking headings, paragraphs or line breaks', async () => {
    const parts = [
      { value: '# ' },
      { value: 'Vecchio', removed: true },
      { value: 'Nuovo', added: true },
      { value: '\n\nUna luce' },
      { value: ' che aspetta.\n\nUn faro', added: true },
      { value: '.\n' },
    ];

    expect(markChanges(parts)).toBe(
      '# <del>Vecchio</del><ins>Nuovo</ins>\n\nUna luce <ins>che aspetta.</ins>\n\n<ins>Un faro</ins>.\n',
    );
    const html = await renderChanges({
      parts,
      title: 'Il faro',
      genere: 'nota',
      ref: 'note/il-faro',
    });
    expect(html).toContain(
      '<h1 id="vecchionuovo"><del>Vecchio</del><ins>Nuovo</ins></h1>',
    );
    expect(html).toContain('<p><ins>Un faro</ins>.</p>');
  });

  it('makes readable slugs', () => {
    expect(slugify('Si butterà?')).toBe('si-buttera');
    expect(slugify('L’amore pensato')).toBe('lamore-pensato');
    expect(slugify('???')).toBe('senza-titolo');
  });
});
