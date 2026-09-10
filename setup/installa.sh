#!/usr/bin/env bash
# Installa le dipendenze esterne e sistema il layout delle pane Herdr.
# Va lanciato UNA volta per macchina, dopo `pi install`.
set -e

AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

echo "== pacchetti esterni =="
for p in pi-herdr-agents @tintinweb/pi-subagents pi-peer pi-cache-guardian; do
  echo "-- $p"
  pi install "npm:$p" >/dev/null 2>&1 && echo "   installato" || echo "   già presente o errore"
done

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
  echo "   scritto in $CFG"
else
  echo "   salto: pi-herdr-agents non installato"
fi

echo "== filtro skill di pi-herdr-agents =="
python3 - "$AGENT_DIR/settings.json" <<'PY'
import json, sys, pathlib
p = pathlib.Path(sys.argv[1])
d = json.loads(p.read_text()) if p.exists() else {}
pkgs = d.get("packages") or []
out, seen = [], False
for e in pkgs:
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
print("   settings.json aggiornato")
PY

echo
echo "Fatto. Riavvia Pi."
