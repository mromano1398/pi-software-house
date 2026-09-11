/**
 * Verifica chi è il capo, l'allineamento di un progetto avviato, chi può
 * leggere il codice e chi può scrivere le skill. `bun test`
 */
import { expect, test, describe } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// La memoria dei progetti declinati non deve finire in quella vera.
process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "psh-agent-"));
const casa = (await import("../extensions/casa.ts")).default;
const safetyGate = (await import("../extensions/safety-gate.ts")).default;
const DOCUMENTI = ["PROGETTO.md", "ARCHITETTURA.md", "REGOLE.md", "STATO.md", "DECISIONI.md"];

interface Ui {
	notify: () => void;
	select: (title: string, options: string[]) => Promise<string | undefined>;
	confirm: () => Promise<boolean>;
}

const ui = (select: Ui["select"]): Ui => ({ notify: () => {}, select, confirm: async () => true });
const niente = ui(async () => undefined);
const sceglie = (voce: string) => ui(async () => voce);

function carica(modulo: any) {
	const eventi: Record<string, any[]> = {};
	const messaggi: string[] = [];
	const pi = {
		registerCommand: () => {},
		getAllTools: () => [{ name: "Agent" }],
		sendUserMessage: (testo: string) => messaggi.push(testo),
		on: (ev: string, fn: any) => {
			(eventi[ev] ??= []).push(fn);
		},
	};
	modulo(pi as any);
	return {
		eventi,
		messaggi,
		chiama: (toolName: string, input: Record<string, unknown>, ctx: any) =>
			eventi.tool_call[0]({ toolName, input }, ctx),
		avvia: (ctx: any) => eventi.session_start[0]({ reason: "startup" }, ctx),
		prompt: async (ctx: any) => {
			const r = await eventi.before_agent_start[0]({ systemPrompt: "" }, ctx);
			return String(r?.systemPrompt ?? "");
		},
	};
}

/** La sessione vera: interfaccia sì, nome da sub-agente no. */
const capo = (cwd: string, u: Ui = niente) => ({ cwd, hasUI: true, mode: "tui", ui: u });
/** Un referente: gira in una pane, quindi ha l'interfaccia, ma ha il nome. */
const referente = (cwd: string, u: Ui = niente) => ({ cwd, hasUI: true, mode: "tui", ui: u });
/** Un operaio: gira in questo processo, in modalità "print", senza interfaccia. */
const operaio = (cwd: string) => ({ cwd, hasUI: false, mode: "print", ui: niente });

function cartella(seme: string, file: Record<string, string> = {}): string {
	const dir = mkdtempSync(join(tmpdir(), `psh-${seme}-`));
	for (const [percorso, testo] of Object.entries(file)) {
		mkdirSync(join(dir, percorso, ".."), { recursive: true });
		writeFileSync(join(dir, percorso), testo);
	}
	return dir;
}

/** Un progetto avviato: c'è qualcosa, ma non la casa. */
const avviato = () => cartella("progetto", { "AGENTS.md": "# progetto\n", "src/index.ts": "export const x = 1;\n" });
/** Un documento davvero scritto (non lo scheletro). */
const scritto = (f: string) => `# ${f}\n\nUna riga di contenuto vero.\nAltra riga di contenuto.\nTerza riga.\n`;

/** Un progetto già allineato: tutti i documenti che la software house pretende, e scritti. */
const allineato = () =>
	cartella(
		"casa",
		Object.fromEntries([...DOCUMENTI.map((f) => [`docs/${f}`, scritto(f)]), ["package.json", "{}\n"]]),
	);
/** `docs/` c'è, ma non come la software house se l'aspetta. */
const casaATema = () => cartella("mezza", { "package.json": "{}\n", "docs/appunti.md": "# appunti\n" });
/** `docs/` c'è coi 5 file, ma sono scheletri vuoti. */
const scheletri = () =>
	cartella(
		"scheletri",
		Object.fromEntries([
			...DOCUMENTI.map((f) => [`docs/${f}`, `# ${f}\n\n<una riga>\n<altra riga>\n`]),
			["package.json", "{}\n"],
		]),
	);

function conNome<T>(nome: string | undefined, fn: () => T): T {
	const prima = process.env.PI_SUBAGENT_NAME;
	if (nome === undefined) delete process.env.PI_SUBAGENT_NAME;
	else process.env.PI_SUBAGENT_NAME = nome;
	try {
		return fn();
	} finally {
		if (prima === undefined) delete process.env.PI_SUBAGENT_NAME;
		else process.env.PI_SUBAGENT_NAME = prima;
	}
}

describe("il capo", () => {
	test("non legge il codice, ma legge i documenti", async () => {
		const { chiama } = carica(casa);
		const cwd = cartella("codice", { "docs/STATO.md": "# Stato\n", "src/index.ts": "x\n" });
		expect(await chiama("read", { path: "src/index.ts" }, capo(cwd))).toMatchObject({ block: true });
		expect(await chiama("grep", { path: "src" }, capo(cwd))).toMatchObject({ block: true });
		expect(await chiama("read", { path: "docs/STATO.md" }, capo(cwd))).toBeUndefined();
		expect(await chiama("read", { path: "AGENTS.md" }, capo(cwd))).toBeUndefined();
		expect(await chiama("read", { path: ".pi/agents/referente-api.md" }, capo(cwd))).toBeUndefined();
	});

	test("fuori da un progetto con docs/ non blocca niente", async () => {
		const { chiama } = carica(casa);
		const cwd = cartella("vuota", { "index.ts": "x\n" });
		expect(await chiama("read", { path: "index.ts" }, capo(cwd))).toBeUndefined();
	});

	test("un operaio legge il codice", async () => {
		const { chiama } = carica(casa);
		const cwd = avviato();
		expect(await chiama("read", { path: "src/index.ts" }, operaio(cwd))).toBeUndefined();
	});

	test("un referente legge il codice", async () => {
		const { chiama } = carica(casa);
		const cwd = avviato();
		expect(await conNome("referente-mag", () => chiama("read", { path: "src/index.ts" }, referente(cwd)))).toBeUndefined();
	});

	test("solo il capo riceve le istruzioni di capo", async () => {
		const { prompt } = carica(casa);
		const cwd = avviato();
		expect(await prompt(capo(cwd))).toContain("sei il CAPO");
		expect(await prompt(operaio(cwd))).not.toContain("sei il CAPO");
		expect(await conNome("referente-mag", () => prompt(referente(cwd)))).not.toContain("sei il CAPO");
	});

	test("capo e referenti sanno come sono fatti i documenti, gli operai no", async () => {
		const { prompt } = carica(casa);
		const cwd = avviato();
		const marker = "## Spezzare un documento che sfonda il tetto";
		expect(await prompt(capo(cwd))).toContain(marker);
		expect(await conNome("referente-mag", () => prompt(referente(cwd)))).toContain(marker);
		expect(await prompt(operaio(cwd))).not.toContain(marker);
	});

test("grep/find/ls senza path sono il cwd: il capo non li usa sul codice", async () => {
		const { chiama } = carica(casa);
		const cwd = cartella("codice", { "docs/STATO.md": "# Stato\n", "src/index.ts": "x\n" });
		expect(await chiama("grep", { pattern: "x" }, capo(cwd))).toMatchObject({ block: true });
		expect(await chiama("find", { pattern: "*.ts" }, capo(cwd))).toMatchObject({ block: true });
		expect(await chiama("ls", {}, capo(cwd))).toMatchObject({ block: true });
	});

	test("in questo pacchetto il capo legge il codice e non prende le istruzioni di capo", async () => {
		const { chiama, prompt } = carica(casa);
		const cwd = cartella("prodotto", {
			"package.json": JSON.stringify({ name: "pi-software-house" }) + "\n",
			"docs/STATO.md": "# Stato\n",
			"extensions/casa.ts": "export default function () {}\n",
		});
		expect(await chiama("read", { path: "extensions/casa.ts" }, capo(cwd))).toBeUndefined();
		expect(await prompt(capo(cwd))).not.toContain("sei il CAPO");
	});

	test("dopo un referente il capo resta capo", async () => {
		const { chiama, prompt } = carica(casa);
		const cwd = cartella("codice", { "docs/STATO.md": "# Stato\n", "src/index.ts": "x\n" });
		expect(await conNome("referente-mag", () => chiama("read", { path: "src/index.ts" }, referente(cwd)))).toBeUndefined();
		expect(await chiama("read", { path: "src/index.ts" }, capo(cwd))).toMatchObject({ block: true });
		expect(await prompt(capo(cwd))).toContain("sei il CAPO");
	});

	test("la casa è divisa: regole per tutti e parte del capo", async () => {
	const { prompt } = carica(casa);
	const cwd = avviato();
	const tutti = await prompt(operaio(cwd));
	const capoTesto = await prompt(capo(cwd));
	expect(tutti).toContain("Regole di lavoro");
	expect(tutti).not.toContain("Quanto in grande");
	expect(capoTesto).toContain("Quanto in grande");
});
});

describe("allineamento di un progetto avviato", () => {
	test("chiede e poi manda il compito al capo", async () => {
		const { avvia, messaggi } = carica(casa);
		await avvia(capo(avviato(), sceglie("Sì, solo documenti")));
		expect(messaggi).toHaveLength(1);
		expect(messaggi[0]).toContain("Allineamento richiesto");
	});

	test("non chiede in un progetto che ha già la casa, e scritta", async () => {
		const { avvia, messaggi } = carica(casa);
		const cwd = allineato();
		await avvia(capo(cwd, sceglie("Sì, solo documenti")));
		expect(messaggi).toHaveLength(0);
		expect(await avvia(capo(cwd, sceglie("No, non chiedere più per questo progetto")))).toBeUndefined();
	});

	test("chiede anche se docs/ c'è ma è fatta diversamente", async () => {
		const { avvia, messaggi } = carica(casa);
		await avvia(capo(casaATema(), sceglie("Sì, solo documenti")));
		expect(messaggi).toHaveLength(1);
	});

	test("chiede anche se i 5 documenti ci sono ma sono ancora scheletri", async () => {
		const { eventi, avvia, messaggi } = carica(casa);
		let detto = "";
		await avvia(capo(scheletri(), ui(async (titolo) => (detto = titolo) && undefined)));
		expect(messaggi).toHaveLength(0);
		expect(detto).toContain("è ancora lo scheletro");
		expect(eventi.session_start).toHaveLength(1);
	});

	test("con anche il codice ordina la struttura un'area alla volta", async () => {
		const { avvia, messaggi } = carica(casa);
		await avvia(capo(avviato(), sceglie("Sì, anche il codice")));
		expect(messaggi).toHaveLength(1);
		expect(messaggi[0]).toContain("un'area alla volta");
	});

	test("non chiede in una cartella qualsiasi", async () => {
		const { avvia, messaggi } = carica(casa);
		await avvia(capo(cartella("qualsiasi"), sceglie("Sì, solo documenti")));
		expect(messaggi).toHaveLength(0);
	});

	test("non chiede a un operaio", async () => {
		const { avvia, messaggi } = carica(casa);
		await avvia(operaio(avviato()));
		expect(messaggi).toHaveLength(0);
	});

	test("se dice \"non ora\" lo richiede, se dice \"no\" non lo richiede più", async () => {
		const { avvia, messaggi } = carica(casa);
		const cwd = avviato();

		await avvia(capo(cwd, sceglie("Non ora, chiedimelo la prossima volta")));
		expect(messaggi).toHaveLength(0);

		let chiesto = false;
		const contaDomande = ui(async () => {
			chiesto = true;
			return undefined;
		});
		await avvia(capo(cwd, contaDomande));
		expect(chiesto).toBe(true);

		await avvia(capo(cwd, sceglie("No, non chiedere più per questo progetto")));
		chiesto = false;
		await avvia(capo(cwd, contaDomande));
		expect(chiesto).toBe(false);
	});
});

describe("un referente che scrive", () => {
	test("può creare una skill di progetto, non il codice", async () => {
		const { chiama } = carica(safetyGate);
		const cwd = avviato();
		const scrivi = (path: string) =>
			conNome("referente-mag", () => chiama("write", { path, content: "x" }, referente(cwd)));
		expect(await scrivi(".pi/skills/fatture/SKILL.md")).toBeUndefined();
		expect(await scrivi("docs/STATO.md")).toBeUndefined();
		expect(await scrivi("src/index.ts")).toMatchObject({ block: true });
	});
});

describe("i segreti", () => {
	test("non passano mai, i modelli di esempio sì", async () => {
		const { chiama } = carica(safetyGate);
		const cwd = avviato();
		const leggi = (path: string) => chiama("read", { path }, capo(cwd));
		expect(await leggi(".env")).toMatchObject({ block: true });
		expect(await leggi(".env.local")).toMatchObject({ block: true });
		expect(await leggi("chiavi/id_rsa")).toMatchObject({ block: true });
		expect(await leggi("certificati/server.pem")).toMatchObject({ block: true });
		expect(await leggi(".env.example")).toBeUndefined();
		expect(await leggi("chiavi/id_rsa.pub")).toBeUndefined();
	});
});

test("la skill progetto e' gia' nel prompt del capo", async () => {
	const { prompt } = carica(casa);
	const testo = await prompt(capo(avviato()));
	expect(testo).toContain("## Spezzare un documento che sfonda il tetto");
	expect(testo).toContain("docs/PROGETTO.md");
});
