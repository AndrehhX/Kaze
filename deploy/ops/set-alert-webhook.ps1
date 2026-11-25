# Guarda el webhook de Discord para los avisos de caídas en los dos vigilantes:
#   - la VPS (/etc/orunei-ops/alerts.env)
#   - el Worker externo orunei-monitor (secreto de Cloudflare)
# El webhook no se escribe en el repo ni queda en el historial de PowerShell.
#
# Crear el webhook: Discord → canal privado → Editar canal → Integraciones → Webhooks → Nuevo → Copiar URL.
# Uso: powershell -ExecutionPolicy Bypass -File deploy\ops\set-alert-webhook.ps1
$ErrorActionPreference = "Stop"

$sec = Read-Host "Pega la URL del webhook de Discord" -AsSecureString
$url = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
if ($url -notmatch '^https://(discord|discordapp)\.com/api/webhooks/\d+/[\w-]+$') {
  throw "Eso no parece una URL de webhook de Discord."
}

# 1) VPS: se envía por stdin, no como argumento (no aparece en la lista de procesos).
$url | ssh vps "read -r u; umask 077; printf '# Webhook de Discord para avisos (canal privado)\nDISCORD_ALERT_WEBHOOK_URL=%s\n' `"`$u`" > /etc/orunei-ops/alerts.env; echo ok-vps"

# 2) Cloudflare: secreto del Worker.
Push-Location "$PSScriptRoot\..\monitor-worker"
try { $url | npx wrangler secret put DISCORD_ALERT_WEBHOOK_URL } finally { Pop-Location }

# 3) Mensaje de prueba.
$body = @{ username = "KAZE · vigilante"; content = "✅ Avisos activados: la VPS y el monitor de Cloudflare avisarán aquí si algo se cae." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
Write-Host "Listo. Debería haberte llegado un mensaje de prueba a Discord."
