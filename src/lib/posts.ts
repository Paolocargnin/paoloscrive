import type { CollectionEntry } from 'astro:content';

import { contentContract } from '../content/contract.mjs';

export type Post = CollectionEntry<'posts'>;
export type Translation = CollectionEntry<'translations'>;
export type Language = keyof typeof contentContract.languages;

export function sortPostsNewestFirst(posts: readonly Post[]): Post[] {
  return [...posts].sort(
    (left, right) =>
      right.data.publishedAt.getTime() - left.data.publishedAt.getTime(),
  );
}

export function postsWithTag(posts: readonly Post[], tag: string): Post[] {
  return posts.filter((post) => post.data.tags.includes(tag as never));
}

/** The public path of a Racconto, or of its Translation into `lang`. */
export function postUrl(post: Post, lang?: string): string {
  return lang && lang !== post.data.lang
    ? `/racconti/${post.id}/${lang}/`
    : `/racconti/${post.id}/`;
}

/**
 * A Racconto's number, counted from the oldest: the first one is n. 1. It is
 * derived, not stored, so it changes only if an older Racconto is withdrawn.
 */
export function postNumber(post: Post, posts: readonly Post[]): number {
  const ordered = [...posts].sort(
    (left, right) =>
      left.data.publishedAt.getTime() - right.data.publishedAt.getTime() ||
      left.id.localeCompare(right.id),
  );
  return ordered.findIndex((entry) => entry.id === post.id) + 1;
}

/** Translations by Racconto slug: { 'il-faro': [Translation en], ... }. */
export function translationsBySlug(
  translations: readonly Translation[],
): Map<string, Translation[]> {
  const bySlug = new Map<string, Translation[]>();
  for (const translation of translations) {
    const [, slug] = translation.id.split('/');
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), translation]);
  }
  return bySlug;
}

export function translationLanguage(translation: Translation): Language {
  return translation.id.split('/')[0] as Language;
}

export function isSigned(translation: Translation): boolean {
  return Boolean(translation.data.signedBy && translation.data.signedAt);
}

export function languageName(lang: string): string {
  return contentContract.languages[lang as Language].name;
}

export function formatDate(date: Date, lang = 'it'): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function tagLabel(tag: string): string {
  return contentContract.tags[tag as keyof typeof contentContract.tags];
}
