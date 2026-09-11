/**
 * Configurazione della software house.
 *
 * Alla prima apertura controlla che ci sia tutto (i pacchetti esterni, il
 * layout delle pane, il filtro) e, con un solo "sì" dell'utente, lo mette a
 * posto da solo.
 *
 * Comando: /casa  ->  stato e configurazione
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const AGENT_DIR = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const SETTINGS = join(AGENT_DIR, "settings.json");
const SKIP_FILE = join(AGENT_DIR, "pi-software-house", "skip-setup");

interface Pacchetto {
	nome: string;
	perche: string;
	/** argomento per `pi install` */
	installa: string;
	/** una qualsiasi di queste sorgenti già presente = è installato */
	sorgenti: string[];
}

/** I pacchetti esterni che servono alla squadra. */
const PACCHETTI: Pacchetto[] = [
	{
		nome: "pi-herdr-agents",
		perche: "i referenti vivono in una pane Herdr",
		installa: "npm:pi-herdr-agents",
		sorgenti: ["npm:pi-herdr-agents"],
	},
	{
		nome: "@tintinweb/pi-subagents",
		perche: "gli operai",
		installa: "npm:@tintinweb/pi-subagents",
		sorgenti: ["npm:@tintinweb/pi-subagents"],
	},
	{
		nome: "pi-peer",
		perche: "i referenti parlano tra loro e col capo",
		installa: "npm:pi-peer",
		sorgenti: ["npm:pi-peer"],
	},
	{
		nome: "ponytail",
		perche: "scrive meno codice: la soluzione piu' corta che funziona",
		installa: "git:github.com/DietrichGebert/ponytail",
		sorgenti: ["git:github.com/DietrichGebert/ponytail", "npm:@dietrichgebert/ponytail"],
	},
	{
		nome: "@juicesharp/rpiv-ask-user-question",
		perche: "il capo ti fa le domande a opzioni, non a testo libero",
		installa: "npm:@juicesharp/rpiv-ask-user-question",
		sorgenti: ["npm:@juicesharp/rpiv-ask-user-question"],
	},
	{
		nome: "pi-cache-guardian",
		perche: "meno token",
		installa: "npm:pi-cache-guardian",
		sorgenti: ["npm:pi-cache-guardian"],
	},
];

/** Layout delle pane consigliato. */
const PANE_CONFIG = {
	status: { enabled: true },
	models: { agents: {} },
	roles: { bundled: false },
	persistent: { maxAgents: 3 },
	supervision: { forcePolling: false, hangWarningMinutes: 15 },
	panes: { mode: "tab", direction: "right", maxPerTab: 2 },
};

function leggiSettings(): any {
	try {
		return JSON.parse(readFileSync(SETTINGS, "utf8"));
	} catch {
		return {};
	}
}

export function senzaVersione(s: string): string {
	return s.replace(/@[^/:]*$/, "");
}

function sorgentiInstallate(): Set<string> {
	const out = new Set<string>();
	for (const e of leggiSettings().packages ?? []) {
		const s = typeof e === "string" ? e : e?.source;
		if (typeof s === "string") {
			out.add(s);
			out.add(senzaVersione(s));
		}
	}
	return out;
}

function mancanti(): Pacchetto[] {
	const installate = sorgentiInstallate();
	return PACCHETTI.filter((p) => !p.sorgenti.some((s) => installate.has(s)));
}

function paneDaSistemare(): boolean {
	const cfg = join(AGENT_DIR, "npm", "node_modules", "pi-herdr-agents", "config.json");
	if (!existsSync(cfg)) return existsSync(dirname(cfg));
	try {
		const d = JSON.parse(readFileSync(cfg, "utf8"));
		return d?.panes?.mode !== "tab" || d?.roles?.bundled !== false;
	} catch {
		return true;
	}
}

/** true = il filtro è già a posto. */
function filtroOk(): boolean {
	for (const e of leggiSettings().packages ?? []) {
		if (typeof e === "object" && e?.source === "npm:pi-herdr-agents") {
			return Array.isArray(e.skills) && e.skills.length === 0;
		}
	}
	return false;
}

function scriviPaneConfig(): void {
	const cfg = join(AGENT_DIR, "npm", "node_modules", "pi-herdr-agents", "config.json");
	if (!existsSync(dirname(cfg))) return;
	try {
		writeFileSync(cfg, `${JSON.stringify(PANE_CONFIG, null, 2)}\n`, "utf8");
	} catch {
		// layout non scritto: /casa lo segnala ancora, niente crash
	}
}

function scriviFiltro(): void {
	const d = leggiSettings();
	const pkgs: any[] = [];
	let fatto = false;
	for (const e of d.packages ?? []) {
		const s = typeof e === "string" ? e : e?.source;
		if (typeof s === "string" && s.includes("pi-herdr-agents")) {
			if (!fatto) {
				pkgs.push({ source: "npm:pi-herdr-agents", skills: [] });
				fatto = true;
			}
		} else {
			pkgs.push(e);
		}
	}
	if (!fatto) pkgs.push({ source: "npm:pi-herdr-agents", skills: [] });
	d.packages = pkgs;
	try {
		writeFileSync(SETTINGS, `${JSON.stringify(d, null, 2)}\n`, "utf8");
	} catch {
		// settings non scritto: /casa lo segnala ancora, niente crash
	}
}

interface Stato {
	mancano: Pacchetto[];
	paneDaFare: boolean;
	filtroOk: boolean;
	tuttoOk: boolean;
}

function stato(): Stato {
	const mancano = mancanti();
	const paneDaFare = paneDaSistemare();
	const fOk = filtroOk();
	return { mancano, paneDaFare, filtroOk: fOk, tuttoOk: mancano.length === 0 && !paneDaFare && fOk };
}

/** Come rilanciare questa stessa installazione di Pi. */
function comandoPi(): { cmd: string; pre: string[] } {
	const script = process.argv[1];
	if (script && existsSync(script) && /\.[cm]?[jt]s$/.test(script)) {
		return { cmd: process.execPath, pre: [script] };
	}
	return { cmd: "pi", pre: [] };
}

const GIORNI_SALTO = 30;

/** Il "non chiedere piu'" vale 30 giorni, poi si richiede. */
export function saltoValido(): boolean {
	try {
		const quando = Date.parse(readFileSync(SKIP_FILE, "utf8").trim());
		if (!Number.isFinite(quando)) return false;
		return Date.now() - quando < GIORNI_SALTO * 24 * 3600 * 1000;
	} catch {
		return false;
	}
}

function segnaSalto(): void {
	try {
		mkdirSync(dirname(SKIP_FILE), { recursive: true });
		writeFileSync(SKIP_FILE, `${new Date().toISOString()}\n`, "utf8");
	} catch {
		// senza memoria lo richiede la volta dopo
	}
}

/** Setup in sospeso: l'allineamento aspetta il prossimo avvio. */
function attesaFile(): string {
	return join(AGENT_DIR, "pi-software-house", "setup-pending");
}

function segnaAttesa(): void {
	try {
		mkdirSync(dirname(attesaFile()), { recursive: true });
		writeFileSync(attesaFile(), `${new Date().toISOString()}\n`, "utf8");
	} catch {
		// senza memoria entrambi chiedono, come prima
	}
}

function togliAttesa(): void {
	try {
		unlinkSync(attesaFile());
	} catch {
		// gia' tolto o mai messo
	}
}

function attesaValida(): boolean {
	try {
		const quando = Date.parse(readFileSync(attesaFile(), "utf8").trim());
		return Number.isFinite(quando) && Date.now() - quando < 24 * 3600 * 1000;
	} catch {
		return false;
	}
}

async function configura(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
	const { cmd, pre } = comandoPi();
	let errori = 0;
	for (const p of mancanti()) {
		ctx.ui.notify(`Installo ${p.nome}…`, "info");
		const res = await pi.exec(cmd, [...pre, "install", p.installa]);
		if (res.code !== 0) {
			errori++;
			ctx.ui.notify(`Non sono riuscito a installare ${p.nome}: ${res.stderr || res.stdout}`, "error");
		}
	}
	if (paneDaSistemare()) scriviPaneConfig();
	if (!filtroOk()) scriviFiltro();

	togliAttesa();
	if (errori) {
		ctx.ui.notify("Configurazione incompleta. Rilancia /casa e riprova.", "warning");
		return;
	}
	if (!stato().tuttoOk) {
		ctx.ui.notify("Installato. Riavvia Pi cosi' i nuovi strumenti si caricano, poi rilancia /casa.", "warning");
		return;
	}
	ctx.ui.notify("Software house configurata. Riavvia Pi perché i nuovi strumenti si carichino.", "info");
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("casa", {
		description: "Stato della software house e configurazione",
		handler: async (_args, ctx) => {
			const s = stato();
			if (s.tuttoOk) {
				const nomi = PACCHETTI.map((p) => p.nome).join(", ");
				ctx.ui.notify(`Software house a posto.\nPacchetti: ${nomi}`, "info");
				return;
			}
			const righe = [
				s.mancano.length ? `mancano: ${s.mancano.map((p) => p.nome).join(", ")}` : "pacchetti: ok",
				s.paneDaFare ? "layout delle pane: da sistemare" : "layout delle pane: ok",
				s.filtroOk ? "filtro skill: ok" : "filtro skill: da sistemare",
			];
			const ok = await ctx.ui.confirm("Sistemo la software house?", righe.join("\n"));
			if (!ok) {
				ctx.ui.notify("Niente da fare. Rilancia /casa quando vuoi.", "info");
				return;
			}
			await configura(pi, ctx);
		},
	});

	// Alla prima apertura chiede una volta sola e sistema tutto.
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		const s = stato();
		if (s.tuttoOk) return;
		if (saltoValido()) return;
		segnaAttesa();

		const righe: string[] = [];
		if (s.mancano.length) {
			righe.push("Servono questi pacchetti:");
			for (const p of s.mancano) righe.push(`  • ${p.nome} — ${p.perche}`);
		}
		if (s.paneDaFare) righe.push("Va sistemato il layout delle pane Herdr.");
		if (!s.filtroOk) righe.push("Va filtrata una skill che entra in conflitto (orchestrate).");

		const ok = await ctx.ui.confirm(
			"Configuro la software house?",
			`${righe.join("\n")}\n\nPrima gli strumenti, poi i documenti: al prossimo avvio tocca all'allineamento. Si scarica da solo, poi riavvia Pi.`,
		);
		if (!ok) {
			segnaSalto();
			ctx.ui.notify("Ok, non lo chiedo più per un po'. Quando vuoi: /casa", "info");
			return;
		}
		await configura(pi, ctx);
	});
}
