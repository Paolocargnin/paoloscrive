---
status: accepted
---

# La grafica è la Collana: ogni Racconto è un volume tascabile

La sessione di prototipazione ha confrontato tre direzioni (Taccuino, Collana, Corrispondenza) in un prototipo usa e getta, con l'indice e la pagina di lettura, su desktop e telefono, in chiaro e in scuro. Il 23 novembre 2026 Paolo ha scelto la **Collana**. Sostituisce l'ADR 0016 e la direzione provvisoria «Taccuino». L'ADR 0007 resta valido: il frontend è nostro, in Astro e CSS nativo.

## Decisione

- I Racconti sono i volumi numerati di una collana tascabile, con il numero romano e l'ordinale in parole («volume secondo»).
- Caratteri: Bodoni Moda per il marchio, i numeri romani, i titoli e il capolettera; EB Garamond per il testo, giustificato e sillabato, con il maiuscoletto per etichette e didascalie. Entrambi sono serviti in locale con Fontsource.
- Colori: carta, inchiostro, inchiostro tenue e filetto, in chiaro e in scuro. Il colore vero sta solo sui dorsi e sulla fascetta di ogni volume: sei tinte fisse, che seguono il numero del volume e sono uguali nei due temi.
- Home: uno scaffale di dorsi, ognuno spesso quanto il racconto è lungo, con i titoli letti dal basso verso l'alto come sui libri italiani, un dorso tratteggiato «in preparazione» e un fermalibri. Sotto lo scaffale c'è la scheda del volume indicato (numero, anno di scrittura, titolo, incipit, tempo di lettura). Su telefono i libri sono impilati, il primo in basso. Il catalogo completo è a `/racconti/`.
- Pagina di lettura: una testatina fissa con il marchio, il titolo e «pagina due di sette» al posto della barra di avanzamento. Poi il frontespizio (collana e volume, numero romano, titolo, ornamento, descrizione come epigrafe, fascetta con il tempo di lettura), il testo e il colophon.
- Il testo apre con il capolettera su tre righe e le prime parole in maiuscoletto. Un trattino di dialogo o una virgolette iniziali restano appesi nel margine. Il plugin rehype `src/markdown/rehype-capolettera.mjs` lo fa durante la build, sul processore unified di `@astrojs/markdown-remark`.
- Uno stacco di scena (`---`) è l'ornamento a due foglie. Un blockquote, cioè una storia dentro la storia, è in corsivo e rientrato, senza colore.
- Colophon: «Finito di scrivere nell'agosto MMIX», dalla nuova data facoltativa `writtenAt` (anno, mese o giorno; se manca vale `publishedAt`). Contiene anche «Rivisto il …» (ADR 0024), i Temi e «Dalla stessa collana».
- Traduzione (ADR 0022): nel frontespizio, come la pagina dei diritti di un libro, compaiono «Titolo originale» e il link all'altra lingua. Se è firmata c'è «Traduzione di …». Se non è firmata, la fascetta diventa l'avviso, nella stessa forma, così non sembra un errore.

## Opzioni considerate

- Il Taccuino (inchiostro su crema, tratteggio, il blu solo per la storia nella storia) era la regola visiva del taccuino di Paolo, ma Paolo ha preferito la Collana per i racconti. Dal Taccuino resta un'idea: gli schizzi dei taccuini come allegati del racconto.
- La Corrispondenza (buste, francobolli, annulli) era la più giocosa, ma meno adatta alla lettura lunga.

## Conseguenze

Paolo vuole che in futuro un racconto possa arrivare con degli allegati, schizzi dai suoi taccuini consegnati insieme al racconto. Nella Collana saranno le «tavole fuori testo» in fondo al volume; il contratto dei contenuti non le prevede ancora. Restano aperti il marchio (`Paolo scrive` o `paoloscrive`), i racconti con più finali, i racconti in inglese sullo stesso scaffale o su uno separato, e la newsletter. Il prototipo resta come prova sul branch locale `claude/prototype-visual-directions-778987` e nell'Artifact https://claude.ai/artifact/FYiVcbCwtvoayv1Ek7SbNQ; usa testi privati di Paolo, quindi non va pubblicato in questo repository.
