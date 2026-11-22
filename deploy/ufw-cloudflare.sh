#!/usr/bin/env bash
# Deja los puertos web (80/443) abiertos SOLO para las IPs de Cloudflare, para que nadie
# pueda saltarse Cloudflare entrando directo a la IP de la VPS. SSH (22) no se toca.
# Idempotente; se ejecuta semanalmente por cron para añadir rangos nuevos de Cloudflare.
set -euo pipefail

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

for v in 4 6; do
  curl -fsS --max-time 20 "https://www.cloudflare.com/ips-v$v"
  echo
done | grep -E '^[0-9a-fA-F:.]+/[0-9]+$' > "$TMP" || true

count="$(wc -l < "$TMP")"
if [ "$count" -lt 10 ]; then
  echo "ERROR: lista de Cloudflare sospechosa ($count rangos); no se cambia nada." >&2
  exit 1
fi

while read -r cidr; do
  for port in 80 443; do
    ufw allow proto tcp from "$cidr" to any port "$port" comment 'Cloudflare' >/dev/null
  done
done < "$TMP"

# Quitar las reglas abiertas a todo internet (solo despues de tener las de Cloudflare).
for port in 80 443; do
  while ufw status | grep -qE "^${port}/tcp( \(v6\))? +ALLOW +Anywhere"; do
    ufw --force delete allow "${port}/tcp" >/dev/null || break
  done
done

echo "OK: puertos 80/443 limitados a $count rangos de Cloudflare."
