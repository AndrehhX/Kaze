# Sube a la VPS los scripts de copias y vigilancia y los instala (cron).
# Uso: powershell -ExecutionPolicy Bypass -File deploy\ops\install-ops.ps1
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

ssh vps "mkdir -p /opt/orunei-ops"
scp "$here\backup-supabase.mjs" "$here\vps-watchdog.sh" "$here\install-ops.sh" "vps:/opt/orunei-ops/"
# Los scripts de bash deben tener finales de línea LF.
ssh vps "sed -i 's/\r$//' /opt/orunei-ops/*.sh && bash /opt/orunei-ops/install-ops.sh"
