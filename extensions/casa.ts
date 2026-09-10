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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const MARKER = "# Se sei la SESSIONE PRINCIPALE";
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
		predefinito: { model: "xai/grok-4.6", thinking: "medium" },
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
	return testo.replace(/\{\{([a-z]+)\.(model|thinking)\}\}/g, (intero, chiave, campo) => {
		const scelta = cfg[chiave];
		return scelta ? scelta[campo] : intero;
	});
}

// --------------------------------------------------------------- manuale

function leggiManuale(): string | null {
	const percorsi = [
		join(HERE, "..", "manual", "casa.md"),
		join(HERE, "..", "..", "manual", "casa.md"),
	];
	for (const p of percorsi) {
		try {
			return readFileSync(p, "utf8");
		} catch {
			// prova il prossimo percorso
		}
	}
	return null;
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
	const scelto = await ctx.ui.select(`Quale modello di ${pScelto}?`, mostrati);
	if (!scelto) return null;
	return `${pScelto}/${scelto}`;
}

async function comandoModelli(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
	const cfg = leggiConfig();

	const righe = RUOLI.map((r) => `${r.etichetta}\n    ${cfg[r.chiave].model}  ·  ${cfg[r.chiave].thinking}`);
	ctx.ui.notify(`Modelli in uso\n\n${righe.join("\n")}`, "info");

	const scelto = await ctx.ui.select(
		"Quale ruolo vuoi cambiare?",
		RUOLI.map((r) => `${r.etichetta} — ${cfg[r.chiave].model}`),
	);
	if (!scelto) return;
	const ruolo = RUOLI.find((r) => scelto.startsWith(r.etichetta));
	if (!ruolo) return;

	const modello = await scegliModello(ctx, cfg[ruolo.chiave].model);
	if (!modello) return;

	const pensiero = await ctx.ui.select(`Livello di pensiero (ora: ${cfg[ruolo.chiave].thinking})`, LIVELLI);
	if (!pensiero) return;

	cfg[ruolo.chiave] = { model: modello, thinking: pensiero };
	scriviConfig(cfg);
	ctx.ui.notify(`${ruolo.etichetta} → ${modello} · ${pensiero}\nScritto in ${CONFIG_FILE}`, "info");

	if (ruolo.chiave !== "capo") return;

	// Il capo e' la sessione corrente: chiediamo se applicarlo subito.
	const applica = await ctx.ui.confirm(
		"Applico al capo adesso?",
		`Modello: ${modello}\nPensiero: ${pensiero}\n\nCambia la sessione corrente e, se vuoi, il predefinito per le sessioni nuove.`,
	);
	if (!applica) return;

	try {
		const m = (ctx as any).modelRegistry?.find?.(modello.split("/")[0], modello.split("/").slice(1).join("/"));
		if (m) {
			const ok = await pi.setModel(m);
			if (!ok) ctx.ui.notify("Non c'è autenticazione per quel modello.", "error");
		} else {
			ctx.ui.notify("Modello non trovato nel catalogo: lo terrò solo per i prossimi agenti.", "warning");
		}
		pi.setThinkingLevel(pensiero as any);
	} catch {
		ctx.ui.notify("Non sono riuscito ad applicarlo a questa sessione.", "warning");
	}

	const predefinito = await ctx.ui.confirm(
		"Lo rendo anche il predefinito?",
		"Scrive il modello in settings.json: ogni sessione nuova partirà con questo.",
	);
	if (!predefinito) return;
	try {
		const s = existsSync(SETTINGS) ? JSON.parse(readFileSync(SETTINGS, "utf8")) : {};
		const [prov, ...resto] = modello.split("/");
		s.defaultProvider = prov;
		s.defaultModel = resto.join("/");
		writeFileSync(SETTINGS, `${JSON.stringify(s, null, 2)}\n`, "utf8");
		ctx.ui.notify("Predefinito aggiornato.", "info");
	} catch {
		ctx.ui.notify("Non sono riuscito a scrivere settings.json.", "warning");
	}
}

// ------------------------------------------------------------------- init

export default function (pi: ExtensionAPI) {
	const grezzo = leggiManuale();

	pi.registerCommand("modelli", {
		description: "Scegli i modelli LLM per ruolo (capo, referenti, operai)",
		handler: async (_args, ctx) => comandoModelli(pi, ctx),
	});

	if (!grezzo) return;

	const isSubagent = Boolean(process.env.PI_SUBAGENT_NAME);

	pi.on("before_agent_start", async (event) => {
		const testo = sostituisci(grezzo, leggiConfig());
		const at = testo.indexOf(MARKER);
		const parte = at === -1 ? testo : testo.slice(0, at).trimEnd();
		const capo = at === -1 ? "" : testo.slice(at).trimEnd();
		const completo = isSubagent || !capo ? parte : `${parte}\n\n---\n\n${capo}`;
		const base = event.systemPrompt ? `${event.systemPrompt}\n\n` : "";
		return { systemPrompt: `${base}${completo}` };
	});
}
