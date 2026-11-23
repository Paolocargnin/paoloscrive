---
status: accepted
---

# Un percorso leggero: Nota, Bozza, Racconto

Il ciclo editoriale di PC – the blog (Publication candidate, fact-check, contro-discussione, fonti, digest) serve a testi che fanno affermazioni sul mondo. Un racconto è inventato: quei passaggi non hanno niente da controllare. Paolo preferisce andare veloce e migliorare scrivendo.

## Decisione

- Nel Workspace un testo passa da `note/` (Nota) a `bozze/` (Bozza) a `pubblicati/` (la cartella di lavoro di un Racconto già uscito). Il testo è sempre `testo.md`; la Nota di partenza resta in `appunti.md`.
- La Lettura critica è facoltativa: un'IA o una persona dice cosa non funziona in una Bozza, senza riscriverla, in `lettura-critica.md`. Non è un cancello.
- La Pubblicazione la fa sempre Paolo, mai un'IA. `pnpm pubblica -- --slug <slug> --approved-by "Paolo Cargnin"` controlla i metadati, copia il testo tra i Racconti senza mai sovrascriverne uno e archivia la Bozza in `pubblicati/`. Un agente si ferma e chiede a Paolo di lanciarlo. Il Racconto va online quando Paolo fa il merge della pull request su `main`.
- Per i Racconti non ci sono fact-check, fonti, contro-discussione, pacchetto di pubblicazione né digest. I campi `sources` e `corrections` non esistono più.
- I metadati obbligatori di un Racconto sono `id`, `title`, `description` e `publishedAt`; `lang`, `tags` (fino a quattro Temi) e `revisedAt` sono facoltativi.

## Conseguenze

Sostituisce gli ADR 0002, 0003, 0009, 0014 e 0017. Modifica l'ADR 0004 (nuovo contratto del Workspace, versione 3) e l'ADR 0013 (nuovi metadati). Modifica l'ADR 0012: `main` resta raggiungibile solo con una pull request che passa il controllo Quality, ma l'approvazione di una seconda persona non è più obbligatoria, perché la Pubblicazione è un atto di Paolo. Le vecchie skill editoriali `blog-*` sono sostituite da `racconti` e `lettura-critica`.
