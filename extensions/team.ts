/**
 * Bus di squadra: capo <-> referenti <-> operai.
 *
 * Unico canale vero: file `.pi/team/msg-*.json`, uno per messaggio.
 * Quattro tipi: fatto, bloccato, domanda, aggiornamento.
 * Solo il capo parla col committente: agli altri il tool delle domande
 * e' bloccato, scrivono nel bus e la risposta torna per la stessa strada.
 *
 * Visibilita': pane Herdr per i referenti, operai dentro le pane come
 * `Agent` nested, stato squadra nel widget e comando /squadra.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export type Tipo = "fatto" | "bloccato" | "domanda" | "aggiornamento";

export interface Msg {
	id: string;
	ts: number;
	da: string;
	a: string;
	tipo: Tipo;
	testo: string;
	lettoDa?: string[];
}

const TIPI = new Set<string>(["fatto", "bloccato", "domanda", "aggiornamento"]);
const MAX_TESTO = 2000;
const MAX_FILE = 300;
// ponytail: un file per messaggio, niente lock. La spunta "letto" puo'
// perdersi in una scrittura concorrente (doppia consegna, mai perdita).
const DOMANDE_UTENTE = new Set(["questionnaire", "ask_user_question"]);

export function dirBus(cwd: string): string {
	return join(cwd, ".pi", "team");
}

function assicuradir(cwd: string): void {
	try {
		mkdirSync(dirBus(cwd), { recursive: true });
	} catch {
		// senza bus si lavora lo stesso, solo senza memoria condivisa
	}
}

/** Chi sono: il nome Herdr se c'e', altrimenti capo od operaio. */
export function chiSono(ctx: { hasUI?: boolean; mode?: string } | undefined): string {
	const nome = process.env.PI_SUBAGENT_NAME;
	if (!ctx?.hasUI || ctx?.mode === "print") return nome ? `operaio@${nome}` : "operaio";
	return nome || "capo";
}

function eCapo(ctx: { hasUI?: boolean; mode?: string } | undefined): boolean {
	if (process.env.PI_SUBAGENT_NAME) return false;
	return Boolean(ctx?.hasUI) && ctx?.mode !== "print";
}

function nomeFile(m: Msg): string {
	return `msg-${m.ts}-${m.id}.json`;
}

export function inviaMessaggio(cwd: string, da: string, a: string, tipo: string, testo: string): Msg | null {
	const t = tipo.trim().toLowerCase();
	if (!TIPI.has(t) || !da.trim() || !a.trim() || !testo.trim()) return null;
	assicuradir(cwd);
	const m: Msg = {
		id: Math.random().toString(36).slice(2, 8),
		ts: Date.now(),
		da: da.trim().slice(0, 80),
		a: a.trim().slice(0, 80),
		tipo: t as Tipo,
		testo: testo.trim().slice(0, MAX_TESTO),
	};
	try {
		writeFileSync(join(dirBus(cwd), nomeFile(m)), `${JSON.stringify(m)}\n`, { flag: "wx" });
	} catch {
		return null;
	}
	pota(cwd);
	return m;
}

/** Toglie i piu' vecchi quando i file diventano troppi. */
function pota(cwd: string): void {
	let file: string[];
	try {
		file = readdirSync(dirBus(cwd)).filter((f) => f.startsWith("msg-")).sort();
	} catch {
		return;
	}
	for (const f of file.slice(0, Math.max(0, file.length - MAX_FILE))) {
		try {
			unlinkSync(join(dirBus(cwd), f));
		} catch {
			// un file in meno o in piu' non cambia niente
		}
	}
}

export function leggiBus(cwd: string): Msg[] {
	let file: string[];
	try {
		file = readdirSync(dirBus(cwd)).filter((f) => f.startsWith("msg-")).sort();
	} catch {
		return [];
	}
	const fuori: Msg[] = [];
	for (const f of file.slice(-MAX_FILE)) {
		try {
			const m = JSON.parse(readFileSync(join(dirBus(cwd), f), "utf8"));
			if (m && typeof m.da === "string" && typeof m.a === "string" && TIPI.has(m.tipo)) fuori.push(m);
		} catch {
			// un file rotto si salta, gli altri restano
		}
	}
	return fuori;
}

/** Cosa deve vedere `me`: i suoi, quelli a `squadra`, e per il capo anche i suoi. */
export function inboxPer(cwd: string, me: string): Msg[] {
	const miniera = me.startsWith("operaio@") ? me.slice("operaio@".length) : null;
	return leggiBus(cwd).filter((m) => {
		if (m.a === me || m.a === "squadra") return true;
		if (me === "capo" && m.a === "capo") return true;
		if (miniera && m.a === miniera) return true; // il referente vede i suoi operai
		if (miniera && m.da === miniera) return true; // ...e cosa ha detto a loro
		if (me === "capo") return true; // il capo vede tutto
		return false;
	});
}

export function nonLetti(cwd: string, me: string): Msg[] {
	return inboxPer(cwd, me).filter((m) => !(m.lettoDa ?? []).includes(me));
}

export function marcaLetti(cwd: string, me: string, quali: Msg[]): void {
	for (const m of quali) {
		try {
			const p = join(dirBus(cwd), nomeFile(m));
			const att = JSON.parse(readFileSync(p, "utf8"));
			const letto = new Set<string>(att.lettoDa ?? []);
			// ponytail: last-writer-wins sulla spunta, al massimo si rilegge
			letto.add(me);
			writeFileSync(p, `${JSON.stringify({ ...att, lettoDa: [...letto] })}\n`);
		} catch {
			// sparito o rotto: niente da segnare
		}
	}
}

/** Aperti = bloccato/domanda non ancora seguiti da un fatto dello stesso autore. */
export function riepilogo(cwd: string): { bloccati: number; domande: number; totali: number; ultimi: Msg[] } {
	const tutti = leggiBus(cwd);
	const chiusi = new Set(tutti.filter((m) => m.tipo === "fatto").map((m) => m.da));
	const aperti = tutti.filter((m) => !chiusi.has(m.da));
	return {
		bloccati: aperti.filter((m) => m.tipo === "bloccato").length,
		domande: aperti.filter((m) => m.tipo === "domanda").length,
		totali: tutti.length,
		ultimi: tutti.slice(-5),
	};
}

function protocollo(me: string): string {
	const capo = me === "capo";
	const operaio = me.startsWith("operaio");
	const ruolo = capo ? "capo" : operaio ? "operaio" : "referente";
	const superiore = capo ? null : operaio ? "il tuo referente" : "il capo";
	return [
		`Sei ${ruolo} (${me}) nella squadra. Il bus sta in .pi/team/: un file per messaggio.`,
		`Per parlare con la squadra scrivi .pi/team/msg-<tuonome>-<millis>.json con {"da":"${me}","a":"<destinatario>","tipo":"<tipo>","testo":"..."} usando write.`,
		`Tipi: fatto (finito+verifica vera) · bloccato (cosa ti ferma, max 3 domande) · domanda (ti serve una decisione) · aggiornamento (stato, max 2 righe).`,
		capo
			? "Sei l'unico che parla col committente. Le domande della squadra arrivano a te: rispondi nel bus e la risposta scende per la stessa strada."
			: `Non parlare mai col committente e non usare il tool delle domande: scrivi una domanda nel bus a ${superiore} e fermati. La risposta arriva nel bus.`,
		operaio
			? "Non hai talk_to e non sei una pane: niente chiamate, solo il bus. Il referente ti corregge con steer_subagent."
			: "Referente: i tuoi operai sono Agent nested nella tua pane, li correggi con steer_subagent e leggi il risultato senza wait. Resta in pane finche' non arriva la notifica Agent. Tra referenti il bus vale piu' di talk_to.",
		"Leggi il bus a ogni giro e aggiorna docs/STATO.md per la tua parte: il committente vi guarda da li'.",
	].join("\n");
}

function testoInbox(messaggi: Msg[]): string {
	if (!messaggi.length) return "Bus: niente di nuovo per te.";
	return `Bus (${messaggi.length} da leggere):\n${messaggi.map((m) => `- [${m.tipo}] ${m.da} → ${m.a}: ${m.testo}`).join("\n")}`;
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("squadra", {
		description: "Stato della squadra: chi fa cosa, bloccati e domande",
		handler: async (_args, ctx) => {
			const me = chiSono(ctx);
			const r = riepilogo(ctx.cwd);
			const miei = nonLetti(ctx.cwd, me);
			const righe = [
				`Tu sei ${me}. Messaggi: ${r.totali} · bloccati aperti: ${r.bloccati} · domande aperte: ${r.domande} · da leggere per te: ${miei.length}`,
				...r.ultimi.map((m) => `[${m.tipo}] ${m.da} → ${m.a}: ${m.testo.slice(0, 120)}`),
			];
			ctx.ui.notify(righe.join("\n"), "info");
		},
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const me = chiSono(ctx);
		assicuradir(ctx.cwd);
		const nuovi = nonLetti(ctx.cwd, me).slice(-10);
		if (nuovi.length) marcaLetti(ctx.cwd, me, nuovi);
		const r = riepilogo(ctx.cwd);
		const stato =
			me === "capo" || !me.startsWith("operaio")
				? `\nSquadra: ${r.totali} messaggi · ${r.bloccati} bloccati · ${r.domande} domande aperte.`
				: "";
		aggiornaStato(ctx, r);
		const base = (event as any)?.systemPrompt ? `${(event as any).systemPrompt}\n\n` : "";
		return { systemPrompt: `${base}${protocollo(me)}${stato}\n${testoInbox(nuovi)}` };
	});

	// Solo il capo chiede al committente; gli altri passano dal bus.
	// Gerarchia: capo -> referenti (subagent) -> operai (Agent). Referenti e
	// operai non aprono pane, gli operai non delegano, il capo non usa Agent.
	pi.on("tool_call", async (event, ctx) => {
		if (DOMANDE_UTENTE.has(event.toolName)) {
			if (eCapo(ctx)) return undefined;
			return {
				block: true,
				reason:
					"Solo il capo parla col committente. Scrivi una domanda nel bus (.pi/team/) al tuo superiore e fermati: la risposta arriva li'.",
			};
		}
		const nome = String((event as any)?.toolName ?? "").toLowerCase();
		const headless = !ctx?.hasUI || (ctx as any)?.mode === "print";
		if (nome === "subagent" && (headless || process.env.PI_SUBAGENT_NAME)) {
			return {
				block: true,
				reason: "Niente pane da qui: i referenti nascono solo con subagent dal capo, gli operai solo con Agent dal referente.",
			};
		}
		if (nome === "agent" && (headless || eCapo(ctx))) {
			return {
				block: true,
				reason: headless
					? "Gli operai non delegano: se sei fermo scrivi BLOCCATO nel bus al tuo referente."
					: "Sei il capo e non lanci operai: apri un referente con subagent (agent:, interactive: true).",
			};
		}
		return undefined;
	});

	pi.on("session_start", async (_event, ctx) => {
		assicuradir(ctx.cwd);
		try {
			aggiornaStato(ctx, riepilogo(ctx.cwd));
		} catch {
			// la barra di stato puo' mancare, il bus no
		}
	});
}

function aggiornaStato(ctx: ExtensionContext, r: { bloccati: number; domande: number }): void {
	if (!ctx.hasUI) return;
	const u = ctx.ui as any;
	if (typeof u.setStatus !== "function") return;
	if (r.bloccati + r.domande > 0) {
		u.setStatus("squadra", `👥 ⛔${r.bloccati} ❓${r.domande}`);
	} else {
		u.setStatus("squadra", undefined);
	}
}
