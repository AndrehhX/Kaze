#!/usr/bin/env bash
# Vigilante local de la VPS: revisa servicios, disco, memoria y la copia de Supabase.
# Avisa a Discord solo cuando algo cambia (cae o se recupera), nunca en bucle.
# Lo lanza /etc/cron.d/orunei-watchdog cada 5 minutos.
#
# Webhook: DISCORD_ALERT_WEBHOOK_URL en /etc/orunei-ops/alerts.env (no va en el repo).
set -u

STATE_DIR=/var/lib/orunei-ops
CONF=/etc/orunei-ops/alerts.env
BACKUP_STATUS=/var/backups/orunei/last-backup.json
mkdir -p "$STATE_DIR"
[ -f "$CONF" ] && . "$CONF"
WEBHOOK="${DISCORD_ALERT_WEBHOOK_URL:-}"
HOST=$(hostname)

send() { # $1 = color, $2 = título, $3 = texto
  logger -t orunei-watchdog "$2 — $3"
  [ -z "$WEBHOOK" ] && return 0
  local body
  body=$(TITLE="$2" TEXT="$3" COLOR="$1" node -e '
    process.stdout.write(JSON.stringify({ username: "KAZE · vigilante", embeds: [{
      title: process.env.TITLE, description: process.env.TEXT, color: Number(process.env.COLOR),
      footer: { text: "VPS · " + require("os").hostname() }, timestamp: new Date().toISOString() }] }))')
  curl -fsS -m 15 -H "Content-Type: application/json" -d "$body" "$WEBHOOK" >/dev/null || logger -t orunei-watchdog "no se pudo avisar a Discord"
}

# check <clave> <descripción> <comando que devuelve 0 si todo bien> [detalle si falla]
check() {
  local key=$1 label=$2 cmd=$3 detail=${4:-}
  local file="$STATE_DIR/$key.fail"
  if bash -c "$cmd" >/dev/null 2>&1; then
    if [ -f "$file" ]; then
      rm -f "$file"
      send 3066993 "✅ Recuperado: $label" "Vuelve a funcionar con normalidad."
    fi
  else
    local n=$(( $(cat "$file" 2>/dev/null || echo 0) + 1 ))
    echo "$n" > "$file"
    # Avisa al 2.º fallo seguido (evita falsas alarmas por un reinicio puntual) y luego cada 6 h.
    if [ "$n" -eq 2 ] || [ $(( n % 72 )) -eq 0 ]; then
      send 15158332 "🔴 Problema: $label" "${detail:-Falla desde hace $(( (n - 1) * 5 )) min o más.}"
    fi
  fi
}

check web "Web Next.js (orunei-web)" "systemctl is-active --quiet orunei-web && curl -fs -o /dev/null --max-time 10 http://127.0.0.1:3000/robots.txt" \
  "El servicio no responde en local. El cron de salud intenta reiniciarlo; revisa: journalctl -u orunei-web -n 100"
check resolver "Resolver de video (kaze-resolver)" "curl -fs -o /dev/null --max-time 10 http://127.0.0.1:3001/health" \
  "Sin resolver no hay video. Revisa: pm2 status · pm2 logs kaze-resolver --lines 100"
check redis "Redis" "timeout 5 redis-cli ping | grep -q PONG"
check caddy "Caddy" "systemctl is-active --quiet caddy"

DISK=$(df --output=pcent / | tail -1 | tr -dc '0-9')
check disk "Disco casi lleno (${DISK}%)" "[ $DISK -lt 85 ]" "El disco está al ${DISK}%. Mira qué ocupa: du -sh /var/backups/orunei /opt/orunei-web/releases"

MEM_AVAIL=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
check memory "Memoria baja (${MEM_AVAIL} MB libres)" "[ $MEM_AVAIL -gt 150 ]"

# La copia de Supabase se hace a diario: si la última correcta tiene más de 30 h, algo falla.
check backup "Copia de seguridad de Supabase" "[ -f $BACKUP_STATUS ] && [ \$(( \$(date +%s) - \$(stat -c %Y $BACKUP_STATUS) )) -lt 108000 ]" \
  "No hay copia correcta en las últimas 30 h. Revisa: tail -50 /var/log/orunei-backup.log"

exit 0
