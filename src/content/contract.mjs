/**
 * The single, versioned content contract shared by local checks and the
 * production build. Changes here require a migration plan for existing
 * Workspace texts (ADR 0004).
 *
 * Version 3 is the first contract of Paolo scrive:
 * - every Post is a Racconto with an original language (ADR 0021, ADR 0022);
 * - a Translation lives beside it and carries its own Firma (ADR 0022);
 * - the Workspace path is Nota → Bozza → pubblicato (ADR 0023);
 * - a substantive change is a Revisione, shown as "Rivisto il" (ADR 0024).
 */
export const CONTENT_CONTRACT_VERSION = 3;

export const contentContract = Object.freeze({
  version: CONTENT_CONTRACT_VERSION,
  workspace: Object.freeze({
    manifest: 'content-contract.json',
    lifecycleDirectories: Object.freeze(['note', 'bozze', 'pubblicati']),
    textFile: 'testo.md',
    acceptedSidecars: Object.freeze(['appunti.md', 'lettura-critica.md']),
    materialsDirectory: 'materiali',
    materialExtensions: Object.freeze([
      '.m4a',
      '.mp3',
      '.wav',
      '.ogg',
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.heic',
      '.pdf',
      '.txt',
      '.md',
    ]),
  }),
  languages: Object.freeze({
    it: Object.freeze({ name: 'italiano', ownName: 'Italiano' }),
    en: Object.freeze({ name: 'inglese', ownName: 'English' }),
  }),
  defaultLanguage: 'it',
  tags: Object.freeze({
    famiglia: 'Famiglia',
    fantastico: 'Fantastico',
    giochi: 'Giochi',
    lavoro: 'Lavoro',
    memoria: 'Memoria',
    quotidiano: 'Quotidiano',
    viaggio: 'Viaggio',
  }),
  racconto: Object.freeze({
    requiredMetadata: Object.freeze([
      'id',
      'title',
      'description',
      'publishedAt',
    ]),
    optionalMetadata: Object.freeze(['lang', 'tags', 'revisedAt']),
    maxTags: 4,
  }),
  translation: Object.freeze({
    requiredMetadata: Object.freeze(['title', 'description', 'basedOn']),
    optionalMetadata: Object.freeze(['signedBy', 'signedAt']),
  }),
});

export const controlledTagIds = Object.freeze(
  Object.keys(contentContract.tags),
);

export const languageCodes = Object.freeze(
  Object.keys(contentContract.languages),
);

export const stableIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
