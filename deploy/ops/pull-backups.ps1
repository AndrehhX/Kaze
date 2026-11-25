# Descarga al PC las copias de Supabase de la VPS (por si la VPS desaparece).
# Solo baja lo que falta; no borra nada ni en el PC ni en la VPS.
# Uso: powershell -ExecutionPolicy Bypass -File deploy\ops\pull-backups.ps1 [-Dest "D:\copias-kaze"]
param([string]$Dest = "$env:USERPROFILE\Documents\KAZE-copias")
$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force "$Dest\db" | Out-Null
$remote = (ssh vps "ls /var/backups/orunei/db/") -split "`n" | Where-Object { $_ -match '\.json\.gz$' }
$nuevas = 0
foreach ($f in $remote) {
  $f = $f.Trim()
  if (-not (Test-Path "$Dest\db\$f")) {
    scp "vps:/var/backups/orunei/db/$f" "$Dest\db\$f"
    $nuevas++
  }
}
# Archivos de Storage (avatares, banners…): copia completa de la carpeta.
scp -r "vps:/var/backups/orunei/storage" "$Dest\"
scp "vps:/var/backups/orunei/last-backup.json" "$Dest\"
Write-Host "Listo: $nuevas copias nuevas en $Dest"
