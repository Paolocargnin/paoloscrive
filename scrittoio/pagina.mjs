import { createMarkdownProcessor } from '@astrojs/markdown-remark';

import rehypeCapolettera from '../src/markdown/rehype-capolettera.mjs';
import { withoutTitleHeading } from './archivio.mjs';

// The same Markdown as the blog. A Racconto also gets the Collana's drop cap
// (ADR 0025), so a Bozza already reads like the volume it will become.
const plain = await createMarkdownProcessor({ syntaxHighlight: false });
const collana = await createMarkdownProcessor({
  syntaxHighlight: false,
  rehypePlugins: [rehypeCapolettera],
});

/**
 * Texts written in Google Docs, Word or a notes app break lines with a single
 * newline. The Scrittoio keeps those lines on screen, as Paolo wrote them,
 * without changing the file.
 */
export function keepLineBreaks(source) {
  const lines = source.split('\n');
  let fence = false;
  return lines
    .map((line, index) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fence = !fence;
        return line;
      }
      const next = lines[index + 1];
      if (
        fence ||
        line.trim() === '' ||
        next === undefined ||
        next.trim() === '' ||
        /^\s*(```|~~~)/.test(next) ||
        /( {2,}|\\)$/.test(line) ||
        /^\s*#{1,6}\s/.test(line)
      ) {
        return line;
      }
      return `${line}  `;
    })
    .join('\n');
}

export async function renderText({ body, title, genere, ref }) {
  const source = withoutTitleHeading(body, title).replace(
    /(\]\(|\]:\s*)materiali\//g,
    `$1/api/materiali/${ref}/`,
  );
  const processor = genere === 'racconto' ? collana : plain;
  return (await processor.render(keepLineBreaks(source))).code;
}

export async function renderSidecar(body) {
  return body ? (await plain.render(keepLineBreaks(body))).code : null;
}

// A heading, list or quote marker stays outside <ins>/<del>, or the line
// would stop being a heading, an item or a quote.
const blockMarker = /^(\s{0,3}(?:#{1,6}\s+|[-*+]\s+|>\s?|\d+[.)]\s+))/;

/**
 * One Markdown source with the changes marked: what was added inside <ins>,
 * what was removed inside <del>. Tags never cross a line break, so the text
 * keeps its paragraphs, headings and line breaks.
 */
export function markChanges(parts) {
  let source = '';
  for (const part of parts) {
    if (!part.added && !part.removed) {
      source += part.value;
      continue;
    }
    const tag = part.added ? 'ins' : 'del';
    const before = source;
    source += part.value
      .split('\n')
      .map((line, index) => {
        const atLineStart = index > 0 || before === '' || before.endsWith('\n');
        const marker = atLineStart ? (line.match(blockMarker)?.[1] ?? '') : '';
        const content = line.slice(marker.length);
        const lead = content.match(/^\s*/)[0];
        let trail = content.match(/\s*$/)[0];
        let core = content.slice(lead.length, content.length - trail.length);
        if (core.endsWith('\\')) {
          core = core.slice(0, -1);
          trail = `\\${trail}`;
        }
        return core ? `${marker}${lead}<${tag}>${core}</${tag}>${trail}` : line;
      })
      .join('\n');
  }
  return source;
}

/** The text as the Scrittoio shows it, with the changes marked. */
export function renderChanges({ parts, title, genere, ref }) {
  return renderText({ body: markChanges(parts), title, genere, ref });
}
