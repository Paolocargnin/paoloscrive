# Il Workspace privato

`content/workspace/` è un repository Git a sé, privato
(`Paolocargnin/paoloscrive-workspace`), ignorato da questo repository pubblico.
Contiene le Note e le Bozze finché Paolo non le pubblica (ADR 0001, ADR 0023).
Non copiarlo in `src/content/`, non forzarne l'aggiunta qui e non metterci
segreti o credenziali. GitHub privato è un backup con controllo degli accessi,
non una cassaforte cifrata.

## Primo avvio su un nuovo computer

```sh
git clone git@github.com:Paolocargnin/paoloscrive-workspace.git content/workspace
pnpm workspace:validate
```

Per creare da zero un Workspace vuoto (solo la prima volta in assoluto):
`pnpm workspace:init -- --remote <url del repository privato>`.

## La forma

```text
content/workspace/
  content-contract.json      versione del contratto (3)
  note/<slug>/testo.md       una Nota: idea, scena, dialogo
  note/<slug>/materiali/     memo vocali, foto del taccuino, scansioni
  bozze/<slug>/testo.md      una Bozza, con id e metadati del Racconto
  bozze/<slug>/appunti.md    la Nota da cui è nata
  bozze/<slug>/lettura-critica.md   facoltativa
  pubblicati/<slug>/         la cartella di lavoro di un Racconto uscito
  personaggi/<slug>/testo.md un Personaggio
```

Ogni `testo.md` può avere nel frontmatter `title`, `writtenAt` e, per una Nota,
`forma`. I testi arrivati dal Google Drive hanno anche `origine` (id, cartella e
nome del file). `forma` e `origine` restano nel Workspace: `pnpm pubblica` li
toglie (ADR 0026).

## Lo Scrittoio

È il back office privato del Workspace (ADR 0026). Si apre come un'app del Mac,
**Scrittoio**, da Spotlight, Launchpad o dal Dock. Per installarla, o
aggiornarla dopo aver spostato il repository o cambiato Node:

```sh
pnpm scrittoio:app
```

Senza app, `pnpm scrittoio` apre lo stesso Scrittoio nel browser su
http://localhost:4322. Lanciarlo di nuovo sostituisce quello già aperto. Il
registro dell'app è in `~/Library/Logs/Scrittoio.log`.

Che cosa fa:
Note, Racconti e Personaggi, filtri per forma, anno e provenienza, ricerca in
tutti i testi. Si legge, si scrive (salva da solo), si trasforma una Nota in
Racconto, si cancella (con «Annulla» finché lo Scrittoio resta aperto). «Salva nel repository» fa commit e push sul repository privato.
Risponde solo da questo computer. L'interruttore «Modifiche» mostra che cosa è cambiato
dall'ultimo salvataggio nel repository. Scorciatoie: `/` cerca, `n` nuovo
testo, `e` modifica, `m` modifiche, `←` `→` testo precedente e successivo,
`Esc` torna indietro, `⌘S` salva.

## I comandi

```sh
pnpm nota -- --slug il-faro
pnpm bozza -- --slug il-faro
pnpm pubblica -- --slug il-faro --approved-by "Paolo Cargnin"
pnpm firma -- --slug il-faro --lang en --signed-by "Paolo Cargnin"
pnpm workspace:validate
```

- `nota` crea `note/<slug>/testo.md` (lo Scrittoio fa lo stesso, con un
  titolo e una forma).
- `bozza` sposta la Nota in `bozze/`, la conserva come `appunti.md` e crea un
  `testo.md` con un `id` stabile e i metadati vuoti da riempire. Facoltativo:
  `writtenAt`, la data di scrittura per il colophon.
- `pubblica` controlla i metadati, copia `testo.md` in
  `src/content/posts/<slug>.md` con la data di oggi se manca `publishedAt`, non
  sovrascrive mai un Racconto e archivia la cartella in `pubblicati/`. Il
  Racconto va online con il merge della pull request su `main`.
- `firma` firma una Traduzione già riletta (ADR 0022).

`--approved-by` e `--signed-by` non sono scorciatoie per un agente: un'IA si
ferma e chiede a Paolo di lanciare il comando, o di autorizzarlo con parole
sue.

## Le skill

- `$racconti` accompagna un testo lungo tutto il percorso: Nota, Bozza,
  Pubblicazione, Traduzione, Firma, Revisione.
- `$lettura-critica` scrive in `lettura-critica.md` cosa non funziona in una
  Bozza, senza riscriverla.

## Sincronizzare

Prima di lavorare, `git -C content/workspace pull --ff-only`. Fai commit di ogni
passo che conta e fai push. Se un pull va in conflitto, fermati, confronta le
due versioni, risolvi a mano, lancia `pnpm workspace:validate` e fai commit.
Mai un force push. Se il computer si perde, si riclona il repository privato.
