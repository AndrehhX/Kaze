# Guía de mudanza de VPS (paso a paso)

> Para cuando caduque la VPS actual y haya que pasar **todo** a una nueva: la web, el resolver, Redis, el bot de Discord y el panel.
> Tiempo estimado: **45–90 min**. La web no se cae durante la mudanza: la VPS vieja sigue sirviendo hasta el cambio de DNS (paso 9).
> ⚠️ **Nunca escribas la IP de ninguna VPS en archivos del repo**: es público y Cloudflare la mantiene oculta.

## 0. Qué se muda

| Pieza | Dónde vive | Cómo se mueve |
| --- | --- | --- |
| Web Next.js | `/opt/orunei-web/` (servicio `orunei-web`) | `bootstrap-vps.sh` + `deploy-vps.ps1` |
| Variables de la web | `/opt/orunei-web/shared/.env` | Se copia de la VPS vieja |
| APK de la app móvil | `/opt/orunei-web/shared/downloads/kaze.apk` (Caddy la sirve en `/kaze.apk`) | Se copia de la VPS vieja |
| Resolver de streams | `/opt/kaze-resolver/` (PM2 `kaze-resolver`, puerto 3001) | Se copia la carpeta y se arranca con PM2 |
| Redis | servicio `redis-server` (caché del resolver) | Se instala nuevo; la caché se rellena sola |
| Bot de Discord | `/opt/panbot/` (PM2 `panbot`) | Se copia la carpeta y se arranca con PM2 |
| Caddy | `/etc/caddy/Caddyfile` (incluye el login del panel) | Se copia el archivo |
| Panel CasaOS | servicio `casaos` | **Opcional**, se reinstala si lo quieres |

## 1. Unos días antes
> 📅 **La VPS actual vence el 16 de diciembre de 2026.** Empieza la mudanza hacia el 10–12 de diciembre.

- [ ] Contrata la VPS nueva: **Ubuntu 24.04 (o 22.04), mínimo 1 vCPU / 2 GB RAM / 20 GB de disco**. Mejor 2 vCPU si el precio es parecido.
- [ ] Ten a mano: la **IP** y la **contraseña de root** de la VPS nueva (te las da el proveedor), y acceso a Cloudflare.
- [ ] Elige una hora de poco tráfico para el paso 9 (cambio de DNS).

## 2. Instalar tu llave SSH en la VPS nueva
En PowerShell (cambia `IP_NUEVA`). Escribes la contraseña de root una sola vez:
```powershell
Get-Content $HOME\.ssh\vps_orunei.pub | ssh root@IP_NUEVA "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

## 3. Crear el atajo `vps2`
```powershell
Add-Content -Encoding ascii $HOME\.ssh\config "`nHost vps2`n  HostName IP_NUEVA`n  User root`n  IdentityFile ~/.ssh/vps_orunei`n"
```
Comprueba que entra sin pedir contraseña:
```powershell
ssh vps2 "hostname; free -m"
```

## 4. Preparar la VPS nueva (bootstrap)
Desde la carpeta `crunchy`:
```powershell
ssh vps2 "mkdir -p /tmp/orunei-deploy"; scp deploy/* vps2:/tmp/orunei-deploy/
```
> Copia el **contenido** de `deploy/`. Con `scp -r deploy ...`, si la carpeta ya existe en la VPS, se crea `orunei-deploy/deploy/` y se ejecuta un bootstrap viejo.
```powershell
ssh vps2 "sed -i 's/\r$//' /tmp/orunei-deploy/*.sh /tmp/orunei-deploy/*.service && bash /tmp/orunei-deploy/bootstrap-vps.sh"
```
Instala o deja listo: Node 22, Caddy, el usuario `orunei`, el servicio `orunei-web`, el auto-reinicio, la swap, el firewall (80/443 solo para Cloudflare) y SSH solo con llave.

> Es normal que al final avise de que el `.env` está vacío y de que falta el bloque de Caddy: se resuelve en el paso 5.

## 5. Copiar archivos de la VPS vieja a la nueva
Pasa por tu PC en 3 comandos. No uses una tubería `|` de PowerShell entre los dos `ssh`: corrompe los archivos binarios.
```powershell
ssh vps "tar -czf /tmp/migracion.tgz /opt/orunei-web/shared/.env /opt/orunei-web/shared/downloads /etc/caddy/Caddyfile /opt/kaze-resolver /opt/panbot"
```
```powershell
scp vps:/tmp/migracion.tgz $env:TEMP\migracion.tgz; scp $env:TEMP\migracion.tgz vps2:/tmp/migracion.tgz
```
```powershell
ssh vps2 "tar -xzf /tmp/migracion.tgz -C / && chown orunei:orunei /opt/orunei-web/shared/.env && chmod 600 /opt/orunei-web/shared/.env && caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile && systemctl reload caddy"
```
> El paquete lleva secretos (variables de Supabase y la configuración del bot). Cuando termine la mudanza, borra `$env:TEMP\migracion.tgz` de tu PC y `/tmp/migracion.tgz` de las dos VPS.

## 6. Redis, PM2, resolver y bot en la VPS nueva
```powershell
ssh vps2 "apt-get update && apt-get install -y redis-server && systemctl enable --now redis-server && npm install -g pm2"
```
```powershell
ssh vps2 "pm2 start /opt/kaze-resolver/server.js --name kaze-resolver --cwd /opt/kaze-resolver && pm2 save && pm2 startup systemd -u root --hp /root"
```
Comprueba el resolver:
```powershell
ssh vps2 "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/"
```
> ⚠️ **Todavía no arranques el bot (`panbot`) en la VPS nueva.** Si corre en las dos a la vez, el bot responde dos veces en Discord. Se cambia en el paso 9.

## 7. Desplegar la web en la VPS nueva
Desde `crunchy`:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy-vps.ps1 -Server vps2
```
Debe terminar con `== Deploy completado`.

## 8. Probar la VPS nueva por dentro (antes de tocar el DNS)
```powershell
ssh vps2 "for h in www.orunei.sbs resolver.orunei.sbs panel.orunei.sbs; do printf '%s -> ' \$h; curl -s -o /dev/null -w '%{http_code}\n' -H \"Host: \$h\" http://127.0.0.1/; done; free -m | head -2"
```
Esperado: `www` → **200**, `resolver` → **200**, `panel` → **401** (o 502 si no instalaste CasaOS).

Prueba de reproducción:
```powershell
ssh vps2 "curl -s -H 'Host: www.orunei.sbs' 'http://127.0.0.1/api/playback/session?seriesId=21&episodeId=1' | grep -c workers.dev"
```
Esperado: un número mayor que `0`.

## 9. Cambio de tráfico (el momento de la mudanza)
1. **Bot:** apágalo en la vieja y arráncalo en la nueva:
   ```powershell
   ssh vps "pm2 stop panbot && pm2 save"
   ```
   ```powershell
   ssh vps2 "pm2 start /opt/panbot/panbot-service.mjs --name panbot --cwd /opt/panbot && pm2 save"
   ```
2. **Cloudflare → DNS → Records:** cambia el contenido a la **IP nueva**, manteniendo la nube **naranja (Proxied)**, en:
   - `www`
   - `orunei.sbs` (si es un registro A)
   - `resolver`
   - `panel`
   - `vps` (si existe)
3. No toques la Configuration Rule de SSL (`VPS Services Flexible SSL`): sirve igual para la VPS nueva.

## 10. Verificar desde fuera (2–5 min después)
```powershell
foreach ($u in "https://www.orunei.sbs/","https://www.orunei.sbs/anime/21","https://resolver.orunei.sbs/","https://panel.orunei.sbs/") { try { $r = Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 30; "$u -> $($r.StatusCode)" } catch { "$u -> $($_.Exception.Response.StatusCode.value__)" } }
```
Esperado: 200, 200, 200 y 401. Después, en el navegador (incógnito): inicio, un anime, **reproducir un episodio**, iniciar sesión y comprobar que el bot responde en Discord.

Comprueba que el tráfico llega a la nueva:
```powershell
ssh vps2 "journalctl -u orunei-web --since '-5 min' --no-pager | tail -5; systemctl is-active orunei-web"
```

## 11. Dejar todo ordenado
1. En `C:\Users\Andreh\.ssh\config`, cambia el `HostName` de `Host vps` por la IP nueva. A partir de ahí `ssh vps` y `deploy-vps.ps1` (sin `-Server`) apuntan a la nueva.
2. Deja la VPS vieja **encendida 1–2 días** por si hay que volver atrás. Después ya puede caducar.
3. Borra los paquetes temporales con secretos (paso 5).
4. Opcional: crea de nuevo la contraseña del panel en la VPS nueva con `ssh -t vps caddy hash-password` y actualiza el `Caddyfile`.

## 12. Volver atrás (si algo sale mal)
1. Cloudflare: devuelve los registros a la **IP vieja**.
2. Bot: `ssh vps2 "pm2 stop panbot && pm2 save"` y `ssh vps "pm2 start panbot && pm2 save"`.
3. Último recurso para la web: apuntar `www` a Vercel (CNAME `cname.vercel-dns.com`). El proyecto `orunei-v2` sigue ahí sin tráfico.

## 13. Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| Error **521/522** de Cloudflare | Caddy apagado o el firewall no tiene los rangos de Cloudflare | `ssh vps2 "systemctl status caddy; /opt/orunei-web/bin/ufw-cloudflare.sh"` |
| Error **502** | La web (`orunei-web`) no corre | `ssh vps2 "journalctl -u orunei-web -n 50 --no-pager"`, y vuelve a desplegar |
| Error **525/526** | Modo SSL de Cloudflare | Revisa que la regla `VPS Services Flexible SSL` incluya el host |
| Los episodios no cargan | El resolver no corre | `ssh vps2 "pm2 ls; pm2 logs kaze-resolver --lines 30 --nostream"` |
| El bot responde dos veces | `panbot` corriendo en las dos VPS | Paso 9.1 |
| `ssh vps2` pide contraseña | La llave no se instaló | Repite el paso 2 |
| El deploy falla en la activación | Revisa el mensaje; se restauró solo el release anterior | `journalctl -u orunei-web -n 50` |

## 14. Checklist final
- [ ] `ssh vps2` entra sin contraseña
- [ ] Bootstrap sin errores
- [ ] `.env`, Caddyfile, resolver y bot copiados
- [ ] Resolver en 200 en `127.0.0.1:3001`
- [ ] Deploy completado
- [ ] Pruebas internas: www 200 · resolver 200 · panel 401 · playback OK
- [ ] Bot movido (apagado en la vieja, encendido en la nueva)
- [ ] DNS cambiado (www, raíz, resolver, panel, vps) con proxy naranja
- [ ] Pruebas externas y en el navegador OK
- [ ] `~/.ssh/config` actualizado
- [ ] Paquetes temporales borrados
- [ ] VPS vieja encendida 1–2 días de respaldo
