/**
 * Safety gate.
 *
 * Dentro il progetto: via libera (crea, modifica, cancella, git, script).
 * Si ferma e chiede solo per:
 *  - comandi di sistema (sudo, mkfs, dd su disco, reboot, pipe-to-shell, publish, prune)
 *  - comandi distruttivi puntati FUORI dal progetto
 *  - "cancella tutto" (rm -rf ., git reset --hard, ...) anche dentro il progetto
 *  - lettura o scrittura FUORI dal progetto
 *  - force-push su main
 * Segreti e chiavi: rifiutati sempre.
 *
 * Vale sia per la shell di Unix (`bash`) sia per PowerShell/cmd su Windows.
 *
 * /safety off|on|status
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import os from "node:os";
import path from "node:path";

type Rule = { name: string; re: RegExp };

/** I tool che eseguono comandi: bash su Unix, powershell su Windows. */
const SHELL_TOOLS = new Set(["bash", "powershell"]);

const SYSTEM_LEVEL: Rule[] = [
	// Unix
	{ name: "sudo", re: /(^|[;&|(]\s*)sudo\b/i },
	{ name: "mkfs/wipefs", re: /\b(mkfs(\.\w+)?|wipefs)\b/i },
	{ name: "dd to disk", re: /\bdd\b[^\n]*\bof=\/dev\//i },
	{ name: "pipe to shell", re: /\b(curl|wget|fetch)\b[\s\S]{0,300}\|\s*(ba|z|k)?sh\b/i },
	{ name: "shutdown/reboot", re: /\b(reboot|shutdown|halt|poweroff|init\s+0)\b/i },
	{ name: "publish", re: /\b(npm|pnpm|yarn)\s+publish\b|\btwine\s+upload\b|\bcargo\s+publish\b/i },
	{ name: "docker prune", re: /\bdocker\s+(system\s+)?prune\b/i },
	{ name: "force push to main", re: /\bgit\s+push\b[^\n]*\s(--force|-f)\b[^\n]*\b(main|master)\b/i },
	// Windows / PowerShell
	{ name: "formattazione disco", re: /\b(Format-Volume|Clear-Disk|Initialize-Disk|diskpart)\b/i },
	{ name: "spegnimento/riavvio", re: /\b(Stop-Computer|Restart-Computer)\b/i },
	{ name: "pipe to shell (PS)", re: /\b(Invoke-WebRequest|iwr|curl)\b[\s\S]{0,300}\|\s*(Invoke-Expression|iex)\b/i },
	{ name: "esecuzione di script remoti", re: /\b(Invoke-Expression|iex)\b[^\n]*\b(Invoke-WebRequest|iwr|DownloadString)\b/i },
	{ name: "execution policy", re: /\bSet-ExecutionPolicy\b/i },
	{ name: "publish (PS)", re: /\b(npm|pnpm|yarn|dotnet)\s+(publish|nuget\s+push)\b/i },
	{ name: "force push to main (PS)", re: /\bgit\s+push\b[^\n]*\s(--force|-f)\b[^\n]*\b(main|master)\b/i },
];

const WIPE_ALL: Rule[] = [
	// Unix
	{ name: "rm -rf sulla cartella corrente", re: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+(\.\/?|\*|\$PWD|"\$PWD"|\$\(pwd\))\s*$/i },
	{ name: "rm -rf su una cartella dell'utente", re: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+~\//i },
	{ name: "git reset --hard", re: /\bgit\s+reset\s+[^\n]*--hard\b/i },
	{ name: "git clean -fdx", re: /\bgit\s+clean\b[^\n]*-[a-zA-Z]*[fd][a-zA-Z]*/i },
	{ name: "find -delete", re: /\bfind\b[^\n]*-delete\b/i },
	{ name: "svuota la cartella", re: /\b(shred|truncate)\b[^\n]*\s(\.|\*)(\s|$)/i },
	// Windows / PowerShell / cmd
	{ name: "Remove-Item -Recurse -Force .", re: /\bRemove-Item\b[^\n]*-[^\n]*(Recurse|Force)[^\n]*\s(\.|\*)(\s|$)/i },
	{ name: "rm -r -fo (alias PS)", re: /\brm\s+-[a-zA-Z-]*r[a-zA-Z-]*\s*-?fo?\s*(\.|\*)(\s|$)/i },
	{ name: "del /s /q", re: /\b(del|erase)\b[^\n]*\/(s|q)/i },
	{ name: "rmdir /s /q", re: /\b(rmdir|rd)\b[^\n]*\/s/i },
	{ name: "git reset --hard (PS)", re: /\bgit\s+reset\s+[^\n]*--hard\b/i },
	{ name: "cancella la cartella dell'utente", re: /\bRemove-Item\b[^\n]*\$HOME\b/i },
];

/** Cartelle di sistema: scrittura sempre rifiutata. */
function systemRoots(): string[] {
	const roots = [
		path.join(os.homedir(), ".ssh"),
		path.join(os.homedir(), ".gnupg"),
		path.join(os.homedir(), ".pi", "agent", "auth.json"),
		"/etc",
		"/usr",
		"/bin",
		"/sbin",
		"/boot",
		"/var",
	];
	const win = process.env.SystemRoot || process.env.WINDIR;
	if (win) roots.push(win);
	for (const key of ["ProgramFiles", "ProgramFiles(x86)", "ProgramData"]) {
		const v = process.env[key];
		if (v) roots.push(v);
	}
	return roots;
}

const SECRET_BASENAMES = new Set([
	"id_rsa",
	"id_dsa",
	"id_ecdsa",
	"id_ed25519",
	"auth.json",
	".netrc",
	".pgpass",
	"credentials",
]);
const SECRET_EXT = /\.(pem|p12|pfx|key|keystore|jks)$/i;

const DESTRUCTIVE_CMD =
	/\b(rm|rmdir|mv|chmod|chown|truncate|shred|tee)\b|(^|\s)>\s*\/|\b(Remove-Item|del|erase|rd|Move-Item|Set-Content|Clear-Content|Out-File)\b/i;

/** Gli unici percorsi che un referente può scrivere: assunzioni e documenti. */
const REFERENT_WRITABLE = [
	path.join(".agents", "agents"),
	"docs",
	// nomi vecchi, ancora accettati
	"PLAN.md",
	"DECISIONS.md",
	"PROJECT.md",
];

const READ_TOOLS = new Set(["read", "grep", "find", "ls"]);
const WRITE_TOOLS = new Set(["write", "edit"]);

function resolvePath(p: string, cwd: string): string {
	if (!p) return "";
	const expanded = p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
	return path.resolve(cwd, expanded);
}

function isSecretPath(abs: string): boolean {
	const base = path.basename(abs);
	if (base.endsWith(".pub") || base === ".env.example" || base === ".env.sample") return false;
	if (SECRET_BASENAMES.has(base)) return true;
	return SECRET_EXT.test(base);
}

function isProtectedRoot(abs: string): boolean {
	return systemRoots().some((blocked) => abs === blocked || abs.startsWith(blocked + path.sep));
}

function insideProject(abs: string, cwd: string): boolean {
	const root = cwd.endsWith(path.sep) ? cwd : cwd + path.sep;
	return abs === cwd || abs.startsWith(root);
}

/** Percorsi assoluti o ~/ citati in un comando: Unix e Windows. */
function externalTargets(command: string, cwd: string): string[] {
	const found: string[] = [];
	const re = /(?:^|\s)(~\/[^\s;|&)'"]*|\/[A-Za-z0-9._/-]+|[A-Za-z]:[\\/][^\s;|&)'"]*)/g;
	for (const m of command.matchAll(re)) {
		const abs = resolvePath(m[1], cwd);
		if (!insideProject(abs, cwd)) found.push(abs);
	}
	return found;
}

export default function (pi: ExtensionAPI) {
	let enabled = true;
	const sessionAllow = new Set<string>();

	pi.registerCommand("safety", {
		description: "Safety gate: /safety on|off|status",
		handler: async (args, ctx) => {
			const cmd = (args ?? "").trim().toLowerCase();
			if (cmd === "off") {
				enabled = false;
				ctx.ui.notify("Safety gate off", "warning");
				return;
			}
			if (cmd === "on") {
				enabled = true;
				ctx.ui.notify("Safety gate on", "info");
				return;
			}
			ctx.ui.notify(`Safety gate: ${enabled ? "on" : "off"}`, "info");
		},
	});

	async function ask(ctx: ExtensionContext, title: string, rule: string) {
		if (sessionAllow.has(rule)) return undefined;
		// Un sub-agente non interroga mai l'utente: riferisce al suo superiore.
		if (!ctx.hasUI || process.env.PI_SUBAGENT_NAME) {
			return {
				block: true as const,
				reason: `${title}\n\nServe l'autorizzazione del tuo superiore (referente o capo). Non chiedere all'utente: chiedi e fermati.`,
			};
		}
		const choice = await ctx.ui.select(`${title}\n\nAllow?`, ["No", "Yes, this time", "Yes, this session"]);
		if (choice === "Yes, this session") {
			sessionAllow.add(rule);
			return undefined;
		}
		if (choice === "Yes, this time") return undefined;
		return { block: true as const, reason: `Bloccato: ${rule}` };
	}

	pi.on("tool_call", async (event, ctx) => {
		if (!enabled) return undefined;

		if (SHELL_TOOLS.has(event.toolName)) {
			const command = String(event.input.command ?? "");

			const sys = SYSTEM_LEVEL.find((r) => r.re.test(command));
			if (sys) return ask(ctx, `Comando di sistema (${sys.name}):\n\n  ${command}`, sys.name);

			const wipe = WIPE_ALL.find((r) => r.re.test(command));
			if (wipe) return ask(ctx, `Sta per cancellare tutto (${wipe.name}):\n\n  ${command}`, wipe.name);

			if (DESTRUCTIVE_CMD.test(command)) {
				const outside = externalTargets(command, ctx.cwd);
				if (outside.length) {
					return ask(
						ctx,
						`Comando distruttivo fuori dal progetto:\n\n  ${command}\n\n  → ${outside.join("\n  → ")}`,
						"outside",
					);
				}
			}
			return undefined;
		}

		const raw = String(event.input.path ?? event.input.file_path ?? "");
		if (!raw) return undefined;
		const abs = resolvePath(raw, ctx.cwd);

		// Un referente (sub-agente pi-herdr) non scrive codice: assume operai e
		// tiene i documenti. Tutto il resto è bloccato.
		if (process.env.PI_SUBAGENT_NAME && WRITE_TOOLS.has(event.toolName)) {
			const canWrite = REFERENT_WRITABLE.some((rel) => {
				const target = path.resolve(ctx.cwd, rel);
				return abs === target || abs.startsWith(target + path.sep);
			});
			if (!canWrite) {
				if (ctx.hasUI) ctx.ui.notify(`Referente: scrittura bloccata su ${abs}`, "warning");
				return {
					block: true,
					reason:
						"Un referente non scrive codice. Può solo creare operai in .agents/agents/ e aggiornare i documenti in docs/. Il codice lo scrive un operaio.",
				};
			}
			return undefined;
		}

		if (isSecretPath(abs) || isProtectedRoot(abs)) {
			if (ctx.hasUI) ctx.ui.notify(`Percorso protetto: ${abs}`, "warning");
			return { block: true, reason: `Percorso protetto: ${raw}` };
		}

		if (READ_TOOLS.has(event.toolName)) {
			if (!insideProject(abs, ctx.cwd)) {
				return ask(ctx, `Lettura fuori dal progetto:\n\n  ${abs}`, `read-outside:${path.dirname(abs)}`);
			}
			return undefined;
		}

		if (WRITE_TOOLS.has(event.toolName)) {
			if (!insideProject(abs, ctx.cwd)) {
				return ask(ctx, `Scrittura fuori dal progetto:\n\n  ${abs}`, `write-outside:${path.dirname(abs)}`);
			}
			return undefined;
		}

		return undefined;
	});
}
