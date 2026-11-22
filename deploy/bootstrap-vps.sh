#!/usr/bin/env bash
# Prepara una VPS Ubuntu (22.04/24.04) para servir orunei-web. Idempotente: se puede
# ejecutar varias veces. No borra nada existente.
#
# Uso desde tu PC:
#   scp -r deploy vps:/tmp/orunei-deploy
#   ssh vps "bash /tmp/orunei-deploy/bootstrap-vps.sh"
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BASE=/opt/orunei-web

echo "== 1. Node.js"
if ! command -v node >/dev/null || ! node -v | grep -qE '^v(2[0-9]|[3-9][0-9])\.'; then
  echo "Instalando Node.js 22 (NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "== 2. Caddy"
if ! command -v caddy >/dev/null; then
  echo "Instalando Caddy (repositorio oficial)..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi
caddy version

echo "== 3. Usuario y carpetas"
id orunei >/dev/null 2>&1 || useradd --system --home-dir "$BASE" --shell /usr/sbin/nologin orunei
mkdir -p "$BASE/releases" "$BASE/shared/cache" "$BASE/bin"
install -m 755 "$HERE/activate-release.sh" "$BASE/bin/activate-release.sh"
install -m 755 "$HERE/ufw-cloudflare.sh" "$BASE/bin/ufw-cloudflare.sh"
if [ ! -f "$BASE/shared/.env" ]; then
  touch "$BASE/shared/.env"
  echo "AVISO: $BASE/shared/.env esta vacio; copia ahi las variables de produccion."
fi
chown -R orunei:orunei "$BASE/releases" "$BASE/shared"
chmod 600 "$BASE/shared/.env"

echo "== 4. Servicio systemd"
install -m 644 "$HERE/orunei-web.service" /etc/systemd/system/orunei-web.service
systemctl daemon-reload
systemctl enable orunei-web >/dev/null
echo "orunei-web habilitado (arranca con el primer release)."

echo "== 4b. Auto-reinicio si la web deja de responder (cada 2 min)"
cat > /etc/cron.d/orunei-web-health <<'CRON'
# Si Next no responde en 10 s y hay un release activo, se reinicia el servicio.
*/2 * * * * root [ -L /opt/orunei-web/current ] && ! curl -fs -o /dev/null --max-time 10 http://127.0.0.1:3000/robots.txt && systemctl restart orunei-web && logger -t orunei-web "healthcheck: reiniciado"
CRON
chmod 644 /etc/cron.d/orunei-web-health

echo "== 4c. Avisos de episodios nuevos (cada 30 min)"
if ! grep -q '^CRON_SECRET=' "$BASE/shared/.env"; then
  echo "CRON_SECRET=$(head -c 24 /dev/urandom | base64 | tr -d '/+=')" >> "$BASE/shared/.env"
  echo "CRON_SECRET generado en $BASE/shared/.env"
fi
cat > /etc/cron.d/orunei-episodes <<'CRON'
# Avisa a los usuarios de episodios nuevos de los animes que siguen (y a Discord si hay webhook).
*/30 * * * * root set -a; . /opt/orunei-web/shared/.env; set +a; [ -L /opt/orunei-web/current ] && curl -fsS -m 120 -X POST -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:3000/api/cron/episodes >/dev/null 2>&1 || logger -t orunei-web "cron episodios fallo"
CRON
chmod 644 /etc/cron.d/orunei-episodes

echo "== 5. Swap (si no hay)"
if [ "$(swapon --show --noheadings | wc -l)" = "0" ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon --show

echo "== 6. Firewall (SSH abierto; 80/443 solo desde Cloudflare)"
if command -v ufw >/dev/null; then
  ufw allow 22/tcp >/dev/null
  ufw --force enable >/dev/null
  "$BASE/bin/ufw-cloudflare.sh"
  cat > /etc/cron.d/orunei-ufw-cloudflare <<'CRON'
# Cada lunes: añade rangos nuevos de Cloudflare al firewall.
17 4 * * 1 root /opt/orunei-web/bin/ufw-cloudflare.sh >/dev/null 2>&1 || logger -t orunei-web "ufw-cloudflare fallo"
CRON
  chmod 644 /etc/cron.d/orunei-ufw-cloudflare
  ufw status | grep -E "^22/tcp" || true
fi

echo "== 7. SSH solo con llave (solo si root ya tiene una llave autorizada)"
if [ -s /root/.ssh/authorized_keys ]; then
  cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
CONF
  sshd -t && systemctl reload ssh
else
  echo "AVISO: root no tiene llave autorizada; NO se desactiva la contrasena."
fi

echo "== 8. Caddy: bloque de la web"
if ! grep -q "127.0.0.1:3000" /etc/caddy/Caddyfile 2>/dev/null; then
  echo "AVISO: añade a /etc/caddy/Caddyfile el bloque de $HERE/Caddyfile.example y ejecuta: systemctl reload caddy"
else
  echo "Caddy ya apunta a 127.0.0.1:3000"
fi

echo "Listo. Siguiente paso: desde tu PC, deploy/deploy-vps.ps1"
