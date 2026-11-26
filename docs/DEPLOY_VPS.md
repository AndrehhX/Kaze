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
- **`/app-version.json` no se cachea** (Cache Rule "No cachear version de la app", la última de la lista): si Cloudflare lo guarda, la app KAZE y el aviso de PanBot tardan hasta 4 h en ver una APK nueva.
- Supabase no cambia (mismo dominio).

## 4. Vigilancia y copias de seguridad (montado el 24/11/2026)

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| **Monitor externo** | Worker de Cloudflare `orunei-monitor` (`deploy/monitor-worker/`) | Cada 5 min comprueba la web, la portada y el resolver **desde fuera**. Si fallan 2 veces seguidas avisa a Discord, y vuelve a avisar cuando se recuperan. Sigue funcionando aunque la VPS esté apagada. Estado en KV `orunei-monitor-state`. |
| **Vigilante local** | VPS, `/etc/cron.d/orunei-watchdog` → `/opt/orunei-ops/vps-watchdog.sh` | Cada 5 min revisa `orunei-web`, el resolver, Redis, Caddy, disco (≥85 %), memoria (<150 MB libres) y que haya copia de Supabase de las últimas 30 h. Solo avisa cuando algo cambia. |
| **Copia de Supabase** | VPS, `/etc/cron.d/orunei-backup` (04:20) → `/opt/orunei-ops/backup-supabase.mjs` | Exporta todas las tablas (PostgREST), las cuentas de Auth y una copia espejo de Storage en `/var/backups/orunei/` (`db/AAAA-MM-DD.json.gz`, ~7 MB/día). No borra copias antiguas. Registro: `/var/log/orunei-backup.log`; resumen: `last-backup.json`. |
| **Copia en el PC** | `deploy\ops\pull-backups.ps1` | Baja a `Documentos\KAZE-copias` las copias que falten. Hazlo de vez en cuando (y antes de mudarte de VPS). |

- **Webhook de Discord para los avisos** (uno solo para los dos vigilantes): créalo en un canal privado (Editar canal → Integraciones → Webhooks) y ejecuta `powershell -ExecutionPolicy Bypass -File deploy\ops\set-alert-webhook.ps1`. Lo pide oculto, lo guarda en `/etc/orunei-ops/alerts.env` (VPS) y como secreto del Worker, y manda un mensaje de prueba. **Sin webhook los vigilantes funcionan pero solo escriben en el log.**
- Reinstalar/actualizar los scripts de la VPS: `powershell -ExecutionPolicy Bypass -File deploy\ops\install-ops.ps1`.
- Publicar cambios del monitor: `cd deploy\monitor-worker; npx wrangler deploy`.
- **Restaurar** una tabla: el `.json.gz` tiene `{ tables: { nombre: [filas…] }, authUsers: […] }`; se puede reinsertar por tabla con la clave de servicio (`upsert`). Las contraseñas de Auth no se exportan (Supabase no las da): tras una pérdida total los usuarios tendrían que restablecerla.

## 5. Mudarse a la siguiente VPS (~30–60 min)

Sigue la guía completa y actualizada: **[GUIA_MUDANZA_VPS.md](GUIA_MUDANZA_VPS.md)** (copia segura de archivos, resolver, Redis, bot de Discord, cambio de DNS, cómo volver atrás y checklist).

## 6. Cambios hechos en la VPS (para referencia)
- Usuario de sistema `orunei` · `/opt/orunei-web/` · `/etc/systemd/system/orunei-web.service` · `/etc/cron.d/orunei-web-health`.
- Caddy: bloque `@web` para `www.orunei.sbs`, `orunei.sbs` y `vps.orunei.sbs` → `127.0.0.1:3000` (copias de seguridad en `/etc/caddy/Caddyfile.bak-*`).
- `shared/.env`: `STREAM_RESOLVER_URL=http://127.0.0.1:3001/api/stream/resolve`. La web llama al resolver dentro de la VPS (~1 ms) en vez de pasar por Cloudflare (~70–95 ms). **Si en una mudanza el resolver queda en otra máquina, vuelve a poner `https://resolver.orunei.sbs/api/stream/resolve`.**
- Servicio: heap de Node 512 MB, `MemoryHigh` 850 MB, `MemoryMax` 1000 MB, `TimeoutStopSec` 10 s (un reinicio deja la web fuera ~12 s).
- **Memoria (22/11/2026):** la web se caía por OOM cada ~12 min. Con heap snapshots y pruebas de 600 fichas se vio que en Next 16.4 el **`partialPrefetching`** dejaba colgados los datos de cada página (~0,6 MB por ficha). Ahora está **desactivado**, la caché ISR en memoria está apagada (`cacheMaxMemorySize: 0`, las páginas siguen en disco y en Cloudflare) y `"use cache"` usa un gestor propio con tope real en bytes (`cache-handlers/use-cache-memory.cjs`). **No reactivar `partialPrefetching` ni quitar el gestor propio sin repetir la prueba de memoria.**
- Redirecciones del servidor: usar `publicOrigin(req)` (`src/lib/public-origin.ts`), nunca `req.nextUrl.origin`: detrás de Caddy devuelve `https://localhost:3000`.
- Desde Git Bash, los comandos `ssh vps '/opt/...'` necesitan `MSYS_NO_PATHCONV=1` delante; si no, Git Bash convierte `/opt/...` en una ruta de Windows. PowerShell no tiene ese problema.
- **HTTPS de origen:** Caddy escucha también en 443 con certificado propio (`tls internal`). Para cifrar el tramo Cloudflare → VPS, en Cloudflare → Rules → Configuration Rules → `VPS Services Flexible SSL` cambia **SSL: Flexible → Full**. Para `Full (strict)` hace falta un *Origin Certificate* de Cloudflare (ver `deploy/Caddyfile.example`).
- Firewall: SSH (22) abierto; **80/443 solo desde los rangos de Cloudflare** (`/opt/orunei-web/bin/ufw-cloudflare.sh`, se actualiza cada lunes por `/etc/cron.d/orunei-ufw-cloudflare`). Entrar por la IP directa da timeout: así nadie puede saltarse Cloudflare.
- **Avisos de episodios nuevos:** `/etc/cron.d/orunei-episodes` llama cada 30 min a `POST /api/cron/episodes` (por 127.0.0.1, con `CRON_SECRET` del `.env`, generado por el bootstrap). Prueba sin enviar nada: `?dryRun=1&window=1440`.
  - **Discord (opcional):** en tu servidor de Discord → ajustes del canal → Integraciones → Webhooks → *Nuevo webhook* → copiar URL. Añádela a `/opt/orunei-web/shared/.env` como `DISCORD_EPISODES_WEBHOOK_URL=...` y reinicia (`systemctl restart orunei-web`). Publicará los estrenos populares con su portada.
  - **Avisos push en el navegador (web):** cada usuario los activa desde la campana de notificaciones. Las suscripciones se guardan en el **Redis de la VPS** (`kaze:push:u:<userId>`), no en Supabase; el navegador las reenvía en cada visita, así que si Redis se vacía se recuperan solas. Necesita en `shared/.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT=https://www.orunei.sbs` (sin ellas el botón no aparece). El cron de episodios envía el push junto con la notificación. Código: `src/lib/push/`, `src/app/api/push/route.ts`, `public/sw.js`.
- Logros: la migración `supabase/migrations/20261122000000_more_achievements.sql` ya está aplicada en producción (20 logros).
- No se tocaron `kaze-resolver`, `panbot`, Redis, CasaOS, Docker ni Samba.
- **Reparto de trozos de video (23/11/2026):** el Worker `orunei-stream` manda 1 de cada 2 segmentos de cada playlist a la VPS (`https://resolver.orunei.sbs/api/stream/seg`), para no gastar su límite gratis de 100.000 peticiones al día. Los enlaces van firmados (HMAC del host + caducidad de 6 h) con la clave `/opt/kaze-resolver/.segment-key`, que es la misma que el secreto `SEGMENT_SIGNING_KEY` del Worker (el otro secreto es `VPS_SEGMENT_BASE`). Si el resolver no responde a `/health`, el Worker deja de repartir solo. Código: `deploy/resolver/segment-proxy.js` (en la VPS, `/opt/kaze-resolver/segment-proxy.js`) y `deploy/cloudflare-worker/orunei-stream-worker.js`. Publicar el Worker: `npx wrangler deploy orunei-stream-worker.js --name orunei-stream --compatibility-date 2024-01-01 --keep-vars`.
- **Tráfico (24/11/2026):** `vnstat` instalado en la VPS (servicio `vnstat`). Ver con `ssh vps "vnstat -d 7; vnstat -m"`. Desde el reparto de video, la VPS envía ~25–35 GB/día (~1 TB/mes): vigilar la cuota de transferencia del plan.
