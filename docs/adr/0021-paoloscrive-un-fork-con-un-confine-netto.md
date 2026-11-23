---
status: accepted
---

# paoloscrive è un fork di PC – the blog con un confine netto

Paolo vuole un blog solo per la scrittura creativa. Invece di aggiungere una sezione a PC – the blog, o di tenere due siti in un monorepo o su branch diversi, paoloscrive è un repository a sé (`Paolocargnin/paoloscrive`) nato dalla storia di `Paolocargnin/blog`. GitHub non permette di fare il fork di un proprio repository nello stesso account, quindi il fork è un repository nuovo con tutta la storia, e `blog` resta raggiungibile come remote `upstream` (solo fetch) per portare qui i miglioramenti degli strumenti.

## Decisione

- paoloscrive pubblica solo ciò che scrive Paolo. Progetti, codice, lavoro e devlog generati dall'IA restano su PC – the blog. Un testo sul *come l'ho scritto* sta qui, uno sul *come l'ho costruito* sta là.
- Al lancio il blog è fatto solo di Racconti. Ogni Post è un Racconto; non c'è un campo per distinguere altri tipi di testo. Se un giorno arriveranno testi su Paolo o sul percorso creativo, si aggiungerà un tipo con un nuovo ADR.
- Il canale dei Post generati dall'IA (ADR 0019) non esiste qui: niente `aiGenerated`, niente skill `daily-blogs-publish`.
- I Post, le immagini e le traduzioni di PC – the blog non sono stati portati nel fork.
- Il Workspace privato è `Paolocargnin/paoloscrive-workspace`, clonato in `content/workspace/` (ADR 0001). Accanto al testo di lavoro può tenere materiale grezzo in `materiali/`: memo vocali, foto del taccuino, scansioni. La Pubblicazione copia solo il testo.

## Conseguenze

Sostituisce l'ADR 0019. Cambia il vocabolario dei Temi (ADR 0006): ora è in italiano e pensato per i racconti. Il Worker Cloudflare si chiama `paoloscrive` e l'origine canonica è https://paoloscrive.it, con `www.paoloscrive.it` che reindirizza lì (ADR 0018).
