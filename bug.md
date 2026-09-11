# Bug — pi-software-house

> Stato 2026-09-11: `bun test` 36 pass. Risolti tutti i bug tranne 3 accettati in fondo. In breve: gate senza bypass (wipe/force-push/pipe-sudo/redirect/`../`/docker-prune/find/git-clean/shell extra/redirect referente/chiavi per percorso/`credentials.md`), checkpoint su disco con errori riportati, notifica solo dal capo e senza crash, gerarchia spawn+domande applicata, allineamento preciso (niente prompt per sole `docs/`, niente scheletro per 2 righe vere, setup prima dei documenti), plan-mode sicura a pezzi e coi numeri originali, setup con versioni/scadenza/bun. Verificato non-bug: 22 (capo legge tutto), 57 (plan conserva gli strumenti). Accettati: 7 (doppio invio se l'API tira eccezione dopo aver recapitato: non rilevabile dal client), 54 (scrivere in DECISIONI e' comportamento del modello, coperto dal prompt), 55 (sessione non-interattiva bloccata sui gate: default sicuro voluto).

## extensions/casa.ts
1. `tool_call` legge solo `input.path`: `read` con `file_path` bypassa il blocco lettura del capo.
2. Check Windows rotto: `abs.startsWith(base + "/")` usa `/` invece di `path.sep` — su Windows il blocco non funziona.
3. `sostituisci` non gestisce `{{ capo.model }}` con spazi; `{{ruolo.sconosciuto}}` resta nel system prompt.
4. `leggiFileManuale`/`leggiSkill` falliscono in silenzio: senza `casa.md`/`squadra.md`/skill il capo gira senza istruzioni, nessun avviso.
5. `documentoVuoto`: 2 righe vere = marcato scheletro (falso positivo); tabella di soli header = "scritto" (falso negativo).
6. `eProgetto`: basta `docs/` vuota o `.git` vuoto per far scattare la richiesta di allineamento.
7. `invia` doppio invio se il primo `sendUserMessage` riesce ma tira eccezione dopo.
8. `/modelli`: `lista.slice(0, 200)` taglia modelli oltre i 200 senza dirlo.
9. `/modelli` capo: `split("/")` rompe nomi con più `/`; se `find` fallisce salva la config ma la sessione resta al vecchio modello.
10. `session_start`: cerca tool `Agent` case-sensitive; con `subagent`/`agent:` non chiede mai l'allineamento.
11. `package.json` letto in sync a ogni `tool_call`/`before_agent_start`; se il JSON è rotto salta il bypass "questo pacchetto".

## extensions/safety-gate.ts
12. `externalTargets` vede solo assoluti/`~/`: `rm -rf ../fuori`, `--output=../fuori` non rilevati.
13. `WIPE_ALL` richiede fine-riga: `rm -rf . && echo ok`, `rm -rf ./build` non matchano.
14. `git push origin main --force` (flag dopo il branch) bypassa il blocco; `develop`/`production` non coperti.
15. `docker prune` copre solo `prune`/`system prune`: `image/container/volume/network prune -a` passano.
16. `DESTRUCTIVE_CMD` non vede `>>`, `2>`, `&>`.
17. `pipe to shell` max 300 char e solo `curl|wget|fetch | sh`: `| sudo sh`, `| bash -s` passano.
18. Solo `bash`/`powershell` filtrate: `sh`, `zsh`, `pwsh`, `cmd` libere.
19. Write-check solo `write`/`edit`: il referente scrive codice via `bash` (heredoc).
20. `isSecretPath` su basename: `credentials`/`auth.json` dentro `docs/` bloccati (falso positivo).
21. Eccezione `.md` + chiave `ask` per directory (`read-outside:dirname`) allarga il permesso a tutta la dir per la sessione.
22. `REFERENT_WRITABLE` (`.agents/agents`) ≠ `CARTELLE_DEL_CAPO` (`.pi/agents`): scritto vs leggibile non coincidono.
23. `git clean -f` da solo scatta come `-fdx` (falso positivo); `find docs … -delete` dentro il progetto chiede conferma.

## extensions/git-checkpoint.ts
24. `stash create` a ogni `turn_start`, anche senza modifiche e fuori da un repo (spreco + errore ignorato).
25. `currentEntryId` da ogni `tool_result`: checkpoint del turno N salvato sotto l'id del turno N-1 (off-by-one).
26. `checkpoints.clear()` su `agent_settled` + mappa solo in memoria: dopo la run / al restart il fork non ripristina più.
27. `stash apply` senza gestione errori/conflitti, notifica sempre "restored"; dangling commit mai puliti.

## extensions/notify.ts
28. `require("child_process")` in modulo ESM: su Windows (`WT_SESSION`) crasha.
29. Titolo/body interpolati in PS con `'`: apostrofi = script rotto / injection.
30. OSC777/OSC99 senza escape (`;`, ESC, newline); `i=1` fisso sovrascrive; `d=0` non chiude mai su Kitty.
31. Scatta a ogni `agent_settled` anche per sub-agenti/background senza UI (spam).

## extensions/setup.ts (+ setup/filtro.mjs)
32. Path pane hardcodato `npm/node_modules/pi-herdr-agents/config.json`: con install non-npm è sempre "da sistemare" e `scriviPaneConfig` esce in silenzio → loop `/casa`.
33. `scriviFiltro`/`scriviPaneConfig` senza try/catch: settings corrotto o EACCES = crash.
34. `configura` verifica `stato()` nello stesso processo: serve restart, dice sempre "incompleta" anche se ok.
35. `comandoPi` non vede `.ts`/bun, ripiega su `pi` che può non esistere nel PATH.
36. `mancanti` su stringhe esatte: `npm:pi-herdr-agents@1.2.3` risulta sempre mancante.
37. `SKIP_FILE` per sempre: un "no" una volta = mai più chiesto, anche per pacchetti nuovi.
38. Doppio prompt allo startup: `setup.ts` + `casa.ts` chiedono entrambi senza coordinarsi.

## extensions/plan-mode
39. `curl … | sh` è SAFE (`curl`) e non è in DESTRUCTIVE → RCE in plan-mode; `env`/`printenv` consentiti.
40. `cd src && ls` bloccato pur se read-only; `ls; rm -rf .` valutato solo sull'inizio.
41. `cleanStepText` cambia il senso (`Delete cache` → `cache`) e tronca a 50 char.
42. `extractTodoItems` vuole `Plan:` + `1.`/`1)`: checklist `- [ ]`, `Step 1:`, code-fence = zero todo in silenzio; rinumera da 1, `[DONE:n]` non corrispondono.
43. `markCompletedSteps` conta i tag, non gli item; `[DONE:99]` conta come progresso.
44. `/plan` azzera i todo a ogni toggle, senza conferma.
45. `agent_end`: `sendMessage` non awaited + due followUp in ordine non garantito; select chiuso = resta in plan-mode muto.
46. `context` cancella qualsiasi testo utente con `[PLAN MODE ACTIVE]`, anche legittimo.
47. Resume con `executeIndex = -1`: riapplica `[DONE:n]` di piani vecchi ai todo nuovi.

## Bug di flusso (cosa dovrebbe fare vs cosa fa)

Flusso atteso (da `docs/`, `manual/casa.md`, `manual/squadra.md`, `ARCHITETTURA.md`):
committente → capo (sessione principale) → referenti via `subagent` (`agent:`, `interactive:true`, pane resta aperta) → operai via `Agent` (nested, niente pane/talk) → report via notifica `Agent` / `steer_subagent` → referente aggiorna `docs/` → risposta al capo via `talk_to` (solo da idle). In più: setup `/casa` una volta, allineamento `/allinea` una volta, capo mai sul codice, decisioni in `DECISIONI.md` salendo di un gradino alla volta.

48. Gerarchia non applicata: il manuale vieta `Agent` sul capo e pane agli operai/referenti, ma nessun gate blocca `Agent` al capo, `subagent` al referente, o `talk_to` all'operaio — la regola è solo testo nel prompt.
49. Allineamento contraddittorio: `TESTO_ALLINEAMENTO` ordina al capo "manda un esploratore (`Agent`, general-purpose)" mentre `squadra.md` dice "tu non lanci `Agent`, mai `Agent` sul capo" — seguendo l'allineamento il capo viola la sua regola n.1.
50. Check tool sbagliato: `session_start` allineamento verifica `Agent`, ma per aprire referenti serve `subagent` — chiede quando non può spawnare, o salta quando potrebbe.
51. Pane senza guardian: "non chiudere la pane finché non arriva la notifica `Agent`" non è monitorato — chiusa la pane, operaio ucciso + `checkpoints.clear()` = lavoro e codice persi senza recovery.
52. Checkpoint nel processo sbagliato: `stash create/apply` gira solo nel cwd del capo — il lavoro di referenti (pane separate) e operai non è mai checkpointato, il restore dal fork ripristina solo metà.
53. `talk_to` solo-da-idle non gestito: `squadra.md` dice "resta in coda, non richiamare", ma nessun codice gestisce `pending`/timeout/retry — se il peer è morto (`pane morta → peer morto`, cfr `ARCHITETTURA.md`) la chiamata fallisce e la risposta non scende mai, la catena operaio→referente→capo si ferma in silenzio.
54. Decisioni non tracciate: "ogni risposta in `DECISIONI.md`, una riga, sali di un gradino" è solo testo — nessuno scrive/verifica, i modelli possono saltare gradini e chiedere al committente direkt.
55. `eCapo` fragile in non-UI: sessione principale con `--print`/CI (`hasUI=false`) è classificata operaio — niente istruzioni capo, niente allineamento — e `safety-gate.ask` blocca tutto senza possibilità di approvare (deadlock automazione).
56. Operaio scrive nei documenti: il gate blocca le write del referente fuori da `docs/`, ma l'operaio (nested, spesso senza `PI_SUBAGENT_NAME`) non è limitato — scrive in `docs/` scavalcando la verifica del referente, contro "operaio: niente documenti".
57. `/plan` rompe la squadra: il restore `getNormalModeTools` = `read,bash,edit,write` + resto-meno-gestiti perde `subagent`/`talk_to`/`Agent` installati dai pacchetti — dopo un ciclo plan il capo non può più spawnare né parlare alla squadra.
58. Ordine startup indefinito: `setup.ts:on(session_start)` (installa+riavvia) e `casa.ts:on(session_start)` (allinea) scattano nello stesso avvio senza coordinamento — doppio prompt e allineamento chiesto prima che gli strumenti esistano.
59. Notify prematura: `agent_settled` notifica "Ready for input" anche quando il referente sta ancora aspettando la notifica `Agent` dell'operaio — il committente crede finito mentre la squadra è a metà.
