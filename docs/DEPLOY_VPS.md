# Deploy en VPS: estado y guía de uso

> Actualizado: 22 de noviembre de 2026. Plan y mediciones previas en `PLAN_MIGRACION_VPS.md`.

## Estado

| Fase | Estado |
| --- | --- |
| 0. Código (`standalone`, IP real tras Cloudflare, Analytics solo en Vercel, scripts `deploy/`) | ✅ hecho |
| 1. VPS preparada (usuario `orunei`, servicio systemd, `.env`, Caddy, auto-reinicio) | ✅ hecho |
| 2. Primer deploy y pruebas | ✅ hecho: 18 rutas en 200, playback OK, prueba de carga OK |
| 3. Cambiar `www` a la VPS en Cloudflare | ⏳ **te toca** (sección 3) |
| 4. Vigilancia | ✅ auto-reinicio en la VPS · ⏳ monitor externo (opcional, sección 4) |
| 5. Mudanza a otra VPS | ✅ scripts listos (sección 5) |

### Prueba de carga real en la VPS (1 vCPU / 2 GB, con resolver y bot de Discord corriendo)
| Fase | Resultado |
| --- | --- |
| 10 usuarios simultáneos, 20 s | **48,6 pet/s**, p95 291 ms, 0 errores |
| 40 usuarios simultáneos, 15 s | **72,6 pet/s**, p95 991 ms, 0 errores |
| RAM de Next (pico) | **208 MB** (límite del servicio: 800 MB) |
| RAM libre de la VPS (mínimo) | **958 MB** |

Tu tráfico actual ronda 0,5 pet/s de media: margen de sobra.

## 1. Cómo funciona

```
Cloudflare ──► VPS :80 Caddy ──► 127.0.0.1:3000  servicio systemd "orunei-web" (usuario orunei)
                                  /opt/orunei-web/current -> releases/<fecha>
                                  /opt/orunei-web/shared/.env      (variables, chmod 600)
                                  /opt/orunei-web/shared/cache     (caché ISR persistente)
```
- **Compilar siempre en el PC**, nunca en la VPS.
- Cada deploy crea una carpeta nueva en `releases/`; **no se borra ninguna** (cada una ocupa ~55 MB y hay 40 GB libres).
- Un cron revisa cada 2 min que la web responda y, si no, reinicia el servicio.

## 2. Desplegar una nueva versión

Desde la carpeta `crunchy` en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy-vps.ps1
```

Compila, sube (~29 MB), activa y comprueba. **Si la versión nueva no arranca, vuelve sola a la anterior.**

Volver atrás a mano:
```powershell
ssh vps "ls /opt/orunei-web/releases"
```
```powershell
ssh vps "ln -sfn /opt/orunei-web/releases/<RELEASE> /opt/orunei-web/current && systemctl restart orunei-web"
```

Ver logs y estado:
```powershell
ssh vps "systemctl status orunei-web --no-pager; journalctl -u orunei-web -n 50 --no-pager"
```

> `.env.production.local` (solo en tu PC, ignorado por git) fija `NEXT_PUBLIC_SITE_URL=https://www.orunei.sbs` para el build. Si cambias alguna variable `NEXT_PUBLIC_*`, hay que volver a compilar y desplegar. Las variables de servidor se editan en la VPS, en `/opt/orunei-web/shared/.env`, y luego se ejecuta `systemctl restart orunei-web`.

## 3. Cambiar el tráfico a la VPS (te toca en Cloudflare)

### 3.1 Mira el modo SSL
Cloudflare → `orunei.sbs` → **SSL/TLS → Overview**.
- **Flexible** → pasa directo al 3.2.
- **Full** o **Full (strict)** → la VPS todavía no tiene HTTPS propio. Elige una opción:
  - **A (rápida):** Rules → **Configuration Rules** → Create → condición `Hostname equals www.orunei.sbs` (y `orunei.sbs`) → **SSL: Flexible**. Es lo mismo que ya usan `resolver` y `panel`.
  - **B (más segura, recomendada a la larga):** SSL/TLS → **Origin Server → Create Certificate** (15 años, gratis). Guarda el certificado y la clave como `origin.pem` y `origin.key` en tu Escritorio **sin pegarlos en el chat**, y dímelo: los instalo en Caddy con HTTPS en el 443.

### 3.2 Cambia el DNS
Cloudflare → **DNS → Records** → edita el registro **`www`**:
- Tipo: **A** (si ahora es un CNAME a Vercel, cámbiale el tipo).
- Contenido: **la IP de tu VPS** (la ves en tu archivo `.ssh/config`, línea `HostName`). No la publiques: Cloudflare la mantiene oculta.
- Proxy: **naranja (Proxied)** ← obligatorio
- Guardar.

Haz lo mismo con el registro raíz `orunei.sbs` si apunta a Vercel (tu regla `apex → www` sigue funcionando igual).

### 3.3 Comprueba (1–2 min después)
- Abre `https://www.orunei.sbs` en incógnito: inicio, un anime, reproducir un episodio, iniciar sesión.
- Si ves **error 521/525/526** → vuelve al 3.1 (modo SSL).
- **Volver a Vercel:** deja el registro `www` como estaba (CNAME `cname.vercel-dns.com`). Tarda ~1 min.

### 3.4 Después del cambio
- **No necesitas otra cuenta de Vercel.** Sin tráfico, el proyecto `orunei-v2` no consume nada. Déjalo como respaldo (no lo borres).
- La **Cache Rule** de `OPTIMIZACION_VERCEL.md` (§3.2) sigue siendo recomendable: le quita trabajo a la VPS. Y el **bypass** para `panel` y `resolver`.
- Supabase no cambia (mismo dominio).

## 4. Monitor externo (opcional, 3 min)
[UptimeRobot](https://uptimerobot.com) gratis → *New monitor* → HTTP(s) → `https://www.orunei.sbs/robots.txt` → cada 5 min → aviso a tu correo. Así te enteras si la VPS se cae.

## 5. Mudarse a la siguiente VPS (~30–60 min)

Sigue la guía completa y actualizada: **[GUIA_MUDANZA_VPS.md](GUIA_MUDANZA_VPS.md)** (copia segura de archivos, resolver, Redis, bot de Discord, cambio de DNS, cómo volver atrás y checklist).

## 6. Cambios hechos en la VPS (para referencia)
- Usuario de sistema `orunei` · `/opt/orunei-web/` · `/etc/systemd/system/orunei-web.service` · `/etc/cron.d/orunei-web-health`.
- Caddy: bloque `@web` para `www.orunei.sbs`, `orunei.sbs` y `vps.orunei.sbs` → `127.0.0.1:3000` (copias de seguridad en `/etc/caddy/Caddyfile.bak-*`).
- `shared/.env`: `STREAM_RESOLVER_URL=http://127.0.0.1:3001/api/stream/resolve`. La web llama al resolver dentro de la VPS (~1 ms) en vez de pasar por Cloudflare (~70–95 ms). **Si en una mudanza el resolver queda en otra máquina, vuelve a poner `https://resolver.orunei.sbs/api/stream/resolve`.**
- Servicio: heap de Node 384 MB, `MemoryHigh` 750 MB, `MemoryMax` 900 MB, `TimeoutStopSec` 10 s (un reinicio deja la web fuera ~12 s).
- Firewall: SSH (22) abierto; **80/443 solo desde los rangos de Cloudflare** (`/opt/orunei-web/bin/ufw-cloudflare.sh`, se actualiza cada lunes por `/etc/cron.d/orunei-ufw-cloudflare`). Entrar por la IP directa da timeout: así nadie puede saltarse Cloudflare.
- No se tocaron `kaze-resolver`, `panbot`, Redis, CasaOS, Docker ni Samba.
