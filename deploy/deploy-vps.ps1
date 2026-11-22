# Compila crunchy en este PC y lo despliega en la VPS (sin compilar alla).
# Uso:  powershell -ExecutionPolicy Bypass -File deploy\deploy-vps.ps1 [-Server vps] [-SkipBuild]
# Requisitos: alias SSH "vps" en ~/.ssh/config y .env.production.local con
#             NEXT_PUBLIC_SITE_URL=https://www.orunei.sbs (y demas NEXT_PUBLIC_* de produccion).
param(
  [string]$Server = "vps",
  [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if (-not (Test-Path ".env.production.local")) {
  throw "Falta .env.production.local (al menos NEXT_PUBLIC_SITE_URL=https://www.orunei.sbs)."
}

if (-not $SkipBuild) {
  Write-Host "== Compilando (next build)..."
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "next build fallo" }
}

$sa = Join-Path $root ".next\standalone"
if (-not (Test-Path (Join-Path $sa "server.js"))) {
  throw "No existe .next\standalone\server.js (falta output: 'standalone' en next.config.ts?)"
}

Write-Host "== Preparando paquete standalone..."
# Copiar a carpetas limpias: si ya existen (deploy con -SkipBuild repetido), Copy-Item las
# anidaba (static\static) y el paquete crecía. Son salida del build, se regeneran siempre.
foreach ($pair in @(@(".next\static", ".next\static"), @("public", "public"))) {
  $src = $pair[0]; $dst = Join-Path $sa $pair[1]
  if (-not (Test-Path $src)) { continue }
  if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
  Copy-Item -Recurse -Force $src $dst
}

# Next guarda la ruta del gestor de cache (cacheHandlers) con barras de Windows al compilar
# en este PC ("..\\cache-handlers\\..."); en Linux esa ruta no existe. Se pasa a "/".
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($f in @((Join-Path $sa "server.js"), (Join-Path $sa ".next\required-server-files.json"))) {
  if (Test-Path $f) {
    $txt = [IO.File]::ReadAllText($f)
    $fixed = $txt -replace '\.\.\\\\cache-handlers\\\\', '../cache-handlers/'
    if ($fixed -ne $txt) { [IO.File]::WriteAllText($f, $fixed, $utf8); Write-Host "Ruta de cacheHandlers normalizada en $(Split-Path $f -Leaf)" }
  }
}
if (Select-String -Path (Join-Path $sa "server.js") -Pattern 'cache-handlers\\\\' -Quiet) { throw "Quedan rutas de cacheHandlers con barras de Windows" }

$release = Get-Date -Format "yyyyMMdd-HHmmss"
$tgz = Join-Path $env:TEMP "orunei-web-$release.tgz"
tar -czf $tgz -C $sa .
if ($LASTEXITCODE -ne 0) { throw "tar fallo" }
$sizeMB = [math]::Round((Get-Item $tgz).Length / 1MB, 1)
Write-Host "Paquete: $tgz ($sizeMB MB)"

Write-Host "== Subiendo a $Server..."
scp -q $tgz "${Server}:/tmp/orunei-web-$release.tgz"
if ($LASTEXITCODE -ne 0) { throw "scp fallo" }

Write-Host "== Activando release $release..."
ssh $Server "/opt/orunei-web/bin/activate-release.sh $release /tmp/orunei-web-$release.tgz"
$code = $LASTEXITCODE
Remove-Item $tgz -ErrorAction SilentlyContinue
if ($code -ne 0) { throw "La activacion fallo (se restauro el release anterior si existia)." }
Write-Host "== Deploy completado: $release"
