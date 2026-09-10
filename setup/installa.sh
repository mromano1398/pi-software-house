#!/usr/bin/env bash
# Installa i pacchetti esterni e sistema il layout delle pane Herdr.
# Su Linux e macOS. Su Windows usa installa.ps1, oppure /casa dentro Pi.
set -e

QUI="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

echo "== pacchetti esterni =="
installa() {
  printf '  %-42s ' "$2"
  if pi install "$1" >/dev/null 2>&1; then
    echo "installato"
  else
    echo "gia' presente o errore"
  fi
}

installa "npm:pi-herdr-agents"                    "pi-herdr-agents (referenti in pane Herdr)"
installa "npm:@tintinweb/pi-subagents"            "@tintinweb/pi-subagents (operai)"
installa "npm:pi-peer"                            "pi-peer (i referenti si parlano)"
installa "git:github.com/DietrichGebert/ponytail" "ponytail (scrive meno codice)"
installa "npm:@juicesharp/rpiv-ask-user-question" "ask-user-question (domande a opzioni)"
installa "npm:pi-cache-guardian"                  "pi-cache-guardian (meno token)"

echo "== layout delle pane =="
CFG="$AGENT_DIR/npm/node_modules/pi-herdr-agents/config.json"
if [ -d "$(dirname "$CFG")" ]; then
  cat > "$CFG" <<'JSON'
{
  "status": { "enabled": true },
  "models": { "agents": {} },
  "roles": { "bundled": false },
  "persistent": { "maxAgents": 3 },
  "supervision": { "forcePolling": false, "hangWarningMinutes": 15 },
  "panes": { "mode": "tab", "direction": "right", "maxPerTab": 2 }
}
JSON
  echo "  scritto in $CFG"
else
  echo "  salto: pi-herdr-agents non installato"
fi

echo "== filtro skill di pi-herdr-agents =="
node "$QUI/filtro.mjs"

echo
echo "Fatto. Riavvia Pi."
