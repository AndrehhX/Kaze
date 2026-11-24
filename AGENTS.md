<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Guía para agentes de IA (KAZE / Orunei)

> Léela entera antes de tocar nada. Vale para Codex, Claude, Gemini, Cursor o cualquier otra IA.
> El dueño del proyecto habla español: **responde en español, corto y claro**, y dale los comandos para **PowerShell de Windows**.

## Reglas obligatorias

1. **No borres nada**: ni archivos, ni tablas, ni columnas, ni releases de la VPS, ni ramas. Si algo sobra, propón renombrarlo y pregunta.
2. **Este repo es público.** Nunca escribas claves, contraseñas, tokens, el contenido de `.env*` ni la **IP de la VPS** en código, docs o commits. Usa el alias `ssh vps` y los nombres de las variables.
3. **Producción solo con permiso**: desplegar, publicar la APK, tocar Supabase, Cloudflare o la VPS requiere un "sí" explícito del dueño.
4. **Git**: commits en español con formato convencional (`feat:`, `fix:`, `docs:`…), solo con la identidad configurada del dueño, **sin** `Co-Authored-By` ni menciones a IA. **No hagas `push`** si no te lo piden.
5. **Compila siempre en el PC, nunca en la VPS** (1 núcleo / 2 GB: se queda sin memoria).
6. Si no estás seguro de una API (sobre todo de Next 16), **dilo** en vez de inventar.

## Qué es

Plataforma de anime y manga en español: catálogo (AniList), reproductor HLS, biblioteca, progreso, perfiles, amigos, comentarios, reseñas, watch parties, Wrapped, logros, lector de manga (MangaDex) y app Android.

| Pieza | Dónde | Tecnología |
| --- | --- | --- |
| Web | `src/` | Next.js 16.4 (App Router, Cache Components, `"use cache"`), React 19, TypeScript, Tailwind v4, Zustand, TanStack Query |
| App Android | `mobile/` | Kotlin, Jetpack Compose, Hilt, Room, Media3 |
| Base de datos | Supabase | Postgres + RLS + Realtime. **El esquema real NO coincide al 100 % con `supabase/migrations/`** (ver abajo) |
| Video | `deploy/resolver/`, `deploy/cloudflare-worker/` | Resolver Node en la VPS + Worker de Cloudflare `orunei-stream` |
| Despliegue | `deploy/` | Build standalone en el PC → VPS (systemd `orunei-web` + Caddy) detrás de Cloudflare |

## Mapa rápido del código web

| Necesitas… | Mira |
| --- | --- |
| Páginas | `src/app/(site)/` (`page.tsx` portada, `anime/[id]`, `watch/[animeId]/[episodeId]`, `manga/…`, `profile`, `friends`, `watch-parties`, `wrapped`, `calendario`, `discover`, `library`, `settings`) |
| API propias | `src/app/api/` (`anilist/*` proxies con caché, `playback/session`, `stream/*`, `manga/*`, `cron/*`, `integrations/anilist/*`, `account/*`) |
| Catálogo AniList | `src/lib/anilist/` (`client.ts` reintentos 429, `service.ts` funciones `"use cache"`, `queries.ts`, `browse-params.ts`) |
| Reproductor | `src/components/player/` (`player.tsx`, `watch-client.tsx`), layout estable en `src/app/(site)/watch/[animeId]/layout.tsx` (`data-player-host` para la pantalla completa) |
| Fuentes de video | `src/lib/media/` (`provider.ts` llama al resolver de la VPS, `stream-policy.ts`, `aniskip.ts` marcas de opening/ending) |
| Estado del cliente | `src/stores/` (`progress.ts`, `library.ts`, `manga.ts`, `settings.ts`, `local.ts`, `auth.ts`) |
| Sincronización con Supabase | `src/lib/data/remote.ts`, `src/lib/data/manga-remote.ts`, `src/lib/social.ts` |
| Portada personalizada | `src/components/home/personal.tsx` (Continuar viendo, Recomendado para ti, Porque te gustó…) |
| Recomendaciones | `src/lib/recommend.ts` (reglas explicables; pruebas en `tests/unit/logic.test.ts`) |
| Manga | `src/lib/manga/providers/mangadex.ts` (búsqueda y capítulos), `src/components/manga/` |
| Temas | `src/app/globals.css` (tokens `--k-*` por `[data-theme]`), `src/lib/themes.ts` |

## Esquema real de Supabase (lo que de verdad existe)

Comprobado el 24/11/2026 con el OpenAPI de PostgREST. **Antes de usar una tabla, confirma sus columnas** (Supabase → Table Editor).

- **Amistad**: `friendships(requester_id, addressee_id, status)` + `friend_requests(sender_id, receiver_id, status)`. No existen RPC tipo `send_friend_request`.
- **Biblioteca y progreso**: `anime_library_entries(user_id, media_id, status, progress, score, favorite, media_snapshot…)`, `watch_progress(user_id, series_id, episode_id, position_seconds, duration_seconds, completed)`.
- **Social**: `reviews(media_id, rating 1–10…)`, `review_reactions`, `discussions`, `comments(target_type, target_id, parent_id…)`, `activity_events`, `notifications(kind, payload)`, `user_blocks`, `reports`.
- **Perfiles**: `profiles` (muchas columnas de personalización), `profile_privacy`, `profile_lists`, `profile_comments`, `profile_anime`, `profile_activity`.
- **Salas**: `watch_party_rooms(id text, code, host_id, series_id, episode_id, is_playing, position_seconds…)`, `watch_party_participants`, `watch_party_messages`, `watch_party_invites`; control solo con la RPC `watch_party_control`.
- **RPC**: `are_friends`, `can_view`, `can_join_room`, `is_room_member`, `is_blocked_between`, `delete_my_data`, `server_time`, `touch_last_seen`, `watch_party_control`, `admin_*`.
- ⚠️ **Las tablas de manga (`manga_library_entries`, `manga_reading_progress`…) NO existen** en la base real: la migración `20261120000000_kaze_manga.sql` no está aplicada. La biblioteca de manga solo se guarda en el navegador.

## Comandos

```powershell
npm run dev          # local en http://localhost:3000
npm run typecheck
npm run lint
npm test             # Vitest (pruebas unitarias)
powershell -ExecutionPolicy Bypass -File deploy\deploy-vps.ps1        # desplegar (con permiso)
powershell -ExecutionPolicy Bypass -File deploy\publish-apk.ps1 -Build -Notes "…"   # publicar APK (con permiso)
```

## Trampas conocidas

- **Cloudflare cachea el HTML hasta 4 h.** Tras desplegar, prueba con `?t=1` en la URL o purga en Cloudflare. `deploy/activate-release.sh` conserva los JS/CSS del release anterior para que el HTML viejo no se rompa.
- **AniList limita a ~90 peticiones/min.** Si el build falla con `AniList rate limit reached` al prerenderizar `/`, espera un minuto y repite: no se sube nada roto.
- **Memoria de la VPS**: `partialPrefetching` está desactivado y `cacheMaxMemorySize: 0` a propósito (había fugas que tumbaban el proceso). No los reactives.
- **Redirecciones**: usa `publicOrigin(req)`, nunca `req.nextUrl.origin` (en la VPS da `localhost:3000`).
- **Git Bash + ssh**: antepón `MSYS_NO_PATHCONV=1` a `ssh vps '/opt/…'` o convierte las rutas.
- **App Android**: nunca cambies la llave de firma; sube `versionCode` en cada publicación; compila con memoria limitada y sin el emulador abierto (el PC tiene 7 GB). Detalles en `mobile/README.md`.
- **Manga**: muchas obras con licencia no tienen capítulos en MangaDex. No es un bug; la ficha muestra los enlaces oficiales.

## Antes de dar algo por terminado

1. `npm run typecheck`, `npm run lint` (0 errores) y `npm test`.
2. Si tocas la UI, pruébala en `npm run dev` (móvil y escritorio).
3. Explica al dueño qué cambió, qué no pudiste comprobar y pide permiso para desplegar.

Más documentación: `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOY_VPS.md`, `docs/GUIA_MUDANZA_VPS.md`, `docs/MANGA.md`, `mobile/README.md`.
