---
name: progetto
description: "Aprire la casa del software di un progetto: creare i documenti in docs/, riempirli, spezzare un documento che sfonda il tetto, archiviare il lavoro finito. Usala quando inizi un progetto nuovo, quando un documento supera le 300 righe, o quando qualcosa si chiude e va in archivio."
---

# La casa del software

Un progetto senza documenti è un progetto che ogni volta riparte da zero. Questi file sono la memoria della software house: chi siamo, com'è fatto, cosa stiamo facendo, cosa abbiamo deciso.

**Si versionano.** Copiando la cartella del progetto, si riparte uguali.

## Quando usarla
- **Progetto nuovo** (o `docs/` assente) → crea il set
- **Un documento ha più di 300 righe** → spezzalo e aggiorna il glossario
- **Hai chiuso del lavoro** → archivialo

## I documenti

| File | A cosa serve | Chi lo tiene |
|---|---|---|
| `docs/PROGETTO.md` | cos'è il prodotto, stack, comandi veri, convenzioni, a chi serve | referenti |
| `docs/ARCHITETTURA.md` | i moduli, chi fa cosa, mappa dei file, come si parlano | referenti |
| `docs/REGOLE.md` | le regole di codice di questo progetto (naming, errori, test, cosa non toccare) | referenti |
| `docs/STATO.md` | obiettivi, coda, task in corso, blocchi | capo + referenti |
| `docs/DECISIONI.md` | decisioni prese e risposte già date | capo + referenti |
| `docs/GLOSSARIO.md` | vocabolario e indice dei documenti spezzati | chi spezza |
| `docs/archivio/AAAA-MM.md` | il lavoro finito, una riga per voce | capo |

Tetto: **300 righe a documento**. Oltre, si spezza.

## Progetto nuovo: crea il set

Il capo crea i file **vuoti con i titoli** (non legge codice per farlo). Poi l'esploratore mappa il progetto e i referenti li riempiono.

Percorsi e scheletri:

**`docs/PROGETTO.md`**
```markdown
# <nome del progetto>

## Cos'è
<due righe: cosa fa, a chi serve>

## Stack
<linguaggi, framework, database, versione di runtime>

## Comandi veri
- install: `<comando>`
- test: `<comando>`
- avvio: `<comando>`

## Convenzioni
<come si scrive qui dentro: nomi, cartelle, gestione errori, lingua dei testi>

## Dove sta cosa
<cartelle principali e cosa contengono>
```

**`docs/ARCHITETTURA.md`**
```markdown
# Architettura

## Aree funzionali
| Area | Cartella | Responsabilità |
|---|---|---|

## Moduli
### <modulo>
- fa:
- non fa:
- parla con:

## Flusso principale
<come viaggia una richiesta/azione dall'inizio alla fine>
```

**`docs/REGOLE.md`**
```markdown
# Regole di codice di questo progetto

## Naming
<come si chiamano file, funzioni, variabili>

## Errori
<come si gestiscono qui>

## Test
<dove stanno, come si scrivono, cosa deve coprire>

## Da non toccare
<parti delicate, cose vietate>

## Comandi
- lint: `<comando>`
- typecheck: `<comando>`
```

**`docs/STATO.md`**
```markdown
# Stato

## Obiettivo
<una riga>

## Coda
| id | obiettivo | area | stato |
|---|---|---|---|

## Task in corso
| id | referente | task | operaio | stato |
|---|---|---|---|---|

## Bloccati
| id | cosa | in attesa di |
|---|---|---|
```

**`docs/DECISIONI.md`**
```markdown
# Decisioni

Formato: `decisione — perché — data`.
Chi riceve una risposta la scrive qui. La volta dopo nessuno la richiede.
```

## Spezzare un documento che sfonda il tetto

Non si allunga un documento: si divide per **area**, non per dimensione.

1. Scegli l'asse: `docs/ARCHITETTURA.md` → `docs/ARCHITETTURA-pagamenti.md`, `docs/ARCHITETTURA-catalogo.md`
2. Nel file principale resta un **indice** con una riga per pezzo e il link
3. Registra in `docs/GLOSSARIO.md` **cosa sta dove** e i **termini** che quel pezzo usa
4. Nessun pezzo nuovo può superare le 300 righe

`docs/GLOSSARIO.md`:
```markdown
# Glossario

## Dove sta cosa
| Documento | Contiene |
|---|---|

## Parole
| Termine | Significato in questo progetto |
|---|---|
```

## Archiviare

È la regola che tiene corti i documenti di lavoro.

Quando una voce si chiude:
1. Sposta la riga in `docs/archivio/AAAA-MM.md` (una riga: cosa, area, esito)
2. Toglila da `docs/STATO.md`

`docs/STATO.md` contiene **solo cose aperte**. `docs/DECISIONI.md` tiene le decisioni ancora valide: una decisione superata va in archivio con la nota di cosa l'ha sostituita.

## Cosa si legge e quando
- Il **capo** legge `docs/STATO.md` e `docs/DECISIONI.md`. Mai il codice.
- I **referenti** leggono tutto `docs/` e il codice che serve.
- Gli **operai** leggono `docs/PROGETTO.md` e `docs/REGOLE.md` prima di toccare qualcosa, e il codice che serve al loro compito.

## Regola finale
Un documento che nessuno aggiorna è peggio di un documento assente, perché mente. Se una cosa cambia e il documento non lo dice, il prossimo che lo legge sbaglia.
