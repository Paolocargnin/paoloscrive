---
name: lettura-critica
description: Fai una Lettura critica di una Bozza di Paolo scrive, cioè dici cosa non funziona senza riscrivere il testo. Usala quando Paolo chiede un parere, una critica o un secondo sguardo su una Bozza.
---

# Lettura critica

1. Leggi `content/workspace/bozze/<slug>/testo.md` e, se serve per capire
   l'intenzione, `appunti.md`.
2. Leggi come un lettore attento, non come un correttore di bozze. Cerca dove
   il racconto perde tensione, dove un personaggio agisce senza motivo, dove
   un dialogo spiega invece di mostrare, dove il finale non mantiene la
   promessa dell'inizio, dove la lingua inciampa.
3. Per ogni punto cita il passaggio, di' cosa non funziona e perché. Puoi
   indicare una direzione, ma non scrivere la frase al posto di Paolo e non
   modificare `testo.md`.
4. Aggiungi la lettura in fondo a `lettura-critica.md` con data e autore
   ("Claude" o il nome della persona), dal punto più importante al meno
   importante. Al massimo cinque punti: se ce ne sono di più, scegli.
5. Commit e push nel Workspace privato.

Finish when `lettura-critica.md` holds the new reading, `testo.md` is
unchanged, and `pnpm workspace:validate` passes.
