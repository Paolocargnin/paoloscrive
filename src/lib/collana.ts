/**
 * The vocabulary of the Collana (ADR 0025): every Racconto is a numbered
 * volume of a pocket series, with a spine, a frontispiece and a colophon.
 */

const romanDigits: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(value: number): string {
  let rest = Math.floor(value);
  let result = '';
  for (const [amount, digits] of romanDigits) {
    while (rest >= amount) {
      result += digits;
      rest -= amount;
    }
  }
  return result;
}

const units = [
  '',
  'uno',
  'due',
  'tre',
  'quattro',
  'cinque',
  'sei',
  'sette',
  'otto',
  'nove',
];
const teens = [
  'dieci',
  'undici',
  'dodici',
  'tredici',
  'quattordici',
  'quindici',
  'sedici',
  'diciassette',
  'diciotto',
  'diciannove',
];
const tens = [
  '',
  '',
  'venti',
  'trenta',
  'quaranta',
  'cinquanta',
  'sessanta',
  'settanta',
  'ottanta',
  'novanta',
];

/** Italian number words up to 99, the way a book spells them out. */
export function numberWord(value: number): string {
  if (value < 10) return value === 0 ? 'zero' : units[value];
  if (value < 20) return teens[value - 10];
  if (value < 100) {
    const unit = value % 10;
    const ten = tens[Math.floor(value / 10)];
    if (unit === 0) return ten;
    const stem = unit === 1 || unit === 8 ? ten.slice(0, -1) : ten;
    return `${stem}${unit === 3 ? 'tré' : units[unit]}`;
  }
  return String(value);
}

const ordinals = [
  '',
  'primo',
  'secondo',
  'terzo',
  'quarto',
  'quinto',
  'sesto',
  'settimo',
  'ottavo',
  'nono',
  'decimo',
];

/** «volume secondo», «volume undicesimo». */
export function ordinalWord(value: number): string {
  if (value <= 10) return ordinals[value];
  const word = numberWord(value);
  if (word === String(value)) return `${value}°`;
  const stem = word.endsWith('tré')
    ? word.slice(0, -1) + 'e'
    : word.endsWith('sei')
      ? word
      : word.replace(/[aeio]$/, '');
  return `${stem}esimo`;
}

export const months = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

/** The words of a Markdown body, without markup. */
export function wordCount(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~-]/g, ' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** «si legge in cinque minuti», at about two hundred words a minute. */
export function readingTime(words: number): string {
  const minutes = words / 200;
  if (minutes < 0.75) return 'meno di un minuto';
  const rounded = Math.round(minutes);
  return rounded === 1 ? 'un minuto' : `${numberWord(rounded)} minuti`;
}

/** The first sentence of the first paragraph, for the volume card. */
export function incipit(markdown: string): string {
  const paragraph =
    markdown
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .find((block) => block && !/^(#|>|---|\*\*\*|!\[|<)/.test(block)) ?? '';
  const plain = paragraph
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[«“"'‘–—-]\s*/u, '');
  const sentence = (
    plain.match(/^.+?[.!?…](?=[»”"']?(?:\s|$))/u)?.[0] ?? plain
  ).trim();
  return sentence.length > 220
    ? `${sentence.slice(0, 217).trimEnd()}…`
    : sentence;
}

/**
 * Spine colours, the same in both themes, each with its own ink. A volume
 * keeps its colour because it follows its number.
 */
export const spineColors = [
  { background: '#d4a619', ink: '#1d1606' },
  { background: '#3e6862', ink: '#f3efe2' },
  { background: '#6c2a3d', ink: '#f1e6dc' },
  { background: '#b7832c', ink: '#1a1408' },
  { background: '#243b66', ink: '#efe9d8' },
  { background: '#8d9399', ink: '#121314' },
] as const;

export function spineColor(number: number) {
  return spineColors[(number - 1) % spineColors.length];
}

/** Spine heights vary a little, like real books on a shelf. */
const spineHeights = [272, 290, 258, 300, 280, 265, 295];

export function spineHeight(number: number): number {
  return spineHeights[(number - 1) % spineHeights.length];
}

/** The spine is as thick as the story is long, within a readable range. */
export function spineWidth(words: number): number {
  return Math.round(Math.min(110, Math.max(40, 34 + words / 20)));
}

/**
 * When a Racconto was finished: writtenAt if Paolo set it (a year, a month or
 * a day), otherwise its publication date.
 */
export function writtenParts(writtenAt: string | undefined, publishedAt: Date) {
  if (writtenAt) {
    const [year, month] = writtenAt.split('-').map(Number);
    return { year, month: month || undefined };
  }
  return {
    year: publishedAt.getUTCFullYear(),
    month: publishedAt.getUTCMonth() + 1,
  };
}

/** «nell’agosto MMIX», «nel MMIX». */
export function finishedWriting(parts: {
  year: number;
  month?: number;
}): string {
  const year = toRoman(parts.year);
  if (!parts.month) return `nel ${year}`;
  const month = months[parts.month - 1];
  return /^[aeiou]/.test(month)
    ? `nell’${month} ${year}`
    : `nel ${month} ${year}`;
}
