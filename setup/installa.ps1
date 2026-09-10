# Installa i pacchetti esterni e sistema il layout delle pane Herdr.
# Versione Windows. In alternativa, dentro Pi: /casa
#
#   powershell -ExecutionPolicy Bypass -File .\installa.ps1

$Qui = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentDir = if ($env:PI_CODING_AGENT_DIR) { $env:PI_CODING_AGENT_DIR } else { Join-Path $HOME ".pi\agent" }

Write-Host "== pacchetti esterni =="
$Pacchetti = @(
    @("npm:pi-herdr-agents",                    "pi-herdr-agents (referenti in pane Herdr)"),
    @("npm:@tintinweb/pi-subagents",            "@tintinweb/pi-subagents (operai)"),
    @("npm:pi-peer",                            "pi-peer (i referenti si parlano)"),
    @("git:github.com/DietrichGebert/ponytail", "ponytail (scrive meno codice)"),
    @("npm:@juicesharp/rpiv-ask-user-question", "ask-user-question (domande a opzioni)"),
    @("npm:pi-cache-guardian",                  "pi-cache-guardian (meno token)")
)

foreach ($p in $Pacchetti) {
    Write-Host ("  {0,-46} " -f $p[1]) -NoNewline
    pi install $p[0] *> $null
    if ($LASTEXITCODE -eq 0) { Write-Host "installato" } else { Write-Host "gia' presente o errore" }
}

Write-Host "== layout delle pane =="
$Cfg = Join-Path $AgentDir "npm\node_modules\pi-herdr-agents\config.json"
if (Test-Path (Split-Path -Parent $Cfg)) {
    @'
{
  "status": { "enabled": true },
  "models": { "agents": {} },
  "roles": { "bundled": false },
  "persistent": { "maxAgents": 3 },
  "supervision": { "forcePolling": false, "hangWarningMinutes": 15 },
  "panes": { "mode": "tab", "direction": "right", "maxPerTab": 2 }
}
'@ | Set-Content -Path $Cfg -Encoding UTF8
    Write-Host "  scritto in $Cfg"
} else {
    Write-Host "  salto: pi-herdr-agents non installato"
}

Write-Host "== filtro skill di pi-herdr-agents =="
node (Join-Path $Qui "filtro.mjs")

Write-Host ""
Write-Host "Fatto. Riavvia Pi."
