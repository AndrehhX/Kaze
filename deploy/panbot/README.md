# PanBot (bot de Discord de Orunei)

Corre en la VPS con PM2 (`pm2 status` → `panbot`), en `/opt/panbot`.

| Archivo | Qué hace |
| --- | --- |
| `panbot-service.mjs` | Bienvenida al aceptar las reglas (con rol 🧈 Panita Verificado), despedida solo si estuvo 10+ min y no fue baneo ni expulsión, roles por botones, aviso al rol Ofertas Gratis, tickets, estancia en el canal AFK y voz con Gemini (pausada). Registra todos los comandos. |
| `kaze-features.mjs` | Funciones de KAZE: `/anime`, `/hoy`, `/ruleta`, estrenos diarios en #Anime-Chat, anuncio de nuevas APK en #Orunei-Updates y de salas de cine públicas en #Watch-Party. |
| `levels.mjs` | Niveles: XP por mensajes (1 vez por minuto) y por llamada (2+ personas con el micro abierto, tope diario), rangos automáticos (roles "Nivel N+"), subidas en #Niveles y solo los rangos nuevos en #Chat-General, resumen semanal los lunes, `/nivel` (tarjeta) y `/top`. Datos en `levels.json`. |
| `levels-backfill.mjs` | Calcula la XP inicial desde el historial de mensajes (se ejecutó una vez el 24/11/2026). |
| `pixel.mjs` + `pixel-font.mjs` | Motor pixel art (GIF animados con el estilo de los banners): bienvenida, despedida, subida de nivel y cabeceras de panel. Fuente pixel 5×7 propia. `pixel-welcome.mjs` solo reexporta la bienvenida. |
| `logs.mjs` | Registro en #Logs: entradas (avisa si la cuenta tiene menos de 7 días), salidas, expulsiones, baneos, aislamientos, cambios de roles y apodos, canales creados o borrados, con quién lo hizo. |
| `tickets.mjs` | Tickets: uno abierto por persona, canal privado en la zona staff visible para Co-Owner y Moderadores (con mención al abrirlo), cierre con confirmación solo por el autor o el staff, y registro de apertura y cierre en #Logs. |
| `follows.mjs` | `/seguir`, `/siguiendo`, `/dejar-de-seguir`: aviso por DM de cada capítulo nuevo (1 h después del estreno) con botón a KAZE. Datos en `follows.json`. |
| `birthdays.mjs` | `/cumple poner|quitar|proximos` y felicitación diaria en #Chat-General. Datos en `birthdays.json`. |
| `status.mjs` | Revisa la web y el resolver cada 2 min y avisa en #caidas cuando se caen y cuando vuelven (no cubre la caída de toda la VPS: eso es del monitor externo). Estado en `status.json`. |
| `tempvoice.mjs` | "➕ Crear sala": crea una sala de voz propia y la borra al quedar vacía; desde Plata el dueño la puede renombrar. Datos en `tempvoice.json`. |
| `starboard.mjs` | #Destacados: con 3 ⭐ (las de Oro valen doble) se reenvía el mensaje. Solo canales públicos. Datos en `starboard.json`. |
| `ai.mjs` | PanBot con IA (Gemini): contesta cuando la mencionan o le responden, con fichas de AniList y botón a KAZE; `/resumen [horas]` resume el canal (solo lo ve quien lo pide). Modelos en orden con respaldo (`GEMINI_TEXT_MODELS`) y tope de uso. Requiere el intent Message Content (activado en la app). |
| `orunei-link.mjs` | `/orunei vincular|confirmar|desvincular|perfil|viendo` y `/wrapped`: vincula la cuenta de Orunei comprobando un código en la bio, roles por episodios vistos (🔗 Orunei, 📺 10+, 🍿 100+, 🏆 500+), aviso opcional en #watch-party de lo que alguien empieza a ver (respeta el historial oculto) y Wrapped del mes por DM el día 1. **Apoya KAZE**: roles 🍃 Brisa / 🌀 Viento / ⚡ Tormenta y ★ Fundador según la tabla `supporters`, y agradecimiento en #💜・apoyos cuando alguien empieza a apoyar (solo si eligió salir en el muro). El canal privado #⚡・tormenta es solo para ese rol. Solo lee Supabase. Datos en `orunei-links.json`. |
| `server-setup.mjs` | Orden del servidor (repetible): rol Ofertas Gratis, categoría Archivo, #Destacados, ➕ Crear sala, canal del sistema, pantalla de bienvenida, onboarding, permisos de Jockie, AutoMod y rol de verificado. `node server-setup.mjs` simula, `--apply` aplica. |
| `channel-names.mjs` | Nombres de canales y categorías con un solo estilo (emoji + ・ + negrita Unicode, en español). `node channel-names.mjs` simula, `--apply` aplica. |
| `server-permissions.mjs` | Permisos de canales: solo lectura en reglas, bienvenida, despedida, anuncios, niveles, roles, updates, caidas y el panel de tickets; el staff escribe en anuncios/updates y ve #Staff y #Logs. `node server-permissions.mjs` simula, `--apply` aplica. |
| `panels.mjs` | Publica los paneles de reglas, roles, niveles y tickets con cabecera animada (`node panels.mjs publish [clave]`) y borra los anteriores de PanBot. Edita los textos aquí y vuelve a publicar. |
| `cards.mjs` | Tarjeta PNG de `/nivel` (y una tarjeta estática de bienvenida que ya no se usa). Fuentes en `fonts/`. |
| `post-apk-update.mjs` | Anuncio manual largo de una versión de la APK (ya no hace falta: el bot la anuncia sola). |
| `.env.example` | Variables necesarias. El `.env` real vive solo en la VPS (`/opt/panbot/.env`, permisos 600). |

`state.json`, `levels.json`, `panels.json` y los `*.json` de cada función (solo en la VPS, entran en `backup-*` al desplegar) recuerda qué se anunció ya: el último día de estrenos, la última versión de la APK y las salas anunciadas.

## Actualizar el bot

```powershell
cd deploy\panbot
scp panbot-service.mjs kaze-features.mjs levels.mjs logs.mjs tickets.mjs cards.mjs pixel.mjs pixel-font.mjs pixel-welcome.mjs panels.mjs post-apk-update.mjs server-setup.mjs follows.mjs birthdays.mjs status.mjs tempvoice.mjs starboard.mjs ai.mjs orunei-link.mjs channel-names.mjs vps:/opt/panbot/
ssh vps "cd /opt/panbot && node --check panbot-service.mjs && pm2 restart panbot && pm2 logs panbot --lines 20 --nostream"
```

Si cambias `package.json`: `ssh vps "cd /opt/panbot && npm ci --omit=dev && pm2 restart panbot"`.

## Notas

- Los comandos se registran solos en el servidor al arrancar (aparecen al instante). Si sale "Missing Access", vuelve a invitar al bot con el permiso `applications.commands`.
- Los estrenos diarios salen a las `ESTRENOS_HOUR` (por defecto 9:00, hora de `KAZE_TZ`) y solo incluyen series con algo de público; `/hoy` muestra todos.
- Las salas se leen de Supabase con la clave de servicio (la misma que la web), solo lectura de `watch_party_rooms` públicas creadas en los últimos 15 minutos.
- Antes del 24/11/2026 el token estaba escrito en el código. Hay copias de esa versión en `/opt/panbot/backup-*` (solo root). Si alguna vez se filtra, regenera el token en el portal de desarrolladores de Discord y cámbialo en `.env`.
- **Rangos de nivel**: el rol de PanBot tiene que estar por encima de los roles "Nivel N+" (y de los de notificaciones) en Ajustes del servidor → Roles; si no, el bot no puede darlos. Revisa los rangos cada hora.
- **Paneles**: `node panels.mjs publish roles levels` solo borra los paneles anteriores (mensajes con la cabecera `panel.gif`), nunca los avisos de nivel. El de niveles queda fijado.
- **Chats generales**: 💬・chat-general es el público (aquí entran los nuevos, mensajes del sistema y celebraciones); 🧈・chat-general (antes chat-og) es el de siempre, solo para los OG, y es el único canal donde PanBot habla como "Pana".
- **Onboarding** (al entrar por invitación, antes de ver el server): "¿Qué te trae por aquí?" (obligatoria: anime, manga, juegos, ver anime en grupo) y "¿De qué quieres que te avisemos?" (novedades, juegos gratis, anuncios, beta de la app). Cada opción da su rol.
- **MCP de Discord**: en la VPS hay un servidor MCP (`/opt/panbot-mcp/run.sh`, `discord-mcp`) que usa el token de PanBot para que un agente de IA pueda administrar el server; sin acceso a los comandos slash para no pisar los de PanBot.
- **Staff** (25/11/2026): 👑 Co-Owner → CriXX (dueño del server) y Andreh; 🛡️ Moderador → Denyer. Ven #Staff, #Logs y los tickets.
