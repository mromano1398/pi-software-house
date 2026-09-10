#!/usr/bin/env bash
# Installa i pacchetti esterni e sistema il layout delle pane Herdr.
# Serve solo per le macchine senza interfaccia: normalmente lo fa /casa.
set -e

AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

echo "== pacchetti esterni =="
installa() {
  local sorgente="$1" nome="$2"
  printf '  %-38s ' "$nome"
  if pi install "$sorgente" >/dev/null 2>&1; then
    echo "installato"
  else
    echo "gia' presente o errore"
  fi
}

installa "npm:pi-herdr-agents"              "pi-herdr-agents (referenti in pane)"
installa "npm:@tintinweb/pi-subagents"      "@tintinweb/pi-subagents (operai)"
installa "npm:pi-peer"                      "pi-peer (i referenti si parlano)"
installa "git:github.com/DietrichGebert/ponytail" "ponytail (meno codice)"
installa "npm:@juicesharp/rpiv-ask-user-question" "ask-user-question (domande a opzioni)"
installa "npm:pi-cache-guardian"            "pi-cache-guardian (meno token)"

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
python3 - "$AGENT_DIR/settings.json" <<'PY'
import json, sys, pathlib
p = pathlib.Path(sys.argv[1])
d = json.loads(p.read_text()) if p.exists() else {}
out, seen = [], False
for e in d.get("packages") or []:
    src = e.get("source") if isinstance(e, dict) else e
    if isinstance(src, str) and "pi-herdr-agents" in src:
        if not seen:
            out.append({"source": "npm:pi-herdr-agents", "skills": []})
            seen = True
    else:
        out.append(e)
if not seen:
    out.append({"source": "npm:pi-herdr-agents", "skills": []})
d["packages"] = out
p.write_text(json.dumps(d, indent=2) + "\n")
print("  settings.json aggiornato")
PY

echo
echo "Fatto. Riavvia Pi."
