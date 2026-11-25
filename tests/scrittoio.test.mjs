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
  developText,
  listTexts,
  parseRef,
  readMaterial,
  readText,
  saveText,
  slugify,
} from '../scrittoio/archivio.mjs';
import { keepLineBreaks, renderText } from '../scrittoio/pagina.mjs';

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

  it('makes readable slugs', () => {
    expect(slugify('Si butterà?')).toBe('si-buttera');
    expect(slugify('L’amore pensato')).toBe('lamore-pensato');
    expect(slugify('???')).toBe('senza-titolo');
  });
});
