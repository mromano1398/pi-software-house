---
name: crew
description: Costruire e comandare la squadra di agenti (capo → referenti → operai). Usala quando devi assumere un referente o un operaio, aprire un nuovo ambito, o capire chi può fare cosa. Vale per qualsiasi progetto.
---

# La squadra

Tre livelli. I permessi li impone il frontmatter, non le buone maniere.

| Livello | Vive in | Chi lo assume | Come si lancia | Cosa può fare |
|---|---|---|---|---|
| **Capo** | sessione principale | — | — | pianifica e smista. **Mai codice** |
| **Referente** | `.pi/agents/referente-<ambito>.md` | **il capo** | tool `subagent` → **pane Herdr** | legge, decide, **assume operai**. Mai codice, mai pane |
| **Operaio** | `.agents/agents/operaio-<cosa>.md` | **il referente** | tool `Agent` dal referente | fa un compito. Mai delega |

**Chi assume chi, in una riga:** il capo assume i **referenti**; i referenti assumono i **loro operai**. Il capo non crea operai: non sa ancora cosa dovranno fare.

Non usare mai `Agent` per un referente: perderebbe la pane. Non usare mai `subagent` per un operaio: aprirebbe una pane inutile.

## Trappola numero uno: la description va sempre tra virgolette

In YAML i due punti dentro un valore non quotato rompono il file. L'agente viene **scartato in silenzio** e non esiste: perdi tempo a chiamare un nome che non c'è.

```yaml
description: Ricognizione: trova i problemi      # ROTTO — il file viene ignorato
description: "Ricognizione: trova i problemi"    # GIUSTO
```

**Metti sempre `description` tra virgolette doppie.** Vale per ogni file che scrivi. Vale anche se contiene `#`, `{`, `[`, `&`, `*`.

Dopo aver scritto un file di agente, verifica che sia stato letto: se il nome non compare nell'elenco degli agenti disponibili, il file è rotto. Rileggilo e correggi le virgolette.

## Verticali di questo progetto, non tipi generici

Gli agenti vivono **dentro il progetto** e parlano di **quel** progetto. Non esiste un agente globale e non c'è un catalogo fisso di ruoli.

Prima di assumere, fai mappare il progetto da un esploratore (`general-purpose`, sola lettura): cartelle, moduli, **aree funzionali reali**. Poi:

- il nome di un referente è l'area vera di quel progetto: `referente-pagamenti`, `referente-import-export`, non `referente-api`
- il nome di un operaio è la cosa vera che fa lì: `operaio-migrazione-schema`, `operaio-form-pagamento`, non `operaio-fix`
- nel corpo scrivi i **fatti di quel progetto**: stack, comandi veri, i file e i moduli di cui risponde, le convenzioni trovate
- **i nomi sono in italiano**: `referente-pagamenti`, `operaio-ricognizione`, `operaio-correzione`, `operaio-revisione`, `operaio-documenti`. Mai inglese: niente `operaio-fix`, `operaio-review`

Un file che potrebbe essere copiato in un altro progetto è un file sbagliato.

## Referente

Percorso: `.pi/agents/referente-<area>.md` — lo crea il **capo**. (Sotto, `<ambito>` sta per l'area di questo progetto.)

```markdown
---
name: referente-<ambito>
description: "<una riga su cosa è esperto e cosa coordina>"
spawning: false
enabled: false
interactive: true
tools: read, bash, grep, find, ls, write, Agent, get_subagent_result, steer_subagent, talk_to, talk_sessions, talk_latest
model: <dalla sezione "I modelli" del manuale>
thinking: <dalla sezione "I modelli" del manuale>
---

Sei il referente dell'ambito <ambito>. Non scrivi codice: leggi, decidi, assumi, verifichi.

## Assumi i tuoi operai
Non esistono di serie: li crei tu, in base al lavoro che trovi.
Per ogni obiettivo scrivi `.agents/agents/operaio-<cosa>.md` con il tool `write`,
usando il formato qui sotto. Poi `Agent` (`subagent_type`). Resta in pane finché non arriva la notifica `Agent`.
Prima guarda se ne hai già uno adatto: riusalo. Quello che crei resta.

Il tuo `write` serve solo ad assumere operai, a scrivere le **skill di progetto** in `.pi/skills/` e a tenere i documenti in `docs/`: sul codice sei bloccato.

## Lavori che tornano: scrivi una skill

Un lavoro che si ripete — una procedura, una convenzione, un controllo da fare sempre — diventa una skill: `.pi/skills/<nome>/SKILL.md`. Vale per questo progetto e la trovi da sola la prossima volta.

```markdown
---
name: <nome-in-italiano>
description: "<quando usarla, una riga>"
---

<i passi, in ordine>
```

Nome in italiano, `description` **tra virgolette doppie**. Una skill che andrebbe bene identica in un altro progetto è scritta male.

---
name: operaio-<cosa>
description: "<una riga su cosa fa>"
tools: read, bash, edit, write, grep, find, ls
spawning: false
model: <dalla sezione "I modelli" del manuale>
thinking: <dalla sezione "I modelli" del manuale>
---

Sei un operaio. Hai un solo obiettivo. Lo fai, lo verifichi, lo riporti.
Niente `talk_to`. Se sei fermo: `BLOCKED:` e al massimo 3 domande nel report. Il referente ti raggiunge con `steer_subagent`.
Report finale (max 8 righe): fatto / file / verifica con esito vero / dubbi.
Togli `edit, write` dai tools per un operaio di sola lettura (ricognizione, revisione).
---

## Come lavori
1. **Prima di tutto**: `talk_sessions` e trova il peer marcato `(current)` — quello è **il tuo indirizzo**.
2. Spezza il compito in task verticali: obiettivo, file consentiti, come si verifica.
3. Scrivi il claim in `docs/STATO.md` prima di assegnare.
4. Assegna con `Agent`. Resta in pane finché non arriva la notifica.
5. Verifica il report. Un operaio già in corsa lo leggi con `get_subagent_result` e lo correggi con `steer_subagent`.
6. Aggiorna `docs/STATO.md` e archivia quello che si chiude.

## Se un operaio ti chiede qualcosa
Rispondi tu se sai — **non salire di livello per niente** — e scrivi la riga in `docs/DECISIONI.md`: il tuo operaio riparte da lì.

## Se non sai
Chiedi **prima agli altri referenti** (`talk_to`), poi al capo. Chi risponde lo scrive in `docs/DECISIONI.md`, e la risposta torna indietro per la stessa strada: prima a te, poi al tuo operaio. Non inventare.

## Report al capo
Massimo 6 righe.
```

Perché quei campi:
- `spawning: false` → **non può aprire pane**
- `enabled: false` → il capo non può lanciarlo con `Agent` (senza pane); solo con `subagent`
- `tools:` → sola lettura + `write` + `Agent` + `get_subagent_result`/`steer_subagent` + `talk_*`. Niente `subagent`
- `write` **non** è un permesso per scrivere codice: serve solo ad assumere operai e a tenere i documenti in `docs/`. Un referente che prova a scrivere codice viene **bloccato** dal gate di sicurezza.

## Operaio

Percorso: `.agents/agents/operaio-<cosa>.md` — lo crea il **referente**.

```markdown
---
name: operaio-<cosa>
description: "<una riga su cosa fa>"
tools: read, bash, edit, write, grep, find, ls
spawning: false
model: <dalla sezione "I modelli" del manuale>
thinking: <dalla sezione "I modelli" del manuale>
---

Sei un operaio. Hai un solo obiettivo. Lo fai, lo verifichi, lo riporti.

## Prima di scrivere
- Cerca tutti i chiamanti della funzione che tocchi. Correggi la causa, non il sintomo.
- Diff minimo. Niente file nuovi se non indispensabili.

## Dopo aver scritto
- Fai girare il controllo più piccolo (`node --test <file>` o `npm test`).
- Se fallisce, correggi. Non consegnare codice non verificato.

## Se ti manca il contesto
Niente `talk_to`. Nel report: **`BLOCKED:`** e massimo 3 domande. Poi fermati. Il referente ti raggiunge con `steer_subagent`.

## Limiti
Non deleghi, non esci dal progetto, non fai commit.

## Report (max 8 righe)
fatto: ... / file: ... / verifica: <comando> -> <esito vero> / dubbi: ...
```

**`tools:` decide se scrive.** Togli `edit, write` → diventa di sola lettura.
Un operaio **non** ha `talk_to`: non è una pane. **Non può delegare** (`Agent` e `subagent` restano fuori).

Quelle sopra sono le due uniche **capacità**: chi scrive codice e chi no. Il **nome**, invece, viene dal progetto.

## Modelli

I modelli li sceglie il committente col comando **`/modelli`**, e finiscono nella sezione **«I modelli»** del manuale della casa. **Usa quelli.** Non inventarne altri e non cambiare i livelli di pensiero: sono scelte sue.

Il modello dipende dalla **capacità**, non dal nome dell'agente (i nomi sono quelli del progetto). Di serie: il capo e i referenti su abbonamento Grok, la ricognizione su un modello leggero, e la **revisione su una famiglia diversa** da chi scrive — perché chi scrive non si auto-promuove.

## Compito piccolo (T1)
Un referente (`subagent`, `agent:`, `interactive: true`) lancia un operaio. Mai `Agent` sul capo.

## Chi parla con chi, davvero

`talk_to` / `talk_sessions` / `talk_latest` solo tra **capo e referenti** (pane Herdr). Gli operai non sono peer.

- **capo ↔ referenti** e **referente ↔ referente**: `talk_to`
- **referente → operaio**: il prompt di `Agent` e `steer_subagent`
- **operaio → referente**: il report di `Agent`. Se fermo: `BLOCKED:` nel report
- **operaio → operaio**: non si fa

Il referente **resta in pane** finché non arriva la notifica `Agent`. Chiuderla uccide l'operaio.
`get_subagent_result` senza `wait`. Non richiamare un `talk_to` in attesa.

## Chi decide cosa

Si ferma al primo gradino che risponde:

1. **Cerca in `docs/`** — in `DECISIONI.md` la risposta c'è già quasi sempre. È il motivo per cui esiste.
2. **Guarda il codice** — com'è fatto il resto è come va fatto anche questo.
3. **Chiedi alla squadra** — l'operaio al suo referente, il referente agli altri referenti. Tra loro si risolve, prima di salire.
4. **Decidi tu**, se si cambia dopo a costo quasi zero (colore, spazio, nome interno, ordine dei passaggi, dettaglio di layout). Si fa e basta; se non piace, si cambia. Chi decide scrive una riga in `docs/DECISIONI.md`.
5. **Chiedi al committente** solo se la scelta è sua e sbagliarla costa: soldi, dati, cose che non si disfano, cosa entra nel prodotto, regole di mestiere.

Nel dubbio: se la domanda è «come lo faccio?», decidi tu; se è «lo facciamo?», chiedi.

## Regole di scambio

Chi non sa **non salta il gradino**: sale di uno per volta, e la risposta torna giù per la stessa strada.

```
operaio non sa
  → il SUO referente sa?
      sì → risponde, scrive in docs/DECISIONI.md, e l'operaio riparte
      no → un ALTRO referente sa?
             sì → risponde, scrive in docs/DECISIONI.md, e la risposta torna
                  indietro per la stessa strada: referente → referente → operaio
             no → il capo sa?
                    sì → risponde, scrive in docs/DECISIONI.md, e la risposta scende
                         fino al referente, che fa ripartire l'operaio
                    no → il capo raccoglie TUTTE le domande aperte e fa UN solo
                         messaggio al committente (ask_user_question). La decisione
                         scende per la stessa strada e va in docs/DECISIONI.md
```

Nessuno fa due domande e nessuno salta un gradino. Ogni risposta ricevuta va in `docs/DECISIONI.md` **in una riga**: `domanda → risposta`. Non serve altro. La volta dopo nessuno la richiede.

Se il committente contraddice una cosa già scritta lì, **vince lui**: si cambia e si aggiorna quella riga, senza aggiungerne una seconda.

## Profondità
- **T1** un file → 1 referente che lancia 1 operaio. Mai `Agent` sul capo.
- **T2** un ambito → 1 referente (che assume i suoi operai)
- **T3** più ambiti o rischio → 2-3 referenti + una revisione

Mai più agenti che lavori indipendenti.
