# PanBot (bot de Discord de Orunei)

Corre en la VPS con PM2 (`pm2 status` → `panbot`), en `/opt/panbot`.

| Archivo | Qué hace |
| --- | --- |
| `panbot-service.mjs` | Bienvenidas y despedidas con banner, roles por botones, tickets, estancia en el canal AFK y voz con Gemini (pausada). |
| `kaze-features.mjs` | Funciones de KAZE: `/anime`, `/hoy`, `/ruleta`, estrenos diarios en #Anime-Chat, anuncio de nuevas APK en #Orunei-Updates y de salas de cine públicas en #Watch-Party. |
| `post-apk-update.mjs` | Anuncio manual largo de una versión de la APK (ya no hace falta: el bot la anuncia sola). |
| `.env.example` | Variables necesarias. El `.env` real vive solo en la VPS (`/opt/panbot/.env`, permisos 600). |

`state.json` (solo en la VPS) recuerda qué se anunció ya: el último día de estrenos, la última versión de la APK y las salas anunciadas.

## Actualizar el bot

```powershell
cd deploy\panbot
scp panbot-service.mjs kaze-features.mjs post-apk-update.mjs vps:/opt/panbot/
ssh vps "cd /opt/panbot && node --check panbot-service.mjs && pm2 restart panbot && pm2 logs panbot --lines 20 --nostream"
```

Si cambias `package.json`: `ssh vps "cd /opt/panbot && npm ci --omit=dev && pm2 restart panbot"`.

## Notas

- Los comandos se registran solos en el servidor al arrancar (aparecen al instante). Si sale "Missing Access", vuelve a invitar al bot con el permiso `applications.commands`.
- Los estrenos diarios salen a las `ESTRENOS_HOUR` (por defecto 9:00, hora de `KAZE_TZ`) y solo incluyen series con algo de público; `/hoy` muestra todos.
- Las salas se leen de Supabase con la clave de servicio (la misma que la web), solo lectura de `watch_party_rooms` públicas creadas en los últimos 15 minutos.
- Antes del 24/11/2026 el token estaba escrito en el código. Hay copias de esa versión en `/opt/panbot/backup-*` (solo root). Si alguna vez se filtra, regenera el token en el portal de desarrolladores de Discord y cámbialo en `.env`.
