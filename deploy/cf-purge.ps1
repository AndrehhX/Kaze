# Purga la cache de Cloudflare de orunei.sbs sin entrar al panel.
#
# Uso (desde la carpeta crunchy):
#   powershell -ExecutionPolicy Bypass -File deploy\cf-purge.ps1                 # purga todo el sitio
#   powershell -ExecutionPolicy Bypass -File deploy\cf-purge.ps1 -Urls "https://www.orunei.sbs/","https://www.orunei.sbs/calendario"
#
# Necesita un token de API de Cloudflare con el permiso "Zone > Cache Purge > Purge" solo para orunei.sbs,
# guardado en la variable de entorno de usuario CLOUDFLARE_API_TOKEN (nunca en el repo):
#   [Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "EL_TOKEN", "User")
# Si no hay token, avisa y termina sin error (deploy-vps.ps1 lo llama al final y no debe fallar por esto).
param(
    [string[]]$Urls = @(),
    [string]$ZoneId = $(if ($env:CLOUDFLARE_ZONE_ID) { $env:CLOUDFLARE_ZONE_ID } else { "ef54c9f98805bd8d6d0dc1f414fc88fd" })  # orunei.sbs (no es secreto)
)
$ErrorActionPreference = "Stop"

$token = $env:CLOUDFLARE_API_TOKEN
if (-not $token) { $token = [Environment]::GetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "User") }
if (-not $token) {
    Write-Host "== Cloudflare: sin CLOUDFLARE_API_TOKEN, no se purga la cache (prueba la web con ?t=1)." -ForegroundColor Yellow
    exit 0
}

if ($Urls.Count -gt 0) {
    $body = @{ files = $Urls } | ConvertTo-Json -Compress
    $what = "$($Urls.Count) URL(s)"
} else {
    $body = '{"purge_everything":true}'
    $what = "todo el sitio"
}

try {
    $res = Invoke-RestMethod -Method Post -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/purge_cache" `
        -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
    if ($res.success) {
        Write-Host "== Cloudflare: cache purgada ($what)." -ForegroundColor Green
    } else {
        Write-Host "== Cloudflare: no se pudo purgar: $($res.errors | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "== Cloudflare: error al purgar: $($_.Exception.Message)" -ForegroundColor Yellow
}
