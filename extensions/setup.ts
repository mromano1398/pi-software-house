/**
 * Configurazione della software house.
 *
 * Alla prima apertura controlla che ci sia tutto (i pacchetti esterni, il
 * layout delle pane, il filtro) e, con un solo "sì" dell'utente, lo mette a
 * posto da solo.
 *
 * Comando: /casa  ->  stato e configurazione
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const AGENT_DIR = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const SETTINGS = join(AGENT_DIR, "settings.json");
const SKIP_FILE = join(AGENT_DIR, "pi-software-house", "skip-setup");

/** I pacchetti esterni che servono alla squadra. */
const PACCHETTI = [
	{ nome: "pi-herdr-agents", perche: "referenti in pane Herdr" },
	{ nome: "@tintinweb/pi-subagents", perche: "operai" },
	{ nome: "pi-peer", perche: "i referenti parlano tra loro e col capo" },
	{ nome: "pi-cache-guardian", perche: "meno token" },
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

function sorgentiInstallate(): Set<string> {
	const out = new Set<string>();
	for (const e of leggiSettings().packages ?? []) {
		const s = typeof e === "string" ? e : e?.source;
		if (typeof s === "string") out.add(s);
	}
	return out;
}

function mancanti(): string[] {
	const installate = sorgentiInstallate();
	return PACCHETTI.filter((p) => !installate.has(`npm:${p.nome}`)).map((p) => p.nome);
}

function paneDaSistemare(): boolean {
	const cfg = join(AGENT_DIR, "npm", "node_modules", "pi-herdr-agents", "config.json");
	if (!existsSync(cfg)) return true;
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
	writeFileSync(cfg, `${JSON.stringify(PANE_CONFIG, null, 2)}\n`, "utf8");
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
	writeFileSync(SETTINGS, `${JSON.stringify(d, null, 2)}\n`, "utf8");
}

interface Stato {
	mancano: string[];
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
	if (script && existsSync(script) && /\.[cm]?js$/.test(script)) {
		return { cmd: process.execPath, pre: [script] };
	}
	return { cmd: "pi", pre: [] };
}

async function configura(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
	const { cmd, pre } = comandoPi();
	let errori = 0;
	for (const nome of mancanti()) {
		ctx.ui.notify(`Installo ${nome}…`, "info");
		const res = await pi.exec(cmd, [...pre, "install", `npm:${nome}`]);
		if (res.code !== 0) {
			errori++;
			ctx.ui.notify(`Non sono riuscito a installare ${nome}: ${res.stderr || res.stdout}`, "error");
		}
	}
	if (paneDaSistemare()) scriviPaneConfig();
	if (!filtroOk()) scriviFiltro();

	if (errori || !stato().tuttoOk) {
		ctx.ui.notify("Configurazione incompleta. Rilancia /casa e riprova.", "warning");
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
				ctx.ui.notify("Software house a posto: pacchetti, pane e filtro configurati.", "info");
				return;
			}
			const righe = [
				s.mancano.length ? `mancano: ${s.mancano.join(", ")}` : "pacchetti: ok",
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
		if (existsSync(SKIP_FILE)) return;

		const righe: string[] = [];
		if (s.mancano.length) {
			righe.push("Servono questi pacchetti:");
			for (const nome of s.mancano) {
				const p = PACCHETTI.find((x) => x.nome === nome);
				righe.push(`  • ${nome} — ${p?.perche ?? ""}`);
			}
		}
		if (s.paneDaFare) righe.push("Va sistemato il layout delle pane Herdr.");
		if (!s.filtroOk) righe.push("Va filtrata una skill che entra in conflitto (orchestrate).");

		const ok = await ctx.ui.confirm(
			"Configuro la software house?",
			`${righe.join("\n")}\n\nSi scarica da solo, poi riavvia Pi.`,
		);
		if (!ok) {
			mkdirSync(dirname(SKIP_FILE), { recursive: true });
			writeFileSync(SKIP_FILE, "declinato\n", "utf8");
			ctx.ui.notify("Ok, non lo chiedo più. Quando vuoi: /casa", "info");
			return;
		}
		await configura(pi, ctx);
	});
}
