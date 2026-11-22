# Plan de migración: `crunchy` (Next.js) de Vercel a VPS

> Fecha: 22 de noviembre de 2026 · Estado: **fases 0–2 ejecutadas; falta el cambio de DNS en Cloudflare. Ver `DEPLOY_VPS.md`.**
> Decisiones tomadas: se mantienen CasaOS/Docker/Samba (no hace falta liberar RAM), se mantiene Node 22 (el resolver y el bot ya lo usan) y el DNS se cambia en cuanto sea posible, porque la cuenta de Vercel llegó al tope de ISR Writes.
> Objetivo: servir `www.orunei.sbs` desde una VPS con costo fijo, detrás de Cloudflare, y poder **cambiar de VPS en minutos** (la actual dura 1 mes).

## 1. Veredicto

**Sí cabe, y con margen**, con tres condiciones:
1. **No compilar en la VPS.** Se compila en tu PC y se sube solo el resultado (`output: "standalone"`).
2. **Cloudflare delante cacheando** las páginas públicas (ya está documentado en `OPTIMIZACION_VERCEL.md`).
3. **Vercel se queda de respaldo en espera**: si la VPS falla, se cambia el DNS de vuelta en 1 minuto.

## 2. Mediciones reales

### VPS actual (`ssh vps`)
| Dato | Valor |
| --- | --- |
| CPU | 1 vCPU AMD EPYC 7713 (Akamai/Linode, Los Ángeles) |
| RAM | 1,97 GB · ~1,2 GB disponibles · swap 2,5 GB |
| Disco | 40 GB libres |
| Ya instalado | Node 22, PM2, Caddy 2.6, Redis 7, Docker, git |
| Latencia a AniList / Supabase / Cloudflare | ~120 ms / ~124 ms / ~130 ms |
| RAM que ya usan | CasaOS 271 MB · journald 166 MB · resolver 125 MB · PM2 79 MB · Docker 76 MB · Samba 57 MB |
| Rendimiento por núcleo | **~2,3× más lento** que un núcleo de tu PC (mismo benchmark de Node: 1114 ms frente a 480 ms) |

### Next.js en producción (`next start` en tu PC, **limitado a 1 núcleo**)
| Prueba | Resultado en tu PC | Estimado en la VPS (×2,3) |
| --- | --- | --- |
| RAM pico del proceso | 183 MB (working set) · 291 MB comprometidos | **~200–300 MB** |
| Página de anime nueva (render en frío + AniList) | 376 ms de CPU · p50 0,7 s | **~0,9 s de CPU · 1,5–2 s** la 1.ª visita |
| Página ya en caché | 8 ms de CPU/petición | ~19 ms |
| Carga sostenida, 10 concurrentes, 20 s | 103 pet/s, p95 160 ms, 0 errores | **~45 pet/s** |
| Pico, 40 concurrentes, 15 s | 106 pet/s, p95 715 ms, 0 errores | ~45 pet/s, p95 ~1,6 s |
| API `/api/anilist/browse` en caché | 4,4 ms de CPU/petición | ~10 ms |

### Lo que hay que subir
| Pieza | Tamaño |
| --- | --- |
| `.next/server` + `.next/static` + `public` | ~77 MB |
| `node_modules` trazados por standalone (estimado) | ~40–80 MB |
| **Total por release** | **~120–160 MB** (~40–60 MB comprimido) |

## 3. ¿Aguanta tu tráfico?

- Tráfico actual: 230K peticiones en 5 días ≈ **0,5 pet/s de media**. Suponiendo picos 10×, son ~5 pet/s.
- Capacidad estimada de la VPS: **~45 pet/s** en páginas cacheadas → unas **9 veces de margen sobre el pico, incluso sin Cloudflare**.
- Renders en frío: con los cambios de caché del 21/11, unos 2–5K al día × 0,9 s ≈ **2–5 % de un núcleo**.
- RAM: Next (~300 MB) + lo que ya hay (~800 MB) ≈ **1,1 GB de 1,97 GB**. Si quitas CasaOS y Docker, se liberan ~350 MB más.
- Disco y red: sobran. El video **no pasa por aquí** (va por el Worker de Cloudflare).

**Cuándo deja de bastar:** con varios miles de usuarios a la vez sin caché de Cloudflare, o si el video llegara a pasar por la VPS.

## 4. Cambios de código necesarios (pequeños, no rompen Vercel)

| # | Cambio | Por qué |
| --- | --- | --- |
| C1 | `output: "standalone"` en `next.config.ts` | Genera un servidor autónomo y ligero. En Vercel no cambia nada. |
| C2 | `src/lib/rate-limit.ts`: leer primero `cf-connecting-ip` | Detrás de Cloudflare + Caddy, `x-forwarded-for` trae la IP de Cloudflare: todos los usuarios compartirían el mismo límite (aparecerían 429 falsos). |
| C3 | `<Analytics />` solo si `process.env.VERCEL` | Fuera de Vercel, `/_vercel/insights` da 404. Alternativa gratis: Cloudflare Web Analytics. |
| C4 | Script `scripts/deploy-vps.ps1` | Compila, empaqueta, sube por SSH, cambia de release y reinicia. |
| C5 | Script `scripts/bootstrap-vps.sh` | Prepara una VPS nueva desde cero (Node, PM2, Caddy, usuario, firewall). **Es lo que hace la migración portable.** |

## 5. Arquitectura destino

```
Usuario ──► Cloudflare (DNS + caché + WAF + SSL)
              ├─ www.orunei.sbs ──► VPS Caddy :443 ──► Next (PM2, 127.0.0.1:3000)
              ├─ resolver.orunei.sbs ──► VPS Caddy ──► kaze-resolver (:3001) + Redis
              ├─ panel.orunei.sbs ──► VPS Caddy (login) ──► CasaOS (:8080)
              └─ /api/stream/proxy ──► Worker orunei-stream (sin cambios)
Supabase (auth/BD/realtime) ── sin cambios
Vercel orunei-v2 ── en espera (respaldo, sin tráfico = sin consumo)
```

Carpetas en la VPS:
```
/opt/orunei-web/
  releases/2026-11-22_1530/   ← cada deploy en su carpeta
  current -> releases/...     ← enlace al release activo (volver atrás = cambiar el enlace)
  shared/.env                 ← variables (chmod 600, fuera del código)
  shared/cache/               ← caché ISR persistente entre releases
  ecosystem.config.cjs        ← PM2
```

## 6. Fases

### Fase 0 — Preparar el código (en tu PC)
1. Aplicar C1–C5 en una rama, `npm run typecheck && npm test && npm run build`.
2. Comprobar que `.next/standalone/server.js` arranca en local con `node server.js`.
3. Desplegar en Vercel igual que siempre (sigue funcionando).

**Verificación:** el build pasa y el standalone responde en local.

### Fase 1 — Preparar la VPS (sin tocar lo que ya corre)
1. Crear el usuario de sistema `orunei` (la web **no** corre como root).
2. Crear `/opt/orunei-web/{releases,shared}` y el `.env` con las variables (lista en la §8).
3. PM2: app `orunei-web` con `max_memory_restart: 600M`, `NODE_OPTIONS=--max-old-space-size=512`, `PORT=3000`, `HOSTNAME=127.0.0.1` y arranque automático (`pm2 startup`).
4. Caddy: añadir el host **`vps.orunei.sbs`** (temporal, de prueba) → `127.0.0.1:3000`.
5. Cloudflare: registro DNS `vps` → IP de la VPS (proxied).
6. **SSL entre Cloudflare y la VPS:** crear un *Origin Certificate* en Cloudflare, ponerlo en Caddy (:443) y poner el modo SSL en **Full (strict)**. Ahora mismo ese tramo va sin cifrar.

**Verificación:** `kaze-resolver` sigue online, `resolver`/`panel` responden igual que antes y la RAM libre es > 600 MB.

### Fase 2 — Primer deploy y pruebas en `vps.orunei.sbs`
1. `scripts/deploy-vps.ps1` → release → `current` → `pm2 reload`.
2. Recorrer las rutas clave: `/`, `/anime/21`, `/watch/...`, login, biblioteca, comunidad, watch party, `/api/anilist/*`, `/api/playback/session`.
3. Prueba de carga **real** contra la VPS (el mismo `loadtest.mjs` usado en este análisis), mirando RAM y CPU con `pm2 monit`.
4. Comparar con `www` en Vercel.

**Criterio para seguir:** 0 errores 5xx, p95 < 2 s en páginas cacheadas, RAM de Next < 450 MB, resolver sin cambios.

### Fase 3 — Cambio de tráfico (reversible en 1 min)
1. Antes: activar la Cache Rule de Cloudflare para `www` (y el bypass para `panel`/`resolver`).
2. Cloudflare DNS: `www` pasa de Vercel a la IP de la VPS (proxied).
3. Vigilar 1–2 h: errores, login de Supabase, reproducción y `cf-cache-status`.
4. **Volver atrás:** devolver el registro `www` a Vercel. El proyecto de Vercel no se toca.

Supabase y OAuth no cambian: el dominio sigue siendo el mismo.

### Fase 4 — Después del cambio
- Monitor de caída gratis (UptimeRobot o Cloudflare Health Checks) que te avise si `www` deja de responder.
- Revisar 48 h; después, Vercel queda solo como respaldo (pausado o sin dominio, **sin borrarlo**).
- Opcional: quitar CasaOS/Docker si no los usas (+350 MB), siempre preguntándote antes.

### Fase 5 — Mudarse a la siguiente VPS (cuando caduque esta)
1. VPS nueva con Ubuntu 22/24, mínimo **1 vCPU / 2 GB** (mejor 2 vCPU).
2. Instalar tu llave SSH → `bootstrap-vps.sh` (Node, PM2, Caddy, usuario, UFW, SSH solo con llave).
3. Copiar `shared/.env` desde la VPS vieja (o desde un respaldo local cifrado).
4. Desplegar el release actual con `deploy-vps.ps1` contra la VPS nueva y probar en `vps.orunei.sbs`.
5. Mover el **resolver + Redis** (también hay que portarlos: hoy viven en `/opt/kaze-resolver`).
6. Cambiar las IPs en Cloudflare (`www`, `vps`, `resolver`, `panel`) → listo. Tiempo estimado: **30–60 min**.

## 7. Riesgos y cómo se cubren

| Riesgo | Mitigación |
| --- | --- |
| La VPS se cae (un único servidor) | Vercel en espera + cambio de DNS en 1 min; monitor de caída. |
| Falta de RAM en un pico | `max_memory_restart` + swap de 2,5 GB + caché de Cloudflare. |
| Deploy roto | Releases versionados: volver atrás = apuntar `current` al anterior + `pm2 reload`. |
| Compilar en la VPS la cuelga | Prohibido por proceso: siempre se compila en el PC (o en GitHub Actions más adelante). |
| Rate limit con IP equivocada | C2 (`cf-connecting-ip`). |
| Primera visita lenta en páginas nuevas (~1,5–2 s) | Normal en un render en frío; luego la sirve la caché de Cloudflare. |
| La caché `use cache` vive en memoria y se pierde al reiniciar | Igual que en Vercel tras cada deploy; la caché ISR en disco (`shared/cache`) sí persiste. |
| Diferencia de versión de Node (Vercel 24, VPS 22) | Next 16 soporta Node ≥ 20.9. Se puede subir a 24 en el bootstrap. |
| Seguridad del servidor | Ya aplicado: UFW, SSH solo con llave, panel con login. Pendiente: SSL de origen (Fase 1.6). |

## 8. Variables de entorno necesarias en la VPS
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `STREAM_RESOLVER_URL`, `NEXT_PUBLIC_STREAM_PROXY_URL`, `NEXT_PUBLIC_APK_URL`, `NEXT_PUBLIC_DISCORD_URL`, `NEXT_PUBLIC_DISABLE_ADS`, `NEXT_PUBLIC_MONETAG_ZONE_ID`, `NEXT_PUBLIC_AD_BANNER_URL`, `NEXT_PUBLIC_ADSTERRA_NATIVE_ID`, `NEXT_PUBLIC_ADSTERRA_728X90_KEY`.

> Las `NEXT_PUBLIC_*` se fijan **al compilar**: el build del PC debe usar los mismos valores que producción (los de Vercel). Las demás se leen en el servidor desde `shared/.env`.

## 9. Pendiente de decidir por ti
- ¿Quitar CasaOS/Docker/Samba de la VPS para liberar RAM, o mantenerlos?
- ¿Subir Node a 24 en la VPS (igual que Vercel)?
- ¿Cuándo hacer el cambio de DNS? Mejor a una hora de poco tráfico.
