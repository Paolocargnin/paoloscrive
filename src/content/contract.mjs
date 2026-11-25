/**
 * The single, versioned content contract shared by local checks and the
 * production build. Changes here require a migration plan for existing
 * Workspace texts (ADR 0004).
 *
 * Version 3 is the first contract of Paolo scrive:
 * - every Post is a Racconto with an original language (ADR 0021, ADR 0022);
 * - a Translation lives beside it and carries its own Firma (ADR 0022);
 * - the Workspace path is Nota → Bozza → pubblicato (ADR 0023);
 * - a substantive change is a Revisione, shown as "Rivisto il" (ADR 0024);
 * - writtenAt (a year, month or day) dates the Collana's colophon (ADR 0025).
 *
 * Version 4 adds the Scrittoio (ADR 0026):
 * - personaggi/ holds Personaggi beside Note and Bozze;
 * - forma and origine are Workspace-only metadata, removed at Pubblicazione.
 */
export const CONTENT_CONTRACT_VERSION = 4;

export const contentContract = Object.freeze({
  version: CONTENT_CONTRACT_VERSION,
  workspace: Object.freeze({
    manifest: 'content-contract.json',
    lifecycleDirectories: Object.freeze(['note', 'bozze', 'pubblicati']),
    characterDirectory: 'personaggi',
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
    workspaceOnlyMetadata: Object.freeze(['forma', 'origine']),
    forme: Object.freeze({
      idea: 'Idea',
      scena: 'Scena',
      dialogo: 'Dialogo',
      pensiero: 'Pensiero',
      poesia: 'Poesia',
      canzone: 'Canzone',
      battute: 'Battute',
      frasi: 'Frasi',
      diario: 'Diario',
      lettera: 'Lettera',
      gioco: 'Gioco',
      citazione: 'Citazione',
    }),
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
    optionalMetadata: Object.freeze(['lang', 'tags', 'revisedAt', 'writtenAt']),
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

/** writtenAt: 2009, 2009-08 or 2009-08-14. */
export const writtenAtPattern =
  /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/;

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
