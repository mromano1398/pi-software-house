/**
 * La casa del software.
 *
 * Inietta il manuale (manual/casa.md) nel system prompt a ogni turno.
 *
 * Perche' un'estensione e non un AGENTS.md: un pi package non puo' installare
 * un file di contesto globale. L'estensione invece lo fa sempre, in modo
 * deterministico, senza dipendere dal fatto che il modello decida di leggere
 * una skill. Il testo e' identico a ogni turno, quindi resta in cache.
 *
 * A un sub-agente (referente) arriva solo la parte "regole per tutti": il
 * ruolo glielo da' il suo file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MARKER = "# Se sei la SESSIONE PRINCIPALE";

const HERE = dirname(fileURLToPath(import.meta.url));

function loadManual(): { comuni: string; capo: string } | null {
	const candidates = [
		join(HERE, "..", "manual", "casa.md"),
		join(HERE, "..", "..", "manual", "casa.md"),
	];
	for (const path of candidates) {
		try {
			const text = readFileSync(path, "utf8");
			const at = text.indexOf(MARKER);
			if (at === -1) return { comuni: text, capo: "" };
			return { comuni: text.slice(0, at).trimEnd(), capo: text.slice(at).trimEnd() };
		} catch {
			// prova il prossimo percorso
		}
	}
	return null;
}

const manual = loadManual();

export default function (pi: ExtensionAPI) {
	if (!manual) return;

	const isSubagent = Boolean(process.env.PI_SUBAGENT_NAME);

	pi.on("before_agent_start", async (event) => {
		const testo = isSubagent || !manual.capo ? manual.comuni : `${manual.comuni}\n\n---\n\n${manual.capo}`;
		const base = event.systemPrompt ? `${event.systemPrompt}\n\n` : "";
		return { systemPrompt: `${base}${testo}` };
	});
}
