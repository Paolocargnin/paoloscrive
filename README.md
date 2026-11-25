# Paolo scrive

Il blog dei racconti di Paolo Cargnin, in italiano e in inglese. È un sito
Astro pre-renderizzato, nato come fork di
[PC – the blog](https://github.com/Paolocargnin/blog) (ADR 0021): qui solo ciò
che scrive Paolo, là progetti, codice e lavoro.

Le Note, le Bozze e i Personaggi stanno nel Workspace privato in
`content/workspace/`, un repository separato che non va mai aggiunto a questo.
Si leggono e si scrivono nello Scrittoio. Vedi
[il Workspace](docs/workspace.md).

## Sviluppo locale

Node 24.11.1 e pnpm 10.32.1, poi `pnpm install`.

- `pnpm dev`: server locale.
- `pnpm scrittoio`: lo Scrittoio, il back office privato dove leggere e
  scrivere Note, Racconti e Personaggi del Workspace (ADR 0026).
- `pnpm quality`: tutti i controlli richiesti (formato, tipi, test, skill,
  contenuti, build, link).
- `pnpm content:check`: controlla Racconti, Traduzioni e, se c'è, il Workspace.
- `pnpm build`: build di produzione dai soli Racconti pubblici.

## Scrivere

Il percorso è Nota → Bozza → Racconto (ADR 0023):

```sh
pnpm nota -- --slug il-faro
pnpm bozza -- --slug il-faro
pnpm pubblica -- --slug il-faro --approved-by "Paolo Cargnin"
```

Un Racconto è `src/content/posts/<slug>.md`, servito a `/racconti/<slug>/`. Ha
una lingua originale (`lang`, italiano se manca), una data di scrittura
facoltativa per il colophon (`writtenAt`: `2009`, `2009-08` o `2009-08-14`) e
può avere una Traduzione in
`src/content/translations/<lang>/<slug>.md`, servita a `/racconti/<slug>/<lang>/`.
Una Traduzione fatta dall'IA mostra un avviso finché Paolo non la firma con
`pnpm firma` (ADR 0022). Una modifica sostanziale dopo la pubblicazione si
segna con `revisedAt` e compare come «Rivisto il» (ADR 0024).

Le skill `$racconti` e `$lettura-critica` guidano un agente lungo questo
percorso.

## Grafica

La grafica è la «Collana» (ADR 0025). Ogni Racconto è un volume tascabile
numerato: scaffale di dorsi in home, frontespizio con numero romano, testo in
EB Garamond giustificato con capolettera in Bodoni Moda, colophon in fondo. Le
proposte scartate sono in [docs/design/proposte.html](docs/design/proposte.html)
e nell'Artifact della sessione di prototipazione.

## Pubblicazione e deploy

`main` è il confine della pubblicazione: ci si arriva solo con una pull request
che passa il controllo **Quality**, e il merge lo fa Paolo. Il sito è servito
come asset statici dal Worker Cloudflare `paoloscrive` all'origine canonica
https://paoloscrive.it (`PUBLIC_SITE_URL=https://paoloscrive.it`; `www`
reindirizza lì). Vedi [deploy e ripristino](docs/deployment.md).
