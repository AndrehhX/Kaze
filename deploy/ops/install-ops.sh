#!/usr/bin/env bash
# Instala en la VPS la copia diaria de Supabase y el vigilante local.
# Se ejecuta como root desde /opt/orunei-ops (lo sube deploy/ops/install-ops.ps1).
set -euo pipefail

OPS=/opt/orunei-ops
mkdir -p /etc/orunei-ops /var/backups/orunei /var/lib/orunei-ops
chmod 700 /etc/orunei-ops /var/backups/orunei
chmod 755 "$OPS"/vps-watchdog.sh

if [ ! -f /etc/orunei-ops/alerts.env ]; then
  printf '# Webhook de Discord para avisos (canal privado). Se rellena con deploy/ops/set-alert-webhook.ps1\nDISCORD_ALERT_WEBHOOK_URL=\n' > /etc/orunei-ops/alerts.env
fi
chmod 600 /etc/orunei-ops/alerts.env

cat > /etc/cron.d/orunei-backup <<'EOF'
# Copia diaria de Supabase (tablas, cuentas y Storage) en /var/backups/orunei. 04:20 hora del servidor.
20 4 * * * root set -a; . /opt/orunei-web/shared/.env; set +a; nice -n 10 node /opt/orunei-ops/backup-supabase.mjs >> /var/log/orunei-backup.log 2>&1
EOF

cat > /etc/cron.d/orunei-watchdog <<'EOF'
# Vigilante local: servicios, disco, memoria y copias. Avisa a Discord solo cuando algo cambia.
*/5 * * * * root /opt/orunei-ops/vps-watchdog.sh
EOF

chmod 644 /etc/cron.d/orunei-backup /etc/cron.d/orunei-watchdog
echo "ok: cron instalado (orunei-backup, orunei-watchdog)"
