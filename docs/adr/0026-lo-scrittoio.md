---
status: accepted
---

# Lo Scrittoio: un back office locale per il Workspace

Gli scritti di Paolo stavano sparsi nel Google Drive: la cartella «Testi» con le sottocartelle 2008-2016 e 2016-2020, e altri documenti sciolti. Paolo vuole ritrovarli, navigarli e continuare a scrivere in un posto solo, organizzato per Note, Racconti e Personaggi.

## Decisione

- Lo **Scrittoio** è un'app locale, `pnpm scrittoio`, che legge e scrive il Workspace privato (ADR 0001). Non fa parte del sito: Astro non la costruisce, il server ascolta solo su `127.0.0.1` e rifiuta le richieste che arrivano da altre origini.
- Lo Scrittoio mostra tre generi: le **Note** (`note/`), i **Racconti** (le Bozze in `bozze/` e quelli usciti in `pubblicati/`, ADR 0023) e i **Personaggi**, in una nuova cartella `personaggi/`. Un Personaggio è testo libero come una Nota; lo Scrittoio mostra dove compare cercando il suo nome negli altri testi.
- Una Nota può avere una **Forma** da un vocabolario controllato: idea, scena, dialogo, pensiero, poesia, canzone, battute, frasi, diario, lettera, gioco, citazione.
- `forma` e `origine` (da dove viene un testo importato) sono metadati del Workspace. La Pubblicazione li toglie, così un Racconto pubblico resta com'è nel contratto.
- Lo Scrittoio salva da solo sul disco mentre Paolo scrive. «Salva nel repository» controlla il contratto, fa commit e push sul repository privato: è un gesto di Paolo, come la Pubblicazione.
- Un testo si cancella dallo Scrittoio, con i suoi Appunti e Materiali, dopo una conferma che dice se è già al sicuro nel repository privato. Finché lo Scrittoio resta aperto si può annullare; dopo «Salva nel repository» il testo resta nella storia di Git. Un Racconto pubblicato non si cancella da qui, perché il testo pubblico dipende dalla sua cartella di lavoro.
- Pubblicare resta un comando che Paolo lancia dal terminale (ADR 0023). Lo Scrittoio lo ricorda accanto a una Bozza, ma non lo esegue.
- Il 25 novembre 2026 gli scritti del Drive sono entrati nel Workspace così come Paolo li aveva scritti: il testo non è stato toccato, solo convertito in Markdown, con titolo, forma, data e provenienza nei metadati. Sono rimasti fuori i file che non sono scrittura (una tablatura, una ricetta, due prompt di lavoro, un elenco di lavori web) e un file con soli numeri che sembrano un dato di pagamento.

## Conseguenze

Il contratto dei contenuti passa alla versione 4 (ADR 0004): `personaggi/` è una voce ammessa del Workspace e `forma` e `origine` sono metadati solo privati. La migrazione è il nuovo numero di versione in `content-contract.json`; nessun testo esistente cambia. Un Personaggio non ha ancora legami espliciti con i testi né una pagina pubblica: si vedrà scrivendo.
