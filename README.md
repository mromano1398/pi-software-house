# pi-software-house

Trasforma [Pi](https://pi.dev) in una **software house**: un capo che pianifica, referenti per area che coordinano, operai che eseguono, documenti di progetto versionati e regole di codice che valgono ovunque.

Si installa una volta per macchina e vale in **ogni progetto**.

## Cosa cambia

Prima: apri Pi, chiedi una cosa, ti risponde.

Dopo: apri Pi in un progetto, dici **cosa vuoi ottenere** in italiano normale, e:

1. il **capo** apre la casa del software (`docs/`) e fa mappare il progetto
2. assume un **referente** per ogni area reale del progetto (i nomi sono quelli del progetto, non tipi generici)
3. i referenti assumono i **loro operai**, uno per obiettivo
4. il lavoro si svolge nelle pane Herdr, in serie o in parallelo
5. quello che si chiude va in archivio, quello che si decide va in `docs/DECISIONI.md`
6. tu ricevi **una risposta in tre righe**, e una sola domanda se serve una decisione

## Installazione

```bash
pi install git:github.com/mromano1398/pi-software-house
```

Poi apri Pi. **Alla prima apertura chiede una volta sola:**

```
Configuro la software house?
  Servono questi pacchetti:
    • pi-herdr-agents — i referenti vivono in una pane Herdr
    • @tintinweb/pi-subagents — gli operai
    • pi-peer — i referenti parlano tra loro e col capo
    • ponytail — scrive meno codice: la soluzione piu' corta che funziona
    • @juicesharp/rpiv-ask-user-question — il capo ti fa le domande a opzioni
    • pi-cache-guardian — meno token
  Va sistemato il layout delle pane Herdr.
  Va filtrata una skill che entra in conflitto (orchestrate).

  → Sì
```

Dici sì e fa tutto da solo: scarica i sei pacchetti, scrive il layout delle pane, toglie la skill in conflitto. Poi riavvia Pi.

Se dici no, non lo richiede più. Per farlo dopo: comando **`/casa`** (mostra lo stato e sistema quello che manca).

Per una macchina senza interfaccia (CI, script): `bash setup/installa.sh`.

**Requisiti:** [Herdr](https://herdr.dev) installato — le pane dei referenti ci girano dentro. Senza Herdr il resto funziona, ma i referenti non hanno la loro pane.

**Modelli:** di serie usa l'abbonamento Grok. Se non ce l'hai, cambia `model:` nei file degli agenti e in `manual/casa.md`.

## Cosa c'è dentro

| Pezzo | Cosa fa |
|---|---|
| `manual/casa.md` | il manuale iniettato nel system prompt a ogni turno: ruoli, organigramma, documenti, regole di codice |
| `extensions/casa.ts` | inietta il manuale. A un referente arriva solo la parte "regole per tutti" |
| `extensions/setup.ts` | alla prima apertura chiede una volta e configura tutto da solo: i sei pacchetti esterni, il layout delle pane, il filtro (`/casa` per rivedere) |
| `extensions/safety-gate.ts` | il gate: dentro il progetto sei libero, fuori dal progetto chiede, i segreti li blocca, un referente può solo assumere e scrivere documenti |
| `skills/crew` | come si assume un referente e un operaio (formato esatto dei file, permessi, modelli) |
| `skills/progetto` | come si apre e si tiene la casa del software: creare `docs/`, spezzare un documento troppo lungo, archiviare |
| `skills/secure-change` | cosa controllare prima di toccare auth, crypto, upload, SQL, HTML, segreti |
| `skills/tdd` | test prima, poi il codice minimo che lo fa passare |
| `skills/grilling` | quando la richiesta è ambigua: domande a round, ognuna con una risposta consigliata |
| `skills/diagnosing-bugs` | bug difficili: prima un segnale rosso/verde che riproduce, poi l'indagine |
| `prompts/` | `/implement`, `/review`, `/test`, `/commit`, `/explore` |

## La casa del software

Ogni progetto tiene la sua memoria in `docs/`, e **si versiona**: copiando la cartella il progetto riparte uguale.

```
docs/
  PROGETTO.md      cos'è il prodotto, stack, comandi veri, convenzioni
  ARCHITETTURA.md  i moduli, chi fa cosa, come si parlano
  REGOLE.md        le regole di codice di questo progetto
  STATO.md         obiettivi, coda, task in corso, blocchi  (solo cose aperte)
  DECISIONI.md     decisioni prese e risposte già date
  GLOSSARIO.md     vocabolario e indice, quando un documento viene spezzato
  archivio/        il lavoro finito, una riga per voce
```

Tetti: **300 righe** per documento, **500 righe** per file di codice. Oltre, si spezza.

## Modelli

Di serie: abbonamento Grok (`xai/grok-4.6`) per capo, referenti e operai; `xai/grok-4.3` per la ricognizione; `openai-codex/gpt-5.5` per la **revisione**, su una famiglia diversa apposta — chi scrive non si auto-promuove.

Cambiarli: nel manuale (`manual/casa.md`) e in `skills/crew/SKILL.md`. Il modello di un agente si imposta nel suo file, campo `model:`.

## Sicurezza

Il gate dentro il progetto non chiede niente: crea, modifica, cancella, git, script. Si ferma solo per comandi di sistema (`sudo`, `mkfs`, `dd` su disco, reboot, pipe-to-shell, publish), comandi distruttivi puntati **fuori** dal progetto, "cancella tutto" e force-push su `main`. Segreti e chiavi: bloccati sempre.

Un sub-agente non interroga mai l'utente: se gli serve un'autorizzazione fuori dal progetto viene bloccato e riferisce al suo superiore.

## Personalizzare

- **Il manuale**: `manual/casa.md`
- **Gli skill**: `skills/*/SKILL.md`
- **I modelli**: `manual/casa.md` + `skills/crew/SKILL.md`
- Una modifica si vede subito dopo `/reload` in Pi

## Disinstallare

```bash
pi remove git:github.com/mromano1398/pi-software-house
```
