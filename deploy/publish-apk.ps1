# Publica la APK de KAZE Mobile en la VPS y avisa a las apps instaladas.
#
# Uso (desde la carpeta crunchy):
#   powershell -ExecutionPolicy Bypass -File deploy\publish-apk.ps1 -Notes "Qué cambió en esta versión"
#   ... -Build            compila la versión release antes de publicar
#   ... -Required         obliga a actualizar (las versiones viejas no pueden cerrar el aviso)
#
# Antes de publicar, sube versionCode en mobile/app/build.gradle.kts: las apps solo avisan si
# el versionCode publicado es MAYOR que el suyo.
param(
    [string]$Server = "vps",
    [string]$Notes = "",
    [switch]$Build,
    [switch]$Required
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root "mobile"
$gradleFile = Join-Path $mobile "app\build.gradle.kts"
$apk = Join-Path $mobile "app\build\outputs\apk\release\app-release.apk"

$gradle = Get-Content $gradleFile -Raw
$code = [int]([regex]::Match($gradle, 'versionCode\s*=\s*(\d+)').Groups[1].Value)
$name = [regex]::Match($gradle, 'versionName\s*=\s*"([^"]+)"').Groups[1].Value
if (-not $code) { throw "No encontré versionCode en $gradleFile" }

if ($Build) {
    Write-Host "== Compilando release $name ($code)... (no abras el emulador mientras tanto)"
    if (-not $env:JAVA_HOME) { $env:JAVA_HOME = (Get-ChildItem "C:\Program Files\Microsoft" -Directory -Filter "jdk-17*" | Select-Object -First 1).FullName }
    Push-Location $mobile
    try {
        & .\gradlew.bat --no-daemon --max-workers=2 "-Dorg.gradle.jvmargs=-Xmx2560m -Dfile.encoding=UTF-8" -Pkotlin.compiler.execution.strategy=in-process assembleRelease
        if ($LASTEXITCODE -ne 0) { throw "La compilación falló" }
    } finally { Pop-Location }
}
if (-not (Test-Path $apk)) { throw "No existe $apk (usa -Build)" }

$info = [ordered]@{
    versionCode    = $code
    versionName    = $name
    # ?v= evita que Cloudflare entregue una APK vieja guardada en caché.
    url            = "https://www.orunei.sbs/kaze.apk?v=$code"
    notes          = $Notes
    minVersionCode = $(if ($Required) { $code } else { 0 })
}
$json = Join-Path $env:TEMP "app-version.json"
[System.IO.File]::WriteAllText($json, ($info | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false))

Write-Host "== Subiendo $name ($code) a $Server..."
scp $apk "${Server}:/tmp/kaze.apk"
scp $json "${Server}:/tmp/app-version.json"
# Primero la APK y después el JSON: así nadie recibe el aviso antes de que la APK nueva esté lista.
ssh $Server "set -e; d=/opt/orunei-web/shared/downloads; mkdir -p `$d; install -m 644 /tmp/kaze.apk `$d/kaze.apk; install -m 644 /tmp/app-version.json `$d/app-version.json; rm -f /tmp/kaze.apk /tmp/app-version.json; sha256sum `$d/kaze.apk"
Write-Host "== Publicada. Comprobación:"
(Invoke-WebRequest -UseBasicParsing "https://www.orunei.sbs/app-version.json?t=$(Get-Random)").Content
