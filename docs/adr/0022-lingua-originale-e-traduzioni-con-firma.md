---
status: accepted
---

# Ogni Racconto ha una Lingua originale; le Traduzioni portano una Firma

Paolo scrive sia in italiano sia in inglese: un memo vocale in inglese, una Nota in italiano. Un Racconto nasce in una lingua e può uscire anche nell'altra.

## Decisione

- Ogni Racconto ha una Lingua originale, italiano (predefinito) o inglese, nel campo `lang`. La scelta è racconto per racconto. L'interfaccia del sito resta in italiano.
- La Traduzione nell'altra lingua vive in `src/content/translations/<lang>/<slug>.md` ed è servita a `/racconti/<slug>/<lang>/`. Dal Racconto eredita tutto tranne titolo, descrizione e testo.
- La Traduzione può farla l'IA. Finché Paolo non la firma, la pagina mostra un avviso nella lingua della traduzione.
- La Firma è l'approvazione esplicita di Paolo dopo la rilettura, anche senza modifiche. `pnpm firma -- --slug <slug> --lang <lang> --signed-by "Paolo Cargnin"` scrive `signedBy` e `signedAt`, toglie l'avviso e lascia in fondo alla pagina chi ha firmato e quando. Lo stato firmata/non firmata appartiene alla Traduzione, non al Racconto.
- La Traduzione segue l'originale: `basedOn` indica la versione che traduce (`revisedAt` o, se manca, `publishedAt`). Se il Racconto riceve una Revisione (ADR 0024), il controllo dei contenuti blocca la build finché la Traduzione non segue la nuova versione. Una Firma più vecchia della versione seguita non vale: se l'aggiornamento lo fa l'IA, toglie la Firma e l'avviso torna; se lo rilegge Paolo, firma di nuovo.

## Conseguenze

Sostituisce l'ADR 0020, dove la traduzione italiana ereditava l'avviso dal Post e non poteva essere firmata a parte.
