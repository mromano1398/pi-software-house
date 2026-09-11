/**
 * La casa del software.
 *
 * 1. Inietta il manuale (manual/casa.md) nel system prompt a ogni turno, con i
 *    modelli configurati al posto dei segnaposto.
 * 2. Comando /modelli: scegliere i modelli LLM per ruolo, senza editare file.
 *
 * Perche' un'estensione e non un AGENTS.md: un pi package non puo' installare
 * un file di contesto globale. L'estensione invece lo fa sempre, in modo
 * deterministico, senza dipendere dal fatto che il modello decida di leggere
 * una skill. Il testo e' identico a ogni turno, quindi resta in cache.
 *
 * A un sub-agente (referente) arriva solo la parte "regole per tutti": il
 * ruolo glielo da' il suo file.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const MARKER = "# Se sei la SESSIONE PRINCIPALE";

/** Le skill che il capo e i referenti devono avere gia' in testa. */
const SKILL_DEL_CAPO = ["progetto"];

/** Il capo non legge il codice: quello lo fanno gli operai. */
const TOOL_DI_LETTURA = new Set(["read", "grep", "find", "ls"]);
const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT_DIR = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const CONFIG_FILE = join(AGENT_DIR, "pi-software-house", "modelli.json");
const SETTINGS = join(AGENT_DIR, "settings.json");

// ---------------------------------------------------------------- i ruoli

interface Scelta {
	model: string;
	thinking: string;
}

interface Ruolo {
	chiave: string;
	etichetta: string;
	predefinito: Scelta;
}

const RUOLI: Ruolo[] = [
	{
		chiave: "capo",
		etichetta: "Capo (la sessione principale)",
		predefinito: { model: "xai/grok-4.6", thinking: "high" },
	},
	{
		chiave: "referente",
		etichetta: "Referente (coordina un'area)",
		predefinito: { model: "xai/grok-4.6", thinking: "xhigh" },
	},
	{
		chiave: "operaio",
		etichetta: "Operaio che scrive codice",
		predefinito: { model: "xai/grok-4.6", thinking: "medium" },
	},
	{
		chiave: "ricognizione",
		etichetta: "Operaio di ricognizione (sola lettura)",
		predefinito: { model: "xai/grok-4.3", thinking: "low" },
	},
	{
		chiave: "documenti",
		etichetta: "Operaio che tiene i documenti",
		predefinito: { model: "xai/grok-4.3", thinking: "low" },
	},
	{
		chiave: "revisione",
		etichetta: "Operaio di revisione (sola lettura)",
		predefinito: { model: "openai-codex/gpt-5.5", thinking: "medium" },
	},
];

const LIVELLI = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

// ------------------------------------------------------- configurazione

function leggiConfig(): Record<string, Scelta> {
	const out: Record<string, Scelta> = {};
	for (const r of RUOLI) out[r.chiave] = { ...r.predefinito };
	try {
		if (!existsSync(CONFIG_FILE)) return out;
		const salvato = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
		for (const r of RUOLI) {
			const v = salvato?.[r.chiave];
			if (v && typeof v.model === "string" && typeof v.thinking === "string") {
				out[r.chiave] = { model: v.model, thinking: v.thinking };
			}
		}
	} catch {
		// configurazione illeggibile: si torna ai valori di serie
	}
	return out;
}

function scriviConfig(cfg: Record<string, Scelta>): void {
	mkdirSync(dirname(CONFIG_FILE), { recursive: true });
	writeFileSync(CONFIG_FILE, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

/** Sostituisce i segnaposto {{ruolo.campo}} nel manuale. */
function sostituisci(testo: string, cfg: Record<string, Scelta>): string {
	return testo.replace(/\{\{\s*([a-z]+)\.(model|thinking)\s*\}\}/g, (intero, chiave, campo) => {
		const scelta = cfg[chiave];
		return scelta ? scelta[campo] : intero;
	});
}

// --------------------------------------------------------------- manuale

function leggiFileManuale(nome: string): string | null {
	for (const base of [join(HERE, "..", "manual"), join(HERE, "..", "..", "manual")]) {
		try {
			return readFileSync(join(base, nome), "utf8");
		} catch {
			// prova il prossimo percorso
		}
	}
	return null;
}

/** Il corpo delle skill del capo, senza il frontmatter. Una sola fonte: i file. */
function leggiSkill(nomi: string[]): string {
	const pezzi: string[] = [];
	for (const nome of nomi) {
		for (const p of [
			join(HERE, "..", "skills", nome, "SKILL.md"),
			join(HERE, "..", "..", "skills", nome, "SKILL.md"),
		]) {
			try {
				pezzi.push(readFileSync(p, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").trim());
				break;
			} catch {
				// prova il prossimo percorso
			}
		}
	}
	return pezzi.join("\n\n---\n\n");
}

// ------------------------------------------------- il capo non legge il codice

/** Percorsi che il capo puo' leggere anche se non sono markdown. */
const CARTELLE_DEL_CAPO = ["docs", join(".pi", "agents"), join(".agents", "agents")];

function eCasa(cwd: string): boolean {
	return existsSync(join(cwd, "docs"));
}

/**
 * Il capo e' l'unica sessione vera. Un referente gira in una pane: ha
 * l'interfaccia ma porta il suo nome. Un operaio gira dentro questo stesso
 * processo, senza interfaccia e in modalita' "print": per questo non si puo'
 * distinguere dall'ambiente, che e' identico a quello del capo.
 */
function eCapo(ctx: { hasUI?: boolean; mode?: string } | undefined): boolean {
	if (process.env.PI_SUBAGENT_NAME) return false;
	return Boolean(ctx?.hasUI) && ctx?.mode !== "print";
}

/** Questo repo è il prodotto: niente squadra, niente blocco lettura. */
const NOME_PACCHETTO = new Map<string, string | null>();
function eQuestoPacchetto(cwd: string): boolean {
	let nome = NOME_PACCHETTO.get(cwd);
	if (nome === undefined) {
		try {
			nome = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"))?.name ?? null;
		} catch {
			nome = null;
		}
		NOME_PACCHETTO.set(cwd, nome);
	}
	return nome === "pi-software-house";
}

function percorsoLeggibile(abs: string, cwd: string): boolean {
	if (/\.md$/i.test(abs)) return true;
	return CARTELLE_DEL_CAPO.some((rel) => {
		const base = resolve(cwd, rel);
		return abs === base || abs.startsWith(base + sep);
	});
}

// --------------------------------------- allineare un progetto gia' avviato

/** Dove si ricorda chi ha detto "non chiedere piu" per un progetto. */
const PROGETTI = join(AGENT_DIR, "pi-software-house", "progetti.json");

/** I file che dicono "qui c'e' un progetto": serve per non chiederlo in una cartella qualsiasi. */
const SEGNALI_PROGETTO = [
	".git",
	"AGENTS.md",
	"CLAUDE.md",
	"package.json",
	"pyproject.toml",
	"requirements.txt",
	"manage.py",
	"go.mod",
	"Cargo.toml",
	"pom.xml",
	"composer.json",
	"Gemfile",
];

function eProgetto(dir: string): boolean {
	return SEGNALI_PROGETTO.some((f) => existsSync(join(dir, f)));
}

/** I documenti che la software house pretende in `docs/`. */
const DOCUMENTI = ["PROGETTO.md", "ARCHITETTURA.md", "REGOLE.md", "STATO.md", "DECISIONI.md"];

/** Vero se il documento c'e' ma e' rimasto lo scheletro: vuoto o coi segnaposto dentro. */
function documentoVuoto(percorso: string): boolean {
	let testo: string;
	try {
		testo = readFileSync(percorso, "utf8");
	} catch {
		return true;
	}
	const haSegnaposto = /<[^>\n]{2,}>/.test(testo);
	const senzaSegnaposto = testo.replace(/<[^>\n]{2,}>/g, "");
	const righe = senzaSegnaposto.split("\n").filter((r) => {
		const s = r.trim();
		return s !== "" && !s.startsWith("#") && !/^[-|:\s]+$/.test(s);
	});
	if (haSegnaposto && righe.length < 10) return true;
	return righe.length < 2;
}

/** Cosa manca o non e' stato ancora scritto per davvero, in `docs/`. */
function documentiDaSistemare(dir: string): string[] {
	const fuori: string[] = [];
	for (const f of DOCUMENTI) {
		const percorso = join(dir, "docs", f);
		if (!existsSync(percorso)) fuori.push(`${f} manca`);
		else if (documentoVuoto(percorso)) fuori.push(`${f} è ancora lo scheletro`);
	}
	return fuori;
}

function leggiProgetti(): Record<string, string> {
	try {
		return JSON.parse(readFileSync(PROGETTI, "utf8"));
	} catch {
		return {};
	}
}

function segnaProgetto(dir: string, stato: string): void {
	const m = leggiProgetti();
	m[dir] = stato;
	try {
		mkdirSync(dirname(PROGETTI), { recursive: true });
		writeFileSync(PROGETTI, `${JSON.stringify(m, null, 2)}\n`, "utf8");
	} catch {
		// niente memoria: al massimo lo richiede la volta dopo
	}
}

/** Setup in sospeso (entro 24h): prima gli strumenti, l'allineamento aspetta il prossimo avvio. */
function setupInSospeso(): boolean {
	try {
		const quando = Date.parse(
			readFileSync(join(AGENT_DIR, "pi-software-house", "setup-pending"), "utf8").trim(),
		);
		return Number.isFinite(quando) && Date.now() - quando < 24 * 3600 * 1000;
	} catch {
		return false;
	}
}

const SCELTE_ALLINEAMENTO = {
	documenti: "Sì, solo documenti",
	codice: "Sì, anche il codice",
	dopo: "Non ora, chiedimelo la prossima volta",
	mai: "No, non chiedere più per questo progetto",
};

const TESTO_ALLINEAMENTO = `Allineamento richiesto: questo progetto e' gia' avviato e la sua casa (\`docs/\`) non e' come la software house se l'aspetta.

Segui la sezione "Allineare un progetto gia' avviato" del manuale:
0. leggi quello che c'e' gia' dentro prima di scrivere: la riga qui sopra ti dice cosa manca e cosa e' rimasto vuoto;
1. apri un referente (\`subagent\`, \`agent: referente-<area>\`, \`interactive: true\`): i suoi operai leggono il CODICE — cartelle, moduli, entry point, come si parlano, i comandi veri dai file di configurazione — e ti elencano le aree funzionali reali con i loro file e i .md che trovano;
2. apri un referente per area: ognuno legge il codice della sua area e riempie la sua parte di \`docs/\`;
3. il codice e' la verita': se un documento dice una cosa e il codice ne dice un'altra, si scrive quello che fa il codice;
4. un documento che esiste si ALLUNGA, non si sostituisce: prima si legge, poi si aggiunge. Uno vuoto o rimasto scheletro si riempie, leggendo il codice;
5. non cancellare niente e non riscrivere il codice: i file di origine restano dove sono, se il contenuto e' stato spostato in \`docs/\` si aggiunge in cima il rimando;
6. \`AGENTS.md\`: se esiste, aggiungi in cima il rimando a \`docs/\` senza togliere niente; se non esiste, crea il solo rimando;
7. alla fine una revisione: in \`docs/\` non deve mancare niente di quello che c'era prima;
8. aggiorna \`docs/STATO.md\` e racconta al committente cosa hai spostato e cosa hai riempito.`;

const TESTO_ALLINEAMENTO_CODICE = `${TESTO_ALLINEAMENTO}

In piu', il committente vuole il codice allineato alle regole (quelle di docs/REGOLE.md e del manuale):
9. un'area alla volta, col suo referente: struttura per area funzionale (non per tipo di file), un file una responsabilita', max 500 righe (oltre si spezza), niente utils generici, test accanto al codice;
10. solo struttura, non riscrittura: si sposta e si spezza, il comportamento resta identico. Dopo ogni area i test girano e sono verdi, altrimenti si torna indietro;
11. niente refactor gratuiti: quello che va gia' bene resta dov'e'. Alla fine la revisione confronta comportamento prima/dopo, non solo i documenti.`;

function inviaAllineamento(invia: (testo: string) => void, scelta: string | undefined): boolean {
	if (scelta === SCELTE_ALLINEAMENTO.codice) {
		invia(TESTO_ALLINEAMENTO_CODICE);
		return true;
	}
	if (scelta === SCELTE_ALLINEAMENTO.documenti) {
		invia(TESTO_ALLINEAMENTO);
		return true;
	}
	return false;
}

// ------------------------------------------------- scelta guidata modello

interface Catalogo {
	provider: Map<string, string[]>;
}

function leggiCatalogo(ctx: ExtensionCommandContext): Catalogo {
	const provider = new Map<string, string[]>();
	try {
		const modelli = (ctx as any).modelRegistry?.getAvailable?.() ?? [];
		for (const m of modelli) {
			const p = m?.provider;
			const id = m?.id;
			if (typeof p !== "string" || typeof id !== "string") continue;
			if (!provider.has(p)) provider.set(p, []);
			const lista = provider.get(p)!;
			if (!lista.includes(id)) lista.push(id);
		}
	} catch {
		// niente catalogo: si potrà scrivere il modello a mano
	}
	for (const lista of provider.values()) lista.sort();
	return { provider };
}

async function scegliModello(ctx: ExtensionCommandContext, attuale: string): Promise<string | null> {
	const { provider } = leggiCatalogo(ctx);
	if (provider.size === 0) {
		const scritto = await ctx.ui.input("Modello (provider/modello):", attuale);
		return scritto?.trim() || null;
	}

	const elencoProvider = [...provider.keys()].sort();
	const pScelto = await ctx.ui.select(
		`Da quale provider? (ora: ${attuale})`,
		[...elencoProvider, "scrivo io il nome"],
	);
	if (!pScelto) return null;
	if (pScelto === "scrivo io il nome") {
		const scritto = await ctx.ui.input("Modello (provider/modello):", attuale);
		return scritto?.trim() || null;
	}

	let lista = provider.get(pScelto)!;
	if (lista.length > 30) {
		const filtro = await ctx.ui.input(`Filtra i ${lista.length} modelli di ${pScelto} (lascia vuoto per vederli tutti):`, "");
		const f = (filtro ?? "").trim().toLowerCase();
		if (f) {
			lista = lista.filter((m) => m.toLowerCase().includes(f));
			if (lista.length === 0) {
				ctx.ui.notify(`Nessun modello di ${pScelto} contiene "${f}".`, "warning");
				return null;
			}
		}
	}
	const mostrati = lista.slice(0, 200);
	const scelto = await ctx.ui.select(
		lista.length > mostrati.length
			? `Quale modello di ${pScelto}? (${lista.length} totali, mostro i primi 200: filtra per vedere gli altri)`
			: `Quale modello di ${pScelto}?`,
		mostrati,
	);
	if (!scelto) return null;
	return `${pScelto}/${scelto}`;
}

async function comandoModelli(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
	const cfg = leggiConfig();

	const righe = RUOLI.map((r) => `${r.etichetta}\n    ${cfg[r.chiave].model}  ·  effort ${cfg[r.chiave].thinking}`);
	const c = ctx as any;
	const inUso = c.model
		? `In questa sessione: ${c.model.provider}/${c.model.id}  ·  effort ${c.thinkingLevel}`
		: "";
	ctx.ui.notify(`Modelli configurati\n\n${righe.join("\n")}${inUso ? `\n\n${inUso}` : ""}`, "info");

	const scelto = await ctx.ui.select(
		"Quale ruolo vuoi cambiare?",
		RUOLI.map((r) => `${r.etichetta} — ${cfg[r.chiave].model} · ${cfg[r.chiave].thinking}`),
	);
	if (!scelto) return;
	const ruolo = RUOLI.find((r) => scelto.startsWith(r.etichetta));
	if (!ruolo) return;

	const modello = await scegliModello(ctx, cfg[ruolo.chiave].model);
	if (!modello) return;

	const pensiero = await ctx.ui.select(
		`Effort per ${ruolo.etichetta} (ora: ${cfg[ruolo.chiave].thinking})`,
		LIVELLI,
	);
	if (!pensiero) return;

	cfg[ruolo.chiave] = { model: modello, thinking: pensiero };
	scriviConfig(cfg);
	ctx.ui.notify(
		`${ruolo.etichetta} → ${modello} · effort ${pensiero}\n` +
			`Scritto in ${CONFIG_FILE}\n` +
			"Gli agenti già assunti tengono il modello vecchio: rifai il file se serve.",
		"info",
	);

	if (ruolo.chiave !== "capo") return;

	// Il capo e' la sessione corrente: chiediamo se applicarlo subito.
	const applica = await ctx.ui.confirm(
		"Applico al capo adesso?",
		`Modello: ${modello}\nEffort: ${pensiero}\n\nCambia la sessione corrente e, se vuoi, il predefinito per le sessioni nuove.`,
	);
	if (!applica) return;

	let applicato = "";
	try {
		const pezzi = modello.split("/");
		const m =
			pezzi.length > 1
				? (ctx as any).modelRegistry?.find?.(pezzi[0], pezzi.slice(1).join("/"))
				: undefined;
		if (m) {
			const ok = await pi.setModel(m);
			applicato = ok ? `Modello attivo: ${modello}` : "";
			if (!ok) ctx.ui.notify("Non c'è autenticazione per quel modello.", "error");
		} else {
			ctx.ui.notify("Modello non trovato nel catalogo: lo terrò solo per i prossimi agenti.", "warning");
		}
		pi.setThinkingLevel(pensiero as any);
		applicato += `${applicato ? " · " : ""}effort ${pensiero}`;
		if (applicato) ctx.ui.notify(`Applicato a questa sessione — ${applicato}`, "info");
	} catch {
		ctx.ui.notify("Non sono riuscito ad applicarlo a questa sessione.", "warning");
	}

	const predefinito = await ctx.ui.confirm(
		"Lo rendo anche il predefinito?",
		"Scrive modello ed effort in settings.json: ogni sessione nuova partirà con questi.",
	);
	if (!predefinito) return;
	try {
		const s = existsSync(SETTINGS) ? JSON.parse(readFileSync(SETTINGS, "utf8")) : {};
		const [prov, ...resto] = modello.split("/");
		s.defaultProvider = prov;
		s.defaultModel = resto.join("/");
		s.defaultThinkingLevel = pensiero;
		writeFileSync(SETTINGS, `${JSON.stringify(s, null, 2)}\n`, "utf8");
		ctx.ui.notify(`Predefinito aggiornato: ${modello} · effort ${pensiero}`,
			"info");
	} catch {
		ctx.ui.notify("Non sono riuscito a scrivere settings.json.", "warning");
	}
}

// ------------------------------------------------------------------- init

export default function (pi: ExtensionAPI) {
	const grezzo = leggiFileManuale("casa.md");
	const squadraGrezza = leggiFileManuale("squadra.md");

	pi.registerCommand("modelli", {
		description: "Scegli i modelli LLM per ruolo (capo, referenti, operai)",
		handler: async (_args, ctx) => comandoModelli(pi, ctx),
	});

	if (!grezzo) {
		try {
			console.warn("[pi-software-house] manual/casa.md non trovato: estensione disattivata.");
		} catch {
			// nemmeno l'avviso si puo' dare
		}
		return;
	}

	const skillProgetto = leggiSkill(SKILL_DEL_CAPO);

	pi.on("before_agent_start", async (event, ctx) => {
		if (eQuestoPacchetto(ctx.cwd)) return;
		const cfg = leggiConfig();
		let parte = sostituisci(grezzo, cfg);
		let squadra = squadraGrezza ? sostituisci(squadraGrezza, cfg) : "";
		if (!squadra) {
			// manuale in un file solo: la parte del capo sta dopo il segnaposto
			const at = parte.indexOf(MARKER);
			if (at !== -1) {
				squadra = parte.slice(at).trimEnd();
				parte = parte.slice(0, at).trimEnd();
			}
		}

		const pezzi = [parte];
		// Il capo comanda la squadra; capo e referenti tengono i documenti.
		if (eCapo(ctx)) pezzi.push(squadra);
		if (ctx.hasUI && skillProgetto) pezzi.push(skillProgetto);

		const base = event.systemPrompt ? `${event.systemPrompt}\n\n` : "";
		return { systemPrompt: `${base}${pezzi.filter(Boolean).join("\n\n---\n\n")}` };
	});

	let capoLegge = true;

	/** Manda il compito al capo senza rompersi se sta gia' rispondendo. */
	const invia = (testo: string): void => {
		void (async () => {
			try {
				await pi.sendUserMessage(testo);
			} catch {
				await pi.sendUserMessage(testo, { deliverAs: "followUp" });
			}
		})();
	};

	pi.registerCommand("allinea", {
		description: "Allinea questo progetto (solo documenti, o anche il codice)",
		handler: async (_args, ctx) => {
			const scelta = await ctx.ui.select("Allineo il progetto alla software house?", [
				SCELTE_ALLINEAMENTO.documenti,
				SCELTE_ALLINEAMENTO.codice,
				"Annulla",
			]);
			if (!inviaAllineamento(invia, scelta)) return;
			ctx.ui.notify(
				scelta === SCELTE_ALLINEAMENTO.codice
					? `Allineo ${ctx.cwd}: documenti e struttura del codice, un'area alla volta coi test verdi.`
					: `Allineo ${ctx.cwd}: solo documenti, il codice resta dov'e'.`,
				"info",
			);
		},
	});

	pi.registerCommand("capo", {
		description: "Blocco lettura codice per il capo: /capo on|off|status",
		handler: async (args, ctx) => {
			const cmd = (args ?? "").trim().toLowerCase();
			if (cmd === "off") capoLegge = false;
			if (cmd === "on") capoLegge = true;
			ctx.ui.notify(
				capoLegge
					? "Il capo non legge il codice: delega agli operai."
					: "Il capo legge il codice (squadra spenta per questa sessione).",
				capoLegge ? "info" : "warning",
			);
		},
	});

	// Prima apertura in un progetto avviato: la casa non c'e'. Si chiede una volta.
	pi.on("session_start", async (_event, ctx) => {
		if (!eCapo(ctx)) return;
		if (setupInSospeso()) return;
		const cwd = ctx.cwd;
		if (eQuestoPacchetto(cwd)) return;
		if (!eProgetto(cwd)) return;
		const mancanti = documentiDaSistemare(cwd);
		if (mancanti.length === 0) return;
		if (leggiProgetti()[cwd] === "declinato") return;
		// Senza il tool `Agent` non c'e' nessuno a cui delegare: prima si configura.
		if (!pi.getAllTools().some((t) => t.name === "Agent" || t.name === "subagent")) return;

		const scelta = await ctx.ui.select(
			`Questo progetto non ha la casa come si deve. Allineo?\n\n${cwd}\n\n${mancanti.join(", ")}`,
			[SCELTE_ALLINEAMENTO.documenti, SCELTE_ALLINEAMENTO.codice, SCELTE_ALLINEAMENTO.dopo, SCELTE_ALLINEAMENTO.mai],
		);
		if (!scelta) return;
		if (scelta === SCELTE_ALLINEAMENTO.mai) {
			segnaProgetto(cwd, "declinato");
			ctx.ui.notify("Ok, non lo chiedo più qui. Quando vuoi: /allinea", "info");
			return;
		}
		if (!inviaAllineamento(invia, scelta)) return;

		ctx.ui.notify(`Allineo ${cwd}: non cancello niente che conta.`, "info");
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!capoLegge) return undefined;
		if (!eCapo(ctx)) return undefined; // referenti e operai leggono eccome
		if (!TOOL_DI_LETTURA.has(event.toolName)) return undefined;
		if (eQuestoPacchetto(ctx.cwd)) return undefined;
		if (!eCasa(ctx.cwd)) return undefined; // progetto senza docs/: nessuna squadra

		const raw = String(event.input.path ?? event.input.file_path ?? "").trim() || ".";
		const abs = resolve(ctx.cwd, raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw);
		if (percorsoLeggibile(abs, ctx.cwd)) return undefined;

		return {
			block: true,
			reason:
				"Sei il capo e non leggi il codice: lo leggono gli operai.\n" +
				"Apri un referente con `subagent` (`agent:`, `interactive: true`). Mai `Agent` sul capo.\n" +
				`Tu leggi solo \`docs/\` e i file \`.md\`. Serve leggere per forza? Il committente deve dire \`/capo off\`.`,
		};
	});
}
