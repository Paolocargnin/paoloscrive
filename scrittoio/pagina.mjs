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
