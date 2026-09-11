/**
 * Git Checkpoint Extension
 *
 * Crea checkpoint git a ogni turno cosi' /fork puo' ripristinare il codice.
 * La mappa vive su disco (.pi/team/checkpoints.json): sopravvive al restart
 * e alla fine della run, quando il fork serve davvero.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function dirCheck(cwd: string): string {
	return join(cwd, ".pi", "team");
}

function fileCheck(cwd: string): string {
	return join(dirCheck(cwd), "checkpoints.json");
}

function leggi(cwd: string): Record<string, string> {
	try {
		const d = JSON.parse(readFileSync(fileCheck(cwd), "utf8"));
		if (d && typeof d === "object") return d;
	} catch {
		// niente checkpoint: il fork tiene il codice com'e'
	}
	return {};
}

function scrivi(cwd: string, m: Record<string, string>): void {
	try {
		mkdirSync(dirCheck(cwd), { recursive: true });
		const chiavi = Object.keys(m).sort();
		// ponytail: tetto ai checkpoint, i vecchi non servono al fork
		const potati: Record<string, string> = {};
		for (const k of chiavi.slice(-50)) potati[k] = m[k]!;
		writeFileSync(fileCheck(cwd), `${JSON.stringify(potati)}\n`, "utf8");
	} catch {
		// senza memoria il fork tiene il codice com'e'
	}
}

export default function (pi: ExtensionAPI) {
	let currentEntryId: string | undefined;

	// Track the current entry ID when user messages are saved
	pi.on("tool_result", async (_event, ctx) => {
		try {
			const leaf = ctx.sessionManager.getLeafEntry();
			if (leaf) currentEntryId = leaf.id;
		} catch {
			// senza entry niente checkpoint per questo turno
		}
	});

	pi.on("turn_start", async (_event, ctx) => {
		// Fuori da un repo o senza modifiche non c'e' niente da salvare.
		let ref = "";
		try {
			const r = await pi.exec("git", ["stash", "create"]);
			if (r.code !== 0) return;
			ref = r.stdout.trim();
		} catch {
			return;
		}
		if (!ref || !currentEntryId) return;
		const cwd = (ctx as any)?.cwd ?? process.cwd();
		if (!existsSync(join(cwd, ".git"))) return;
		const m = leggi(cwd);
		m[currentEntryId] = ref;
		scrivi(cwd, m);
	});

	pi.on("session_before_fork", async (event, ctx) => {
		const cwd = (ctx as any)?.cwd ?? process.cwd();
		const ref = leggi(cwd)[event.entryId];
		if (!ref) return;

		if (!ctx.hasUI) {
			// In non-interactive mode, don't restore automatically
			return;
		}

		const choice = await ctx.ui.select("Restore code state?", [
			"Yes, restore code to that point",
			"No, keep current code",
		]);

		if (choice?.startsWith("Yes")) {
			try {
				const r = await pi.exec("git", ["stash", "apply", ref]);
				if (r.code !== 0) {
					ctx.ui.notify(`Checkpoint non ripristinato: ${r.stderr || r.stdout}`, "error");
					return;
				}
				ctx.ui.notify("Code restored to checkpoint", "info");
			} catch {
				ctx.ui.notify("Checkpoint non ripristinato.", "error");
			}
		}
	});
}
