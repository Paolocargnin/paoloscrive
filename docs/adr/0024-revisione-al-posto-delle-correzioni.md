---
status: accepted
---

# Una Revisione al posto delle Correzioni

In un racconto non ci sono errori di fatto da correggere. Ci sono refusi, e ci sono ripensamenti.

## Decisione

- I refusi si correggono in silenzio.
- Una modifica sostanziale, come un finale, una scena o un personaggio, è una Revisione. Si segna mettendo nel Racconto `revisedAt` con la data. La pagina mostra «Rivisto il …» accanto alla data di pubblicazione. Non serve una spiegazione; la storia completa resta in Git.
- Una Revisione non esce finché ogni Traduzione non la segue (ADR 0022).

## Conseguenze

Sostituisce l'ADR 0010 e il registro visibile delle Correzioni. Il comando `post:correct` non esiste più.
