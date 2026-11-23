---
name: racconti
description: Porta un testo di Paolo scrive lungo il percorso Nota → Bozza → Racconto, comprese Traduzioni, Firma e Revisioni. Usala quando Paolo vuole salvare un'idea, un memo vocale o un dialogo, trasformare una Nota in Bozza, preparare la pubblicazione, tradurre un Racconto o segnare una Revisione.
---

# Racconti

Leggi `CONTEXT.md` e `docs/workspace.md`. Prima di toccare il Workspace,
`git -C content/workspace pull --ff-only`.

## Nota

1. Scegli con Paolo uno slug in minuscole con i trattini e lancia
   `pnpm nota -- --slug <slug>`.
2. Scrivi l'idea in `content/workspace/note/<slug>/testo.md` con le sue parole.
   Un memo vocale si trascrive in locale (whisper-cli, mai un servizio esterno
   senza il suo permesso) e il pezzo utile va in `materiali/`.
3. `pnpm workspace:validate`, poi commit e push nel Workspace privato.

## Bozza

1. `pnpm bozza -- --slug <slug>`: la Nota diventa `appunti.md`, il Racconto si
   scrive in `bozze/<slug>/testo.md`, che ha già un `id`.
2. Il testo lo scrive Paolo. Puoi riordinare appunti, proporre una struttura,
   fare domande; non scrivere il racconto al posto suo.
3. Prima di pubblicare servono `title`, `description` e, se non è italiano,
   `lang: en`. I `tags` sono facoltativi e vengono dal vocabolario in
   `src/content/contract.mjs`.

## Pubblicazione

La fa Paolo. Fermati e chiedigli di lanciare
`pnpm pubblica -- --slug <slug> --approved-by "Paolo Cargnin"`, oppure di
autorizzarlo con parole sue. Poi prepara un branch e una pull request con il
nuovo file in `src/content/posts/`; il merge su `main` è suo.

## Traduzione

1. Scrivi `src/content/translations/<lang>/<slug>.md` nell'altra lingua con
   `title`, `description` e `basedOn` uguale a `revisedAt` del Racconto o, se
   manca, a `publishedAt`. Non aggiungere `signedBy` né `signedAt`: senza Firma
   la pagina mostra l'avviso.
2. La Firma è di Paolo, dopo che l'ha riletta:
   `pnpm firma -- --slug <slug> --lang <lang> --signed-by "Paolo Cargnin"`.

## Revisione

Un refuso si corregge e basta. Se Paolo cambia un finale, una scena o un
personaggio, metti `revisedAt` con la data di oggi. Ogni Traduzione deve
seguire la nuova versione (`basedOn`) prima del merge; se l'aggiorni tu,
togli `signedBy` e `signedAt`.

Finish when `pnpm content:check` passes, the private Workspace is committed and
pushed, and anything public waits in a pull request for Paolo.
