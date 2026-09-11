/**
 * Pure utility functions for plan mode.
 * Extracted for testability.
 */

// Destructive commands blocked in plan mode
const DESTRUCTIVE_PATTERNS = [
	/\brm\b/i,
	/\brmdir\b/i,
	/\bmv\b/i,
	/\bcp\b/i,
	/\bmkdir\b/i,
	/\btouch\b/i,
	/\bchmod\b/i,
	/\bchown\b/i,
	/\bchgrp\b/i,
	/\bln\b/i,
	/\btee\b/i,
	/\btruncate\b/i,
	/\bdd\b/i,
	/\bshred\b/i,
	/(^|[^<])>(?!>)/,
	/>>/,
	/\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
	/\byarn\s+(add|remove|install|publish)/i,
	/\bpnpm\s+(add|remove|install|publish)/i,
	/\bpip\s+(install|uninstall)/i,
	/\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
	/\bbrew\s+(install|uninstall|upgrade)/i,
	/\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)/i,
	/\bsudo\b/i,
	/\bsu\b/i,
	/\|\s*(sudo\s+)?(ba|z|k)?sh\b/i,
	/\|\s*(Invoke-Expression|iex)\b/i,
	/\bkill\b/i,
	/\bpkill\b/i,
	/\bkillall\b/i,
	/\breboot\b/i,
	/\bshutdown\b/i,
	/\bsystemctl\s+(start|stop|restart|enable|disable)/i,
	/\bservice\s+\S+\s+(start|stop|restart)/i,
	/\b(vim?|nano|emacs|code|subl)\b/i,
];

// Safe read-only commands allowed in plan mode
const SAFE_PATTERNS = [
	/^\s*cd\b/,
	/^\s*cat\b/,
	/^\s*head\b/,
	/^\s*tail\b/,
	/^\s*less\b/,
	/^\s*more\b/,
	/^\s*grep\b/,
	/^\s*find\b/,
	/^\s*ls\b/,
	/^\s*pwd\b/,
	/^\s*echo\b/,
	/^\s*printf\b/,
	/^\s*wc\b/,
	/^\s*sort\b/,
	/^\s*uniq\b/,
	/^\s*diff\b/,
	/^\s*file\b/,
	/^\s*stat\b/,
	/^\s*du\b/,
	/^\s*df\b/,
	/^\s*tree\b/,
	/^\s*which\b/,
	/^\s*whereis\b/,
	/^\s*type\b/,
	/^\s*uname\b/,
	/^\s*whoami\b/,
	/^\s*id\b/,
	/^\s*date\b/,
	/^\s*cal\b/,
	/^\s*uptime\b/,
	/^\s*ps\b/,
	/^\s*top\b/,
	/^\s*htop\b/,
	/^\s*free\b/,
	/^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get)/i,
	/^\s*git\s+ls-/i,
	/^\s*npm\s+(list|ls|view|info|search|outdated|audit)/i,
	/^\s*yarn\s+(list|info|why|audit)/i,
	/^\s*node\s+--version/i,
	/^\s*python\s+--version/i,
	/^\s*curl\s/i,
	/^\s*wget\s+-O\s*-/i,
	/^\s*jq\b/,
	/^\s*sed\s+-n/i,
	/^\s*awk\b/,
	/^\s*rg\b/,
	/^\s*fd\b/,
	/^\s*bat\b/,
	/^\s*eza\b/,
];

export function isSafeCommand(command: string): boolean {
	for (const pezzo of command.split(/&&|\|\||[;|]/)) {
		const p = pezzo.trim();
		if (!p) continue;
		const isDestructive = DESTRUCTIVE_PATTERNS.some((d) => d.test(p));
		const isSafe = SAFE_PATTERNS.some((d) => d.test(p));
		if (isDestructive || !isSafe) return false;
	}
	return true;
}

export interface TodoItem {
	step: number;
	text: string;
	completed: boolean;
}

export function cleanStepText(text: string): string {
	const cleaned = text
		.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1") // Remove bold/italic
		.replace(/`([^`]+)`/g, "$1") // Remove code
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200);
	return cleaned;
}

export function extractTodoItems(message: string): TodoItem[] {
	const items: TodoItem[] = [];
	const headerMatch = message.match(/\*{0,2}Plan:\*{0,2}\s*\n/i);
	if (!headerMatch) return items;

	const planSection = message.slice(message.indexOf(headerMatch[0]) + headerMatch[0].length);
	let prossimo = 1;
	const righe = planSection.split("\n");
	for (const riga of righe) {
		if (items.length >= 20) break;
		let numero: number | null = null;
		let testo: string | null = null;
		const num = riga.match(/^\s*(\d+)[.)]\s+(.+)$/);
		const step = riga.match(/^\s*(?:step\s+(\d+)\s*[:.-]\s*(.+)|[-*]\s+(?:\[[ x]\]\s*)?(.+))$/i);
		if (num) {
			numero = Number(num[1]);
			testo = num[2];
		} else if (step) {
			numero = step[1] ? Number(step[1]) : null;
			testo = step[2] ?? step[3] ?? "";
		}
		if (testo === null) continue;
		const pulito = testo
			.trim()
			.replace(/\*{1,2}$/, "")
			.trim();
		if (pulito.length < 6 || pulito.startsWith("`") || pulito.startsWith("/")) continue;
		const cleaned = cleanStepText(pulito);
		if (cleaned.length < 4) continue;
		if (numero === null || items.some((t) => t.step === numero)) {
			numero = prossimo;
		}
		prossimo = Math.max(prossimo, numero + 1);
		items.push({ step: numero, text: cleaned, completed: false });
	}
	return items.sort((a, b) => a.step - b.step);
}

export function extractDoneSteps(message: string): number[] {
	const steps: number[] = [];
	for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
		const step = Number(match[1]);
		if (Number.isFinite(step)) steps.push(step);
	}
	return steps;
}

export function markCompletedSteps(text: string, items: TodoItem[]): number {
	let fatti = 0;
	for (const step of new Set(extractDoneSteps(text))) {
		const item = items.find((t) => t.step === step);
		if (item && !item.completed) {
			item.completed = true;
			fatti++;
		}
	}
	return fatti;
}
