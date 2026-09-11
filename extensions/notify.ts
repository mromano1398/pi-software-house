/**
 * Pi Notify Extension
 *
 * Sends a native terminal notification when Pi agent is done and waiting for input.
 * Supports multiple terminal protocols:
 * - OSC 777: Ghostty, iTerm2, WezTerm, rxvt-unicode
 * - OSC 99: Kitty
 * - Windows toast: Windows Terminal (WSL)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";

function windowsToastScript(title: string, body: string): string {
	const type = "Windows.UI.Notifications";
	const mgr = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
	const template = `[${type}.ToastTemplateType]::ToastText01`;
	const toast = `[${type}.ToastNotification]::new($xml)`;
	return [
		`${mgr} > $null`,
		`$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
		`$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${body}')) > $null`,
		`[${type}.ToastNotificationManager]::CreateToastNotifier('${title}').Show(${toast})`,
	].join("; ");
}

function notifyOSC777(title: string, body: string): void {
	process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
}

function notifyOSC99(title: string, body: string): void {
	// Kitty OSC 99: i=notification id, d=0 means not done yet, p=body for second part
	process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
	process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}

function notificaWindows(title: string, body: string): void {
	execFile("powershell.exe", ["-NoProfile", "-Command", windowsToastScript(title, body)]);
}

function esc(s: string): string {
	return s.replace(/[;\x1b\x07\n]/g, " ").slice(0, 200);
}

function notify(title: string, body: string): void {
	const t = esc(title);
	const b = esc(body);
	if (process.env.WT_SESSION) {
		notificaWindows(t, b);
	} else if (process.env.KITTY_WINDOW_ID) {
		notifyOSC99(t, b);
	} else {
		notifyOSC777(t, b);
	}
}

export default function (pi: ExtensionAPI) {
	// `agent_end` fires after each low-level run; Pi may still retry, compact,
	// or continue with queued follow-ups. Notify only after the full run settles.
	// Solo il capo avvisa il committente: gli operai nested non hanno UI e i
	// referenti rispondono nel bus, non con una notifica all'utente.
	pi.on("agent_settled", async (_event, ctx) => {
		if (process.env.PI_SUBAGENT_NAME) return;
		if (ctx && !(ctx as any).hasUI) return;
		notify("Pi", "Ready for input");
	});
}
