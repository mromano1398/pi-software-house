#!/usr/bin/env node
/**
 * Toglie la skill `orchestrate` di pi-herdr-agents, che va in conflitto con
 * la squadra descritta in manual/casa.md.
 *
 * Si usa node (non python) perché node c'è per forza: Pi gira su node.
 * Vale su Linux, macOS e Windows.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const file = process.argv[2] || join(agentDir, "settings.json");

let settings = {};
if (existsSync(file)) {
	try {
		settings = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		settings = {};
	}
}

const pacchetti = [];
let fatto = false;
for (const voce of settings.packages ?? []) {
	const sorgente = typeof voce === "string" ? voce : voce?.source;
	if (typeof sorgente === "string" && sorgente.includes("pi-herdr-agents")) {
		if (!fatto) {
			pacchetti.push({ source: "npm:pi-herdr-agents", skills: [] });
			fatto = true;
		}
	} else {
		pacchetti.push(voce);
	}
}
if (!fatto) pacchetti.push({ source: "npm:pi-herdr-agents", skills: [] });

settings.packages = pacchetti;
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
console.log(`  filtro applicato in ${file}`);
