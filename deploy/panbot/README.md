# PanBot (bot de Discord de Orunei)

Corre en la VPS con PM2 (`pm2 status` → `panbot`), en `/opt/panbot`.

| Archivo | Qué hace |
| --- | --- |
| `panbot-service.mjs` | Bienvenidas y despedidas con banner, roles por botones, tickets, estancia en el canal AFK y voz con Gemini (pausada). |
| `kaze-features.mjs` | Funciones de KAZE: `/anime`, `/hoy`, `/ruleta`, estrenos diarios en #Anime-Chat, anuncio de nuevas APK en #Orunei-Updates y de salas de cine públicas en #Watch-Party. |
| `levels.mjs` | Niveles: XP por mensajes (1 vez por minuto) y por estar en llamada, rangos automáticos (roles "Nivel N+"), aviso al subir de nivel en #Chat-General, `/nivel` (tarjeta) y `/top`. Datos en `levels.json`. |
| `levels-backfill.mjs` | Calcula la XP inicial desde el historial de mensajes (se ejecutó una vez el 24/11/2026). |
| `pixel.mjs` + `pixel-font.mjs` | Motor pixel art (GIF animados con el estilo de los banners): bienvenida, despedida, subida de nivel y cabeceras de panel. Fuente pixel 5×7 propia. `pixel-welcome.mjs` solo reexporta la bienvenida. |
| `logs.mjs` | Registro en #Logs: entradas (avisa si la cuenta tiene menos de 7 días), salidas, expulsiones, baneos, aislamientos, cambios de roles y apodos, canales creados o borrados, con quién lo hizo. |
| `tickets.mjs` | Tickets: uno abierto por persona, canal privado en la zona staff visible para Co-Owner y Moderadores (con mención al abrirlo), cierre con confirmación solo por el autor o el staff, y registro de apertura y cierre en #Logs. |
| `server-permissions.mjs` | Permisos de canales: solo lectura en reglas, bienvenida, despedida, anuncios, niveles, roles, updates, caidas y el panel de tickets; el staff escribe en anuncios/updates y ve #Staff y #Logs. `node server-permissions.mjs` simula, `--apply` aplica. |
| `panels.mjs` | Publica los paneles de reglas, roles, niveles y tickets con cabecera animada (`node panels.mjs publish [clave]`) y borra los anteriores de PanBot. Edita los textos aquí y vuelve a publicar. |
| `cards.mjs` | Tarjeta PNG de `/nivel` (y una tarjeta estática de bienvenida que ya no se usa). Fuentes en `fonts/`. |
| `post-apk-update.mjs` | Anuncio manual largo de una versión de la APK (ya no hace falta: el bot la anuncia sola). |
| `.env.example` | Variables necesarias. El `.env` real vive solo en la VPS (`/opt/panbot/.env`, permisos 600). |

`state.json` y `levels.json` (solo en la VPS, entran en `backup-*` al desplegar) recuerda qué se anunció ya: el último día de estrenos, la última versión de la APK y las salas anunciadas.

## Actualizar el bot

```powershell
cd deploy\panbot
scp panbot-service.mjs kaze-features.mjs levels.mjs logs.mjs tickets.mjs cards.mjs pixel.mjs pixel-font.mjs pixel-welcome.mjs panels.mjs post-apk-update.mjs vps:/opt/panbot/
ssh vps "cd /opt/panbot && node --check panbot-service.mjs && pm2 restart panbot && pm2 logs panbot --lines 20 --nostream"
```

Si cambias `package.json`: `ssh vps "cd /opt/panbot && npm ci --omit=dev && pm2 restart panbot"`.

## Notas

- Los comandos se registran solos en el servidor al arrancar (aparecen al instante). Si sale "Missing Access", vuelve a invitar al bot con el permiso `applications.commands`.
- Los estrenos diarios salen a las `ESTRENOS_HOUR` (por defecto 9:00, hora de `KAZE_TZ`) y solo incluyen series con algo de público; `/hoy` muestra todos.
- Las salas se leen de Supabase con la clave de servicio (la misma que la web), solo lectura de `watch_party_rooms` públicas creadas en los últimos 15 minutos.
- Antes del 24/11/2026 el token estaba escrito en el código. Hay copias de esa versión en `/opt/panbot/backup-*` (solo root). Si alguna vez se filtra, regenera el token en el portal de desarrolladores de Discord y cámbialo en `.env`.
- **Rangos de nivel**: el rol de PanBot tiene que estar por encima de los roles "Nivel N+" (y de los de notificaciones) en Ajustes del servidor → Roles; si no, el bot no puede darlos. Revisa los rangos cada hora.
