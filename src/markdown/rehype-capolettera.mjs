/**
 * Collana (ADR 0025): the first paragraph of a Racconto opens with a drop cap
 * and its first words in small caps. If the story opens with a line of
 * dialogue, the dash or the quote hangs in the margin so the capital stays
 * aligned.
 *
 * It rewrites only the first text node of the first paragraph, so it never
 * touches the rest of the story.
 */
// A dash or an opening quote hangs in the margin, in the size of the text.
const hangingPattern = /^([–—-]\s+|[«“"‘'])/u;
const leadWords = 3;

function firstParagraph(tree) {
  return tree.children.find(
    (node) => node.type === 'element' && node.tagName === 'p',
  );
}

function span(className, value, extra = {}) {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: [className], ...extra },
    children: [{ type: 'text', value }],
  };
}

export default function rehypeCapolettera() {
  return (tree) => {
    const paragraph = firstParagraph(tree);
    const first = paragraph?.children[0];
    if (!first || first.type !== 'text') {
      return;
    }

    let text = first.value;
    const children = [];
    const hanging = text.match(hangingPattern);
    if (hanging) {
      children.push(span('hanging-dash', hanging[1]));
      text = text.slice(hanging[0].length);
    }

    const letter = text.match(/^\p{L}/u)?.[0];
    if (!letter) {
      return;
    }
    text = text.slice(letter.length);
    const lead = text.match(
      new RegExp(`^\\S*(?:\\s+\\S+){0,${leadWords - 1}}`, 'u'),
    )[0];
    children.push(span('drop-cap', letter), span('lead', lead));
    children.push({ type: 'text', value: text.slice(lead.length) });

    paragraph.properties = {
      ...paragraph.properties,
      className: [...(paragraph.properties?.className ?? []), 'opening'],
    };
    paragraph.children.splice(0, 1, ...children);
  };
}
