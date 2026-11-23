import { describe, expect, it } from 'vitest';

import {
  postNumber,
  postsWithTag,
  postUrl,
  sortPostsNewestFirst,
} from '../src/lib/posts';

const post = (
  id: string,
  publishedAt: string,
  tags: string[] = [],
  lang = 'it',
) =>
  ({ id, data: { publishedAt: new Date(publishedAt), tags, lang } }) as never;

describe('Racconto helpers', () => {
  it('orders Racconti by newest publication date', () => {
    const posts = [post('older', '2025-01-01'), post('newer', '2026-01-01')];

    expect(sortPostsNewestFirst(posts).map((entry) => entry.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('numbers Racconti from the oldest, whatever the list order', () => {
    const posts = [
      post('terzo', '2026-03-01'),
      post('primo', '2026-01-01'),
      post('secondo', '2026-02-01'),
    ];

    expect(postNumber(posts[0], posts)).toBe(3);
    expect(postNumber(posts[1], posts)).toBe(1);
  });

  it('selects only Racconti with the requested Tema', () => {
    const posts = [
      post('one', '2026-01-01', ['memoria']),
      post('two', '2026-01-02', ['lavoro', 'memoria']),
    ];

    expect(postsWithTag(posts, 'lavoro').map((entry) => entry.id)).toEqual([
      'two',
    ]);
  });

  it('serves a Translation under its Racconto', () => {
    const racconto = post('il-faro', '2026-01-01');

    expect(postUrl(racconto)).toBe('/racconti/il-faro/');
    expect(postUrl(racconto, 'en')).toBe('/racconti/il-faro/en/');
    expect(postUrl(racconto, 'it')).toBe('/racconti/il-faro/');
  });
});
