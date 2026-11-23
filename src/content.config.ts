import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import {
  contentContract,
  controlledTagIds,
  languageCodes,
  stableIdPattern,
  writtenAtPattern,
} from './content/contract.mjs';

const language = z.enum(languageCodes as unknown as [string, ...string[]]);

// Every Post is a Racconto (ADR 0021). Validation rules beyond the shape live
// in scripts/content-contract.mjs and run before every build.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z
    .object({
      id: z.string().regex(stableIdPattern),
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      publishedAt: z.coerce.date(),
      revisedAt: z.coerce.date().optional(),
      writtenAt: z.coerce.string().regex(writtenAtPattern).optional(),
      lang: language.default(contentContract.defaultLanguage),
      tags: z
        .array(z.enum(controlledTagIds as unknown as [string, ...string[]]))
        .max(contentContract.racconto.maxTags)
        .default([]),
    })
    .strict(),
});

// ADR 0022: translations/<lang>/<slug>.md. Everything not listed here comes
// from the Racconto; the Firma belongs to the Translation.
const translations = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/translations' }),
  schema: z
    .object({
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      basedOn: z.coerce.date(),
      signedBy: z.string().trim().min(1).optional(),
      signedAt: z.coerce.date().optional(),
    })
    .strict(),
});

export const collections = { posts, translations };

export const contentContractVersion = contentContract.version;
