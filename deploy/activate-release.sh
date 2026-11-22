#!/usr/bin/env bash
# Activa un release subido por deploy-vps.ps1. Se instala en /opt/orunei-web/bin/.
# Uso (root): activate-release.sh <nombre-release> <ruta-al-.tgz>
# Si el nuevo release no responde, vuelve automaticamente al anterior.
set -euo pipefail

REL="${1:?falta el nombre del release}"
TGZ="${2:?falta la ruta del .tgz}"
BASE=/opt/orunei-web
DEST="$BASE/releases/$REL"

if [ -e "$DEST" ]; then
  echo "ERROR: el release $REL ya existe" >&2
  exit 1
fi

mkdir -p "$DEST" "$BASE/shared/cache"
tar -xzf "$TGZ" -C "$DEST"

# Cache ISR/fetch compartida entre releases (persiste entre deploys).
rm -rf "$DEST/.next/cache"
ln -s "$BASE/shared/cache" "$DEST/.next/cache"
chown -R orunei:orunei "$DEST" "$BASE/shared/cache"

PREV=""
if [ -L "$BASE/current" ]; then PREV="$(readlink -f "$BASE/current")"; fi

# Conserva los JS/CSS del release anterior. Cloudflare puede tener HTML viejo en
# cache que pide chunks con otro hash; sin esto darian 404 y la pagina carga rota.
# Los nombres llevan hash, asi que no se pisa nada (-n = no sobrescribir).
if [ -n "$PREV" ] && [ -d "$PREV/.next/static" ]; then
  cp -an "$PREV/.next/static/." "$DEST/.next/static/" 2>/dev/null || true
  chown -R orunei:orunei "$DEST/.next/static"
fi

ln -sfn "$DEST" "$BASE/current"
systemctl restart orunei-web

ok=0
for _ in $(seq 1 40); do
  if curl -fs -o /dev/null --max-time 3 http://127.0.0.1:3000/robots.txt; then ok=1; break; fi
  sleep 1
done

if [ "$ok" != 1 ]; then
  echo "ERROR: el release $REL no respondio; volviendo al anterior" >&2
  journalctl -u orunei-web -n 30 --no-pager >&2 || true
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" "$BASE/current"
    systemctl restart orunei-web
  fi
  exit 1
fi

rm -f "$TGZ"
echo "OK: release activo -> $REL (anterior: ${PREV:-ninguno})"
echo "Para volver atras: ln -sfn <release-anterior> $BASE/current && systemctl restart orunei-web"
