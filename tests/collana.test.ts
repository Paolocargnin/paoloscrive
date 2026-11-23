import { describe, expect, it } from 'vitest';

import rehypeCapolettera from '../src/markdown/rehype-capolettera.mjs';
import {
  finishedWriting,
  incipit,
  numberWord,
  ordinalWord,
  readingTime,
  spineColor,
  toRoman,
  wordCount,
  writtenParts,
} from '../src/lib/collana';

describe('the Collana vocabulary', () => {
  it('numbers volumes in roman numerals and Italian ordinals', () => {
    expect([1, 4, 9, 14, 2009, 2026].map(toRoman)).toEqual([
      'I',
      'IV',
      'IX',
      'XIV',
      'MMIX',
      'MMXXVI',
    ]);
    expect([1, 2, 10, 11, 21, 23, 26].map(ordinalWord)).toEqual([
      'primo',
      'secondo',
      'decimo',
      'undicesimo',
      'ventunesimo',
      'ventitreesimo',
      'ventiseiesimo',
    ]);
    expect([1, 7, 21, 28, 33].map(numberWord)).toEqual([
      'uno',
      'sette',
      'ventuno',
      'ventotto',
      'trentatré',
    ]);
  });

  it('reads at about two hundred words a minute', () => {
    expect(readingTime(80)).toBe('meno di un minuto');
    expect(readingTime(210)).toBe('un minuto');
    expect(readingTime(1000)).toBe('cinque minuti');
    expect(
      wordCount('Una *luce* che [aspetta](https://example.com) — sempre.'),
    ).toBe(5);
  });

  it('dates the colophon from writtenAt, or from publication', () => {
    const published = new Date('2026-11-20T00:00:00Z');

    expect(finishedWriting(writtenParts('2009-08', published))).toBe(
      'nell’agosto MMIX',
    );
    expect(finishedWriting(writtenParts('2016', published))).toBe('nel MMXVI');
    expect(finishedWriting(writtenParts(undefined, published))).toBe(
      'nel novembre MMXXVI',
    );
  });

  it('quotes the first sentence as the incipit, without its opening dash', () => {
    expect(incipit('— Lo sai perché gira? — mi chiese.\n\nAltro.')).toBe(
      'Lo sai perché gira?',
    );
    expect(incipit('# Titolo\n\nLa luce aspetta. La nave no.')).toBe(
      'La luce aspetta.',
    );
  });

  it('gives each volume a fixed spine colour that follows its number', () => {
    expect(spineColor(1)).toEqual(spineColor(7));
    expect(spineColor(1)).not.toEqual(spineColor(2));
  });
});

describe('the drop cap', () => {
  const paragraph = (value: string) => ({
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value }],
      },
    ],
  });
  const run = (value: string) => {
    const tree = paragraph(value);
    rehypeCapolettera()(tree);
    return tree.children[0] as unknown as {
      properties: { className: string[] };
      children: {
        properties?: { className: string[] };
        children?: { value: string }[];
        value?: string;
      }[];
    };
  };

  it('sets the first letter as a capital and the next words in small caps', () => {
    const p = run('La prima cosa che ho imparato.');

    expect(p.properties.className).toEqual(['opening']);
    expect(
      p.children.map((child) => child.children?.[0].value ?? child.value),
    ).toEqual(['L', 'a prima cosa', ' che ho imparato.']);
  });

  it('hangs an opening dash in the margin', () => {
    const p = run('— Lo sai perché gira?');

    expect(p.children[0].properties?.className).toEqual(['hanging-dash']);
    expect(p.children[1].children?.[0].value).toBe('L');
  });
});
