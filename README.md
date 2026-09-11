# pi-software-house

> Trasforma [Pi](https://pi.dev) in una **software house**: un capo che pianifica, referenti per area che coordinano, operai che eseguono. Con i documenti del progetto versionati e regole di codice che valgono ovunque.

Si installa una volta per macchina e vale in **ogni progetto**. Apri Pi, dici in italiano normale cosa vuoi ottenere, e la squadra si organizza da sola.

---

## Indice

- [Cos'è](#cosè)
- [A chi serve](#a-chi-serve)
- [Come funziona](#come-funziona)
- [I comandi](#i-comandi)
- [Il flusso](#il-flusso)
- [Esempi](#esempi)
- [Requisiti](#requisiti)
- [Cosa funziona, per sistema](#cosa-funziona-per-sistema)
- [Installazione](#installazione)
- [Cosa c'è dentro](#cosa-cè-dentro)
- [La casa del software](#la-casa-del-software)
- [I modelli](#i-modelli)
- [La sicurezza](#la-sicurezza)
- [Personalizzare](#personalizzare)
- [Aggiornare](#aggiornare)
- [Limiti, detti chiaramente](#limiti-detti-chiaramente)
- [Crediti](#crediti)
- [Licenza](#licenza)

---

## Cos'è

Pi di suo è un ottimo agente singolo: gli chiedi una cosa, la fa. Con progetti grandi questo si rompe per due motivi: il contesto si riempie di dettagli che non servono più, e nessuno tiene traccia di *cosa* si è deciso e *perché*.

`pi-software-house` risolve entrambi mettendo dentro Pi un'organizzazione a tre livelli e una memoria del progetto su file.

**Il principio:** il capo non legge mai il codice. Legge i documenti e i riassunti. Il codice lo leggono gli operai, in contesti separati. Del loro lavoro torna al capo solo il risultato — non tutto il ragionamento. Così il contesto del capo resta piccolo anche su un progetto grande, e il costo per messaggio non cresce a dismisura.

**Il secondo principio:** il progetto ha memoria. Ogni decisione presa, ogni risposta già data, ogni cosa che si è chiusa resta scritta in `docs/`. La volta dopo nessuno la richiede. Copiando la cartella, il progetto riparte uguale.

## A chi serve

- a chi **non è un programmatore** e costruisce software con l'AI: parli per obiettivi ("risolvi gli errori", "metti in sicurezza", "togli il superfluo") e non devi conoscere né gli id dei task né i nomi dei file
- a chi lavora su **progetti grandi** dove una singola sessione non basta più
- a chi vuole che il proprio agente sia **prudente** fuori dal progetto e libero dentro

## Come funziona

### I tre livelli

| Livello | Dove vive | Chi lo assume | Cosa può fare |
|---|---|---|---|
| **Capo** | la sessione principale | — | pianifica, smista, parla con te. **Non tocca il codice** |
| **Referente** | `.pi/agents/referente-<area>.md` | il capo | legge il codice, decide, **assume operai**, verifica. Non scrive codice, non apre pane |
| **Operaio** | `.agents/agents/operaio-<cosa>.md` | il referente | fa un compito verticale, lo verifica, riporta. **Non può delegare** |

L'organigramma non è un suggerimento: è imposto dai **permessi**. Un referente non ha i permessi per scrivere codice (il gate lo blocca), un operaio non ha il tool per delegare. Non dipende dalla buona volontà del modello.

### Chi parla con chi

Il canale vero è il **bus di squadra** (`.pi/team/`, estensione `team.ts`): un file per messaggio, quattro tipi (`fatto`, `bloccato`, `domanda`, `aggiornamento`). Solo il capo parla con te. Comando `/squadra`: chi fa cosa, bloccati e domande.

**Nessuno interrompe nessuno.** Scrivi nel bus e vai avanti; la risposta arriva nel bus e torna giù per la stessa strada. `talk_to` resta solo per le urgenze tra pane (capo ↔ referenti).

- Il capo → con i **referenti** (bus + `talk_to` se urgente)
- I referenti → con il capo, **tra loro**, e con i **loro** operai (bus; operai corretti con `steer_subagent`)
- Gli operai → solo col **loro** referente via bus. Niente `talk_to` (non sono pane), niente delega. Tra operai non si parla: coordina il referente

I referenti vivono in **pane Herdr**, quindi li vedi lavorare e puoi entrare a parlare con loro. Gli operai lavorano dentro la sessione del referente, senza aprire pane: altrimenti dieci operai significherebbero dieci pane.

### Chi decide cosa

Si ferma al primo gradino che risponde:

| # | Dove guarda | Cosa ci trova |
|---|---|---|
| 1 | `docs/DECISIONI.md`, `PROGETTO.md`, `REGOLE.md`, `ARCHITETTURA.md` | la risposta c'è già quasi sempre: i documenti esistono per questo |
| 2 | il codice | com'è fatto il resto è come va fatto anche questo |
| 3 | la squadra (il bus) | l'operaio al suo referente, il referente agli altri referenti |
| 4 | **decide da solo** | tutto ciò che si cambia dopo a costo quasi zero |
| 5 | il committente | solo se la scelta è sua e sbagliarla costa |

**Cosa decide da solo l'AI:** un colore, uno spazio, un nome interno, l'ordine dei passaggi, quale pezzo già nel progetto riusare, un dettaglio di layout. Non chiede permesso per le cose piccole: fa e, se non piace, si cambia. E scrive una riga in `docs/DECISIONI.md`, così la scelta resta.

**Cosa chiede a te:** soldi, dati, cose che non si disfano, cosa entra nel prodotto e cosa no, regole di mestiere, quello che vedrà l'utente finale. E quando due strade portano a lavori diversi.

Nel dubbio: se la domanda è «come lo faccio?», decide; se è «lo facciamo?», chiede.

### Le regole di scambio

Chi non sa **non salta il gradino**: sale di uno per volta, e la risposta torna giù per la stessa strada.

```
operaio non sa
  → il SUO referente sa?
      sì → risponde, scrive in docs/DECISIONI.md, e l'operaio riparte
      no → un ALTRO referente sa?
             sì → risponde, scrive in docs/DECISIONI.md, e la risposta torna
                  indietro: referente → referente → operaio
             no → il capo sa?
                    sì → risponde, scrive in docs/DECISIONI.md, e la risposta scende
                         fino al referente, che fa ripartire l'operaio
                    no → il capo raccoglie TUTTE le domande aperte e fa UN solo
                         messaggio a te, a opzioni. La tua decisione scende per la
                         stessa strada fino all'operaio, e va in docs/DECISIONI.md
```

Tu vieni interrotto **una volta sola**, con tutte le domande insieme. Ogni risposta entra in `docs/DECISIONI.md`: la volta dopo nessuno la richiede. Se la richiesta è ambigua, il capo usa la skill `grilling` e ti fa le domande a round, ognuna con la risposta che consiglia — e i *fatti* se li va a cercare, non te li chiede.

### Chi aggiorna cosa

| Chi | Tiene aggiornati |
|---|---|
| **Capo** | `docs/STATO.md` (la coda), `docs/DECISIONI.md`, `docs/archivio/`, i file dei **referenti** |
| **Referente** | `docs/STATO.md` (i suoi task), `docs/DECISIONI.md`, `docs/PROGETTO.md`, `docs/ARCHITETTURA.md`, `docs/REGOLE.md`, i file dei **suoi operai** |
| **Operaio** | niente, tranne quello incaricato dei documenti |

### Quanto si scende in campo

Il capo non mobilita la squadra al completo per ogni sciocchezza:

| Livello | Quando | Chi scende in campo |
|---|---|---|
| **T0** | domanda, nessuna modifica | solo il capo, due frasi |
| **T1** | un file, correzione piccola | 1 referente che lancia 1 operaio. Mai `Agent` sul capo |
| **T2** | un'area, pochi file | 1 referente, che prende i suoi operai |
| **T3** | più aree, o rischio su dati/sicurezza | 2-3 referenti, più una revisione finale |

La regola è dura: **mai più agenti che lavori indipendenti.** Se ci sono due lavori separati, due operai — non cinque "per sicurezza".

### La squadra nasce dal progetto

Non c'è nessun elenco fisso di ruoli. Il capo, in un progetto nuovo:

1. crea i documenti in `docs/` — e li riempie **man mano** che il progetto cresce, non tutti subito
2. fa **mappare il progetto** da un esploratore in sola lettura: cartelle, moduli, aree funzionali reali
3. assume un referente **per ogni area reale**, col nome di quell'area (`referente-pagamenti`, non `referente-api`)
4. i referenti assumono i **loro** operai, quando sanno cosa devono fare

Tutto vive dentro il progetto e resta lì: la volta dopo il capo ritrova la squadra già fatta.

### Progetto già avviato: l'allineamento

Se il progetto esiste già, non si rifà: **si allinea**. Alla prima apertura in un progetto che ha i segni di un progetto vero (`.git`, `docs/`, `AGENTS.md`, `package.json`…) ma la cui casa non è come la software house se l'aspetta, Pi te lo chiede una volta. Non basta che i file ci siano: se sono vuoti o sono rimasti gli scheletri coi segnaposto, contano come mancanti — e vengono letti per davvero.

| Scelta | Cosa succede |
|---|---|
| **Sì, solo documenti** | allinea i documenti, il codice resta dov'è |
| **Sì, anche il codice** | dopo i documenti sistema la struttura del codice, un'area alla volta coi test verdi |
| **Non ora** | te lo richiede la prossima volta |
| **No, mai più qui** | se lo ricorda per quel progetto (`~/.pi/agent/pi-software-house/progetti.json`) |

Le regole dell'allineamento:

- **Il codice è la verità.** I file di testo sono accompagnamento: se un documento dice una cosa e il codice ne dice un'altra, si scrive quello che fa il codice.
- **Non si cancella niente.** I file di origine restano dove sono; se il loro contenuto è finito in `docs/`, in cima ci va solo un rimando.
- **`AGENTS.md`** si tiene tutto: si aggiunge in cima il rimando a `docs/`.
- Alla fine un **operaio di revisione** (famiglia diversa) confronta `docs/` col codice.

### Le skill: chi sta in testa e chi a richiesta

| Cosa | Dove sta | Quando entra nel prompt |
|---|---|---|
| Il **manuale** (ruoli, organigramma, tetti) | `manual/casa.md` + `manual/squadra.md`, iniettati dall'estensione | **sempre**, a ogni turno: `casa.md` a tutti, `squadra.md` solo al capo |
| La skill **`progetto`** (scheletri dei documenti, come si spezza) | `skills/progetto/`, iniettata dall'estensione | **sempre** a capo e referenti (gli operai non tengono documenti) |
| Le skill del pacchetto (`crew`, `tdd`, `grilling`…) | `skills/`, dichiarate in `package.json` | solo nome e descrizione: il testo si carica **a richiesta** |
| Le skill del progetto | `.pi/skills/<nome>/SKILL.md` | **a richiesta**, solo in quel progetto |

In Pi una skill **non può** essere "sempre caricata": all'avvio Pi mostra solo nome e descrizione di ognuna, e il testo completo arriva quando serve. Per questo le due cose che devono stare sempre in testa — il manuale e `progetto` — le inietta l'estensione invece di lasciarle come skill normali.

### I comandi

| Comando | Cosa fa |
|---|---|
| `/casa` | stato della software house e configurazione automatica |
| `/modelli` | scegli modello ed effort per ogni ruolo |
| `/allinea` | allinea questo progetto (solo documenti, o anche il codice) |
| `/capo on\|off` | il capo legge il codice (di norma è bloccato) |
| `/safety on\|off` | il gate di sicurezza |
| `/squadra` | stato della squadra: chi fa cosa, bloccati e domande |

## Il flusso

### Dall'apertura al lavoro

```
APRI PI IN UNA CARTELLA
  │
  ├─ la software house è configurata?          (setup.ts)
  │     no ─► chiede una volta, installa i pacchetti e il layout delle pane,
  │           poi dice di riavviare.                              → /casa
  │     sì ─┐
  │         ▼
  ├─ è un progetto?  (.git, AGENTS.md, package.json…)
  │     no ─► nessuna domanda: parli e basta
  │     sì ─┐
  │         ▼
  ├─ in docs/ ci sono i 5 documenti?            (casa.ts)
  │     sì ─► nessuna domanda
  │     no ─► «questo progetto non ha la casa come si deve. Allineo?»
  │           ├─ sì ──────► ALLINEAMENTO  (schema qui sotto)
  │           ├─ non ora ─► lo richiede la prossima volta
  │           └─ mai più ─► non lo richiede più per quel progetto
  │
  ▼
IL PROGETTO È FRA LE MANI DEL CAPO
  │
  ▼
TU PARLI (in italiano normale, per obiettivi)
  │
  ▼
IL CAPO LEGGE docs/STATO.md E docs/DECISIONI.md — non il codice
  │  sceglie quanto scendere in campo:
  │
  ├─ T0  domanda, nessuna modifica ─► risponde lui, due frasi
  ├─ T1  un file ───────────────────► 1 referente (subagent) → 1 operaio (Agent)
  ├─ T2  un'area ───────────────────► 1 referente (subagent, pane Herdr) → suoi operai
  └─ T3  più aree, o rischio ───────► 2-3 referenti → operai + una revisione finale
  │
  ▼
GLI OPERAI LAVORANO, ognuno in un contesto suo
  │  prima: il controllo più piccolo che esiste (test, lint, typecheck)
  │  se non sanno una cosa → BLOCKED al referente (max 3 domande secche)
  │  la domanda sale di UN gradino per volta, la risposta scende per la stessa
  │  strada fino all'operaio che riparte (schema completo qui sotto)
  │  nessuno interrompe nessuno: un messaggio aspetta in coda che l'altro
  │  abbia finito il turno, e chi ha chiesto non richiama
  │
  ▼
IL CAPO CHIUDE IL GIRO
  │  aggiorna docs/STATO.md e docs/DECISIONI.md
  │  quello che si è chiuso → una riga in docs/archivio/AAAA-MM.md
  │
  ▼
TI RISPONDE IN 3 RIGHE: cosa è finito, cosa resta, cosa serve da te
```

### L'allineamento di un progetto già avviato

```
Il capo riceve il compito e NON tocca il codice
  │
  ├─ 1. un ESPLORATORE (Agent, sola lettura) legge il CODICE per intero:
  │       cartelle, moduli, entry point, come si parlano,
  │       i comandi veri dai file di configurazione,
  │       e i .md che trova (come accompagnamento)
  │       → ti riporta le AREE FUNZIONALI REALI con i loro file
  │
  ├─ 2. un REFERENTE per area legge a fondo il codice della sua area
  │       e riempie la sua parte di docs/
  │
  ├─ 3. dove va cosa:  cos'è il prodotto   → PROGETTO.md
  │                    com'è fatto         → ARCHITETTURA.md
  │                    regole e comandi    → REGOLE.md
  │                    decisioni già prese → DECISIONI.md
  │                    coda e blocchi      → STATO.md
  │
  ├─ 4. i file di origine RESTANO dove sono
  │       se il loro contenuto è finito in docs/, in cima ci va solo un rimando
  │
  ├─ 5. AGENTS.md: si tiene tutto, si aggiunge in cima il rimando a docs/
  │
  ├─ 6. un OPERAIO DI REVISIONE (famiglia di modello diversa)
  │       confronta docs/ col codice
  │
  └─ 7. docs/STATO.md aggiornato, allineamento archiviato

In tutto questo il codice non si modifica e non si cancella niente.
```

### Cosa può succedere, e chi lo gestisce

| Cosa succede | Chi se ne accorge | Cosa fa |
|---|---|---|
| La software house non è installata o configurata | `setup.ts`, all'avvio | chiede una volta e sistema da sé; si rifà con `/casa` |
| Il progetto esiste ma la casa è incompleta | `casa.ts`, all'avvio | chiede una volta, poi allinea |
| Il capo prova a leggere il codice | `casa.ts`, sul tool | **blocca** e gli dice di delegare; `/capo off` sblocca |
| Un referente prova a scrivere codice | `safety-gate.ts` | **blocca** |
| Un referente vuole lasciare una procedura che torna | `safety-gate.ts` | `.pi/skills/` è permesso: la scrive lì |
| Un comando di sistema (`sudo`, `mkfs`, `reboot`, pipe-to-shell, publish) | `safety-gate.ts` | chiede il permesso |
| "cancella tutto" (`rm -rf .`, `git reset --hard`) | `safety-gate.ts` | chiede, **anche dentro** il progetto |
| Un comando distruttivo puntato fuori dal progetto | `safety-gate.ts` | chiede |
| Lettura di una chiave o di una cartella di sistema | `safety-gate.ts` | **rifiuta sempre** |
| Lettura di un `.md` (una skill, il manuale, un documento) | nessuno | sempre permessa: non chiede più il permesso |
| Lettura o scrittura fuori dal progetto | `safety-gate.ts` | chiede |
| Un sub-agente avrebbe bisogno di un'autorizzazione | `safety-gate.ts` | non può chiedere a te: riferisce al suo superiore e si ferma |
| Un operaio non sa una cosa | lui stesso | torna `BLOCKED` con al massimo 3 domande secche — non sale di livello da solo |
| Il committente non c'è o non risponde | nessuno | si va avanti su tutto il resto; la domanda resta in `docs/STATO.md`, sezione bloccati |
| Un messaggio arriva a un agente che sta lavorando | `pi-peer` | **resta in coda**: nessuno viene interrotto a metà, il messaggio si consegna quando ha finito il turno |
| Chi ha chiesto non riceve subito risposta | `pi-peer` | la chiamata torna "in attesa" e lo sveglia quando arriva la risposta; non si richiama e non si rispedisce |
| Un referente non sa rispondere all'operaio | `talk_to` | chiede **prima agli altri referenti**, poi al capo; chi risponde lo scrive in `docs/DECISIONI.md` e la risposta torna indietro |
| Nessuno sa rispondere | il capo | raccoglie **tutte** le domande e ne fa **una sola** a te; la tua decisione scende per la stessa strada fino al referente, che fa ripartire l'operaio |
| La richiesta è ambigua | il capo | **prima** guarda in `docs/` e nel codice; se è reversibile decide da solo; solo se è una decisione tua usa la skill `grilling` e te le fa a round, a opzioni |
| Un documento supera le 300 righe | chi lo tiene | si spezza **per area** e si registra in `docs/GLOSSARIO.md` |
| Un file di codice supera le 500 righe | l'operaio che lo tocca | si spezza |
| Una voce di lavoro si chiude | il capo | una riga in `docs/archivio/AAAA-MM.md`, e via da `STATO.md` |
| Un file di agente ha la `description` senza virgolette | **nessuno**: il file viene scartato in silenzio | è la trappola numero uno; dopo aver scritto un agente si controlla che compaia nell'elenco |
| Il progetto ha una skill in `.pi/skills/` | Pi, all'avvio | con `defaultProjectTrust: "always"` si carica sempre |
| Pi ha finito e aspetta te | `notify.ts` | avviso sul desktop |
| Vuoi tornare indietro sul codice | `git-checkpoint.ts` | a ogni turno lascia un punto (git stash); con `/fork` ti offre di riportare il codice lì |
| Vuoi solo pensare, senza che tocchi niente | `plan-mode` | modalità sola lettura: prova prima di agire |

## Esempi

### Un bug in un progetto avviato

```
Tu:    Il login perde la sessione ogni tanto. Sistemalo.

capo   legge docs/STATO.md e docs/DECISIONI.md — non legge il codice
       mappa: il progetto ha tre aree. Il problema è di autenticazione.
       apre referente-autenticazione in una pane

referente-autenticazione
       crea gli operai che servono: uno di ricognizione, sola lettura
       la ricognizione scopre che il token scade dopo un'ora e che il
       rinnovo fallisce in silenzio
       assegna a un operaio di correzione: "il rinnovo non deve morire in silenzio"
       l'operaio trova la causa, corregge, lascia un test che la difende
       un operaio di revisione, su una famiglia di modello diversa,
       controlla il diff — chi scrive non si auto-promuove
       aggiorna docs/STATO.md, scrive le decisioni in docs/DECISIONI.md

capo   → 3 righe a te:
       "Sistemato: il rinnovo del token falliva in silenzio. Lasciato un test.
        Resta una cosa: la scadenza a un'ora è corta. La allunghiamo?"
```

Tu non hai mai nominato un file, un id o un nome di funzione.
Tutto questo è **T2**: un'area sola, quindi un referente.

### Un progetto nuovo, da zero

```
Tu:    Voglio un gestionale per il magazzino. Da zero.

capo   non c'è niente in docs/ → crea il set vuoto con i titoli
       (non legge codice per farlo: non c'è ancora)
       non assume nessuno: non sa ancora che forma avrà il progetto

Tu:    Si parte da articoli e giacenze, poi le fatture.

capo   fa mappare la cartella da un esploratore: è vuota
       scrive lo scheletro del progetto (cartelle per area funzionale)
       assume referente-articoli e referente-giacenze

referente-articoli
       crea i suoi operai e fa il primo pezzo: modello, migrazione, elenco
       aggiorna docs/ARCHITETTURA.md e docs/REGOLE.md con quello che ha scoperto
       il codice è la verità: i documenti raccontano quello che il codice fa

capo   → «Fatto: articoli e giacenze. Manca la fatturazione: la cominciamo?»
```

La squadra **cresce col progetto**: nasce dalle aree vere, non da un elenco preparato.

### Un progetto già avviato: l'allineamento

```
Tu:    Apri Pi in ~/progetti/fibra (esiste da mesi, ha AGENTS.md, ha un po' di docs sparse)

Pi     «Questo progetto non ha la casa come si deve. Allineo?
        mancano: PROGETTO.md, ARCHITETTURA.md, REGOLE.md, DECISIONI.md»

Tu:    Sì, solo documenti.   (oppure: Sì, anche il codice.)

capo   apre un referente per area: i loro operai leggono il CODICE
       e i referenti riempiono docs/ (con "anche il codice", dopo sistemano
       la struttura un'area alla volta, test verdi dopo ogni area)

referenti
       leggono a fondo il codice della loro area
       riempiono docs/: cos'è il prodotto, com'è fatto, regole, decisioni, coda

capo   AGENTS.md: tiene tutto il testo che c'era, aggiunge in cima il rimando a docs/
       i file di testo di origine restano dove sono, con un rimando se assorbiti

operaio-revisione
       confronta docs/ col codice: quello che c'è scritto è quello che il codice fa?

capo   → «Allineato. Spostato tutto in docs/, AGENTS.md intatto, codice non toccato.
        Tre cose non tornavano tra documento e codice: le ho scritte come codice, non
        come documento. Le trovi in docs/STATO.md.»
```

Mai più di una domanda: se dici "non ora", te lo richiede la prossima volta; se dici
"mai più", se lo ricorda per quel progetto e non lo chiede più (comando `/allinea`
quando lo vuoi).

## Requisiti

| Cosa | Serve per | Note |
|---|---|---|
| [Pi](https://pi.dev) | tutto | testato con la 0.85 |
| **Node.js >= 22.19** | Pi e tutti i pacchetti | è il requisito di Pi stesso |
| [Herdr](https://herdr.dev) | le pane dei referenti | **facoltativo**: senza, capo e operai funzionano lo stesso |
| `git` | l'installazione da GitHub | |

Serve inoltre **almeno un provider autenticato in Pi** (`/login`). Di serie il manuale è tarato sull'abbonamento Grok: vedi [I modelli](#i-modelli) per cambiarlo.

## Cosa funziona, per sistema

| | Linux | macOS | Windows |
|---|---|---|---|
| Capo, referenti, operai | sì | sì | sì |
| Referenti in pane Herdr | sì | sì | sì (ConPTY) |
| Operai (senza pane) | sì | sì | sì |
| Documenti, skill, prompt | sì | sì | sì |
| Configurazione automatica `/casa` | sì | sì | sì |
| Gate di sicurezza | bash | bash | PowerShell e cmd |
| Script di configurazione | `setup/installa.sh` | `setup/installa.sh` | `setup/installa.ps1` |
| `herdr terminal attach` | sì | sì | **no** |
| Windows come destinazione di `herdr --remote` | — | — | **no** |
| Passaggio di consegne a caldo (*live handoff*) | sì | sì | **no** |
| Gruppi di processi Unix | sì | sì | **no** |
| Clipboard immagini nelle pane locali | sì | sì | **no** |
| Plugin di Herdr | sì | sì | preview |

Le righe con **no** sono capacità di Herdr che **questa squadra non usa**. Quello che ci serve davvero — pane dei referenti, riconoscimento degli agenti, pane che si aprono nella cartella giusta, sessioni che sopravvivono alla chiusura del terminale — c'è su tutti e tre.

Su Windows ARM64 gira il binario x86_64 in emulazione.

## Installazione

### 1. Il pacchetto — tutti i sistemi

```bash
pi install git:github.com/mromano1398/pi-software-house
```

### 2. Herdr — le pane dei referenti

**Linux e macOS**

```bash
curl -fsSL https://herdr.dev/install.sh | sh
```

**Windows**, da PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"
```

Se la sicurezza aziendale blocca quel comando, nella [documentazione di Herdr](https://herdr.dev/docs/install/) c'è la variante da Prompt dei comandi con `curl.exe`.

> Senza Herdr funziona tutto tranne le pane: capo e operai lavorano, i referenti no.

### 3. Il resto, da solo

Apri Pi. **Alla prima apertura chiede una volta sola:**

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

Se dici no, non lo richiede più. Per farlo dopo: comando **`/casa`**.

### 4. Su una macchina senza interfaccia

**Linux e macOS**

```bash
bash setup/installa.sh
```

**Windows**

```powershell
powershell -ExecutionPolicy Bypass -File .\setup\installa.ps1
```

### 5. Disinstallare

```bash
pi remove git:github.com/mromano1398/pi-software-house
```

I sei pacchetti restano: se non li vuoi più, `pi remove` ognuno, oppure `pi list`.

## Cosa c'è dentro

```
pi-software-house/
├── manual/
│   ├── casa.md              le regole per tutti: documenti, struttura, codice (a tutti)
│   └── squadra.md           il capo e la squadra (solo al capo)
├── extensions/
│   ├── casa.ts               inietta il manuale e le skill del capo, /modelli, /allinea, /capo
│   ├── setup.ts              configura tutto alla prima apertura (/casa)
│   ├── safety-gate.ts        il gate: libertà dentro, prudenza fuori
│   ├── team.ts               il bus di squadra: capo, referenti e operai parlano qui (/squadra)
│   ├── notify.ts             avviso sul desktop quando ha finito (solo dal capo)
│   ├── git-checkpoint.ts     checkpoint su disco per tornare indietro col codice
│   └── plan-mode/            modalità sola lettura per pensare prima di agire
├── skills/
│   ├── crew/                 come si assume un referente e un operaio
│   ├── progetto/             come si apre e si tiene la casa del software
│   ├── secure-change/        cosa controllare prima di toccare auth, SQL, segreti
│   ├── tdd/                  test prima, poi il codice minimo
│   ├── grilling/             domande a round quando la richiesta è ambigua
│   └── diagnosing-bugs/      disciplina per i bug difficili
├── prompts/                  /implement /review /test /commit /explore
├── test/                     i test: capo, bus di squadra, gate, allineamento, checkpoint (`bun test`)
└── setup/                    gli script di configurazione per Linux/macOS e Windows
```

**Perché il manuale è un'estensione e non un `AGENTS.md`:** un pi package non può installare un file di contesto globale. L'estensione lo inietta a ogni turno, in modo deterministico — non dipende dal fatto che il modello decida di leggere una skill. Il testo è identico a ogni turno, quindi resta in cache. A un referente arriva solo la parte "regole per tutti": il ruolo glielo dà il suo file.

## La casa del software

Ogni progetto tiene la sua memoria in `docs/`, e **si versiona**: copiando la cartella il progetto riparte uguale.

```
docs/
  PROGETTO.md      cos'è il prodotto, stack, comandi veri, convenzioni
  ARCHITETTURA.md  i moduli, chi fa cosa, come si parlano
  REGOLE.md        le regole di codice di questo progetto
  STATO.md         obiettivi, coda, task in corso, blocchi  (solo cose aperte)
  DECISIONI.md     domanda → risposta, una riga per voce, diviso per categoria
  GLOSSARIO.md     vocabolario e indice, quando un documento viene spezzato
  archivio/        il lavoro finito, una riga per voce
```

**Tetti:** 300 righe per documento, 500 righe per file di codice. Oltre, si spezza — e un documento spezzato registra in `docs/GLOSSARIO.md` cosa sta dove.

**Ogni documento nasce con le sue sezioni**, e quelle sezioni sono le **categorie** su cui un giorno si spezzerà. Si divide per categoria, mai a metà: `ARCHITETTURA.md` → `ARCHITETTURA-pagamenti.md`, `DECISIONI.md` → `DECISIONI-ui.md` e `DECISIONI-dati.md`, `REGOLE.md` → `REGOLE-frontend.md`. Le categorie di un progetto sono di norma le stesse aree: così i pezzi si ritrovano a colpo d'occhio.

**L'unico documento piatto è l'archivio**: una riga per voce, in ordine di tempo, niente sezioni. È il registro di quello che si è fatto — non si legge quasi mai, si scorre.

**L'archivio è il pezzo che tiene corti gli altri:** `docs/STATO.md` contiene solo cose aperte. Appena una voce si chiude va in `docs/archivio/` come una riga. Così il file che si legge più spesso non cresce mai.

**`docs/DECISIONI.md` è minimale**: una riga per voce, `domanda → risposta`. Nient'altro — non serve il *perché*, non serve la data. Se la stessa cosa viene decisa di nuovo, si **aggiorna la riga**, non se ne aggiunge una seconda.

**Il committente vince sempre**, anche su una decisione già presa e già scritta lì: se dice di cambiare, si cambia e la riga si aggiorna. Vale per tutti — capo, referenti e operai.

### Le regole di codice

Valgono in ogni progetto e le hanno tutti, capo compreso:

1. **Correggi la causa, non il sintomo** — cerca tutti i chiamanti della funzione che tocchi, sistema il punto da cui passano tutti
2. **Ogni correzione lascia un test** che fallisce se il bug torna
3. **Sicuro di default** — valida l'input non fidato al confine, mai stringhe costruite con dati dell'utente, niente segreti nel codice né nei log
4. **Niente valori hardcoded e niente logica inline** — un valore che conta diventa una costante con un nome, in un posto solo
5. **Pezzi richiamabili, non codice usa-e-getta** — se la stessa cosa compare due volte diventa una funzione con un nome. Alla **seconda** volta, non prima: niente astrazioni preventive
6. **Ottimizzato dove si vede** — niente letture ripetute, query dentro un ciclo, ricalcoli inutili. Si ottimizza quello che si misura
7. **Diff minimo** — niente refactor non richiesti, niente dipendenze nuove
8. **Non dichiarare finito** senza aver fatto girare il controllo

### Regole di struttura

- Un file = una responsabilità. Codice: massimo 500 righe
- Cartelle **per area funzionale** (`src/pagamenti/`), non per tipo di file
- Niente file `utils` generici
- Il test sta accanto alla cosa che verifica
- Documenti e agenti in italiano; **identificatori di codice nella convenzione dello stack**
- Un file che sfonda il tetto si spezza o si archivia, mai si allunga

## I modelli

**Non si editano a mano: si scelgono col comando `/modelli` dentro Pi.**

```
/modelli
  ti mostra i modelli in uso, ruolo per ruolo
  → scegli il ruolo
  → scegli il provider   (solo quelli per cui hai l'accesso)
  → scegli il modello    (con filtro, se sono tanti)
  → scegli il livello di pensiero
```

Se il ruolo che cambi è il **capo**, ti chiede anche se applicarlo subito a questa sessione e se renderlo il predefinito per le sessioni nuove.

La scelta finisce in `~/.pi/agent/pi-software-house/modelli.json` ed è l'**unica fonte**: il manuale che il capo riceve viene compilato con quei valori, quindi i referenti e gli operai che assume nascono già col modello giusto. Non c'è niente da tenere allineato a mano.

Di serie:

| Ruolo | Modello | Pensiero | Perché |
|---|---|---|---|
| Capo | `xai/grok-4.6` | medium | pianifica e smista, non legge codice |
| Referenti | `xai/grok-4.6` | xhigh | decisioni di merito |
| Operai che scrivono | `xai/grok-4.6` | medium | |
| Operai di ricognizione | `xai/grok-4.3` | low | alto volume, compito semplice |
| Operai che tengono i documenti | `xai/grok-4.3` | low | |
| Revisione | `openai-codex/gpt-5.5` | medium | **famiglia diversa** da chi scrive: chi scrive non si auto-promuove |

La revisione sta su OpenAI apposta, ed è a volume basso: non consuma il piano piccolo. Ripiego a pagamento, se serve: `openrouter/deepseek/deepseek-v4-flash`.

Se preferisci editare il file a mano, `modelli.json` è leggibile: una voce per ruolo, con `model` e `thinking`.

## La sicurezza

### Cosa fa il gate

Dentro la cartella del progetto sei **libero**: crea, modifica, cancella, git, script. Non ti chiede niente.

Si ferma e chiede **solo** per:

| Cosa | Esempio |
|---|---|
| comandi di sistema | `sudo`, `mkfs`, `dd` su disco, `reboot`, pipe-to-shell, `npm publish`, `docker prune` |
| comandi distruttivi **fuori** dal progetto | `rm -rf /altrove` |
| "cancella tutto" **anche dentro** | `rm -rf .`, `git reset --hard`, `git clean -fdx` |
| leggere o scrivere **fuori** dal progetto | `~/.config/qualcosa` |
| force-push su `main` | |

Su Windows vale lo stesso per PowerShell e cmd: `Remove-Item -Recurse -Force .`, `del /s /q`, `rmdir /s /q`, `Format-Volume`, `diskpart`, `iwr … | iex`, `Set-ExecutionPolicy`, `Stop-Computer`. Sono protette anche `%SystemRoot%`, `Program Files`, `ProgramData`.

**Segreti e chiavi: rifiutati sempre**, in lettura e in scrittura — chiavi SSH e GPG, `auth.json`, `credentials`, `.netrc`, `.pgpass`, `*.pem`, `*.p12`, `*.key`, `.env` e le sue varianti. Fanno eccezione i **modelli di esempio** (`.env.example`, `.env.sample`, `.env.dist`, `.env.template`) e le chiavi **pubbliche** (`.pub`): quelli passano.

### Cosa non fa

- **Non è una sandbox.** Gli agenti girano con i tuoi permessi. Il gate è una rete contro gli errori, non un confine di sicurezza: per quello serve un container o una macchina virtuale.
- **Un sub-agente non ti interroga mai.** Se gli serve un'autorizzazione fuori dal progetto viene bloccato e lo riferisce al suo superiore. Le domande a te le fa solo il capo, e tutte insieme.
- `/safety off` disattiva il gate per la sessione corrente, se ti serve muoverti veloce.

## Personalizzare

| Cosa vuoi cambiare | Dove |
|---|---|
| Le regole, i ruoli, i tetti di righe | `manual/casa.md` |
| Le regole dei template degli agenti | `manual/casa.md`, sezione finale |
| I modelli LLM | comando **`/modelli`** (scrive `~/.pi/agent/pi-software-house/modelli.json`) |
| Il comportamento di un ruolo | il suo file in `.pi/agents/` o `.agents/agents/` |
| Il layout delle pane | `extensions/setup.ts`, costante `PANE_CONFIG` |
| Le regole del gate | `extensions/safety-gate.ts` |
| Il testo dell'allineamento | `extensions/casa.ts`, costante `TESTO_ALLINEAMENTO` |

I test: `bun test` dentro `~/pi-software-house`.

Una modifica si vede subito dopo **`/reload`** dentro Pi.

Se hai installato da GitHub e vuoi svilupparlo: installa da **percorso locale** invece che dall'URL. Modifichi, fai `/reload`, e vedi subito — il push serve agli altri PC.

## Aggiornare

```bash
pi update --extensions    # aggiorna i pacchetti installati
cd ~/pi-software-house && git pull     # aggiorna questo pacchetto, se da repo
```

Poi `/reload` dentro Pi. Se aggiorni `pi-herdr-agents`, rilancia `/casa`: riscrive il layout delle pane, che quel pacchetto tiene dentro la propria cartella.

## Limiti, detti chiaramente

- **Si consuma più contesto di una sessione singola.** Ogni operaio rilegge il proprio pezzo di progetto. In compenso il capo non cresce mai. Su un lavoro da dieci minuti, la squadra è più cara che farla da soli — per questo esiste il livello T1, che manda un solo operaio.
- **Il parallelo risparmia tempo, non token.** Due operai in parallelo costano come due operai in serie. Si fa per la velocità, non per il risparmio.
- **La collaborazione è a giro, non dal vivo.** Il capo e i referenti si parlano in tempo reale (`pi-peer`); un operaio invece non può chattare: se non sa qualcosa torna indietro con la domanda, e il suo referente risponde al giro dopo.
- **Due livelli e stop.** Capo → referente → operaio. Oltre, il costo si moltiplica e quando qualcosa si rompe vedi solo una riga d'errore.
- **Anche gli esperti sbagliano.** Il capo è un buon orchestratore, non un oracolo: se una decisione è importante, la conferma te la chiede.
- **GDPR e conformità non sono garantite da nessun LLM.** Questo pacchetto ti dà una checklist, un gate e la memoria delle decisioni. La firma resta tua.
- **Le skill di progetto sono dietro il "trust".** Pi carica `.pi/skills/` solo se la cartella del progetto è considerata fidata: con `defaultProjectTrust: "ask"` te lo chiede una volta e se lo ricorda; se rispondi no, quelle skill spariscono **in silenzio**. Gli agenti in `.pi/agents/` e `.agents/agents/` invece no: quelli funzionano sempre.

## Crediti

Questo pacchetto non esisterebbe senza il lavoro di altri. Tutti MIT:

| Pacchetto | Autore | Cosa dà |
|---|---|---|
| [`pi-herdr-agents`](https://www.npmjs.com/package/pi-herdr-agents) | giuseppecrj | i referenti in pane Herdr |
| [`@tintinweb/pi-subagents`](https://www.npmjs.com/package/@tintinweb/pi-subagents) | tintinweb | gli operai, con steering e resume |
| [`pi-peer`](https://www.npmjs.com/package/pi-peer) | MinhDuyDEV | i referenti che si parlano e parlano col capo |
| [`@dietrichgebert/ponytail`](https://github.com/DietrichGebert/ponytail) | Dietrich Gebert | la disciplina "scrivi meno codice" |
| [`@juicesharp/rpiv-ask-user-question`](https://www.npmjs.com/package/@juicesharp/rpiv-ask-user-question) | juicesharp | le domande a opzioni |
| [`pi-cache-guardian`](https://www.npmjs.com/package/pi-cache-guardian) | icefairy | meno token, grazie alla cache |

Le skill `grilling` e `diagnosing-bugs` derivano da [mattpocock/skills](https://github.com/mattpocock/skills).

[Pi](https://pi.dev) è di [Mario Zechner](https://mariozechner.at/). [Herdr](https://herdr.dev) è il runtime su cui girano le pane.

## Licenza

[MIT](LICENSE) — © 2026 Mirko Romano
