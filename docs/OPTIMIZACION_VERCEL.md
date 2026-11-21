# Optimización de consumo en Vercel (orunei-v2)

> Fecha: 21 de noviembre de 2026 · Proyecto: `crunchy/` → Vercel `orunei-v2` detrás de Cloudflare (`www.orunei.sbs`).

## 1. Diagnóstico (5 días de una cuenta nueva)

| Recurso | Uso en 5 días | Proyección 30 días | Límite Hobby | Estado |
| --- | --- | --- | --- | --- |
| ISR Writes | 165K | ~990K | 200K | ❌ ~5× |
| Fluid Active CPU | 1h 51m | ~11h | 4h | ❌ ~2.8× |
| Fast Origin Transfer | 4.39 GB | ~26 GB | 10 GB | ❌ ~2.6× |
| CDN Requests | 230K | ~1.4M | 1M | ❌ ~1.4× |
| Web Analytics Events | 7.9K | ~47K | 50K | ⚠️ al límite |
| ISR Reads, Function Invocations, Provisioned Memory, CDN CPU, Storage | — | — | — | ✅ |

### Causas encontradas

1. **Cloudflare está delante pero no cachea nada.** `/`, `/anime/21` y `/api/anilist/suggest` responden `cf-cache-status: MISS/EXPIRED`: toda visita llega a Vercel.
2. **Las páginas `/anime/[id]` se regeneraban cada hora.** El cuerpo tenía `cacheLife("days")`, pero `getMediaDetail` usaba `cacheLife("hours")` y la ruta toma el más corto (en vivo: `x-vercel-cache: STALE`). Cada anime visitado = varias ISR Writes por hora.
3. **Cada `fetch` a AniList se guardaba en la Data Cache con `revalidate: 3600`**, incluido el autocompletado: cada letra escrita ("na", "nar", "naru"…) era una ISR Write.
4. **Búsquedas libres con `cacheLife("minutes")`**: se escribían en caché y casi nunca se reutilizaban.
5. **Cada deploy vacía la caché** y todo se vuelve a escribir.
6. **Bots**: el filtro está en `next.config.ts`, así que cada bot igual cuesta una petición en Vercel. `orunei-v2.vercel.app` se salta Cloudflare.

## 2. Lo que ya se hizo (código)

| Archivo | Cambio | Efecto |
| --- | --- | --- |
| `src/lib/anilist/client.ts` | `revalidate` de la Data Cache de **3600 → 86400** s. Nueva opción `persist: false` → `cache: "no-store"`. | ~24× menos reescrituras de datos de AniList. |
| `src/lib/anilist/service.ts` | `suggestMedia` usa `persist: false`. | El autocompletado ya no genera ISR Writes (sigue cacheado en memoria 10 min y en la CDN por `Cache-Control`). |
| `src/lib/anilist/service.ts` | `browseMedia`: las búsquedas con texto van **sin caché de servidor**; el catálogo sin búsqueda usa `cacheLife("days")` (antes `"hours"`). | Sin escrituras inútiles por búsqueda. |
| `src/lib/anilist/service.ts` | `getMediaDetail`, `getRecommendationsFor`, `getMediaBatch`, `getSeason`: `"hours"` → `"days"`. | `/anime/[id]` y `/anime/[id]/episodes` regeneran **cada 1 día** (antes cada 1 h), confirmado en `next build`. |
| `src/lib/media/provider.ts` | `getCachedAnimeSeries`: `"hours"` → `"days"`. | Menos regeneraciones de `/watch/...`. |
| `src/lib/anilist/manga-service.ts` | `suggestManga` usa `persist: false`. | Igual que el autocompletado de anime. |

**No se tocó:** la resolución de streams (`resolveCachedStream`, sigue en `"hours"` porque las URLs HLS caducan), la home ni `/seasonal` (son una sola página: su coste es mínimo), ni MangaDex (sección en mantenimiento). No se borró nada.

**Verificación:** `npm run typecheck` ✅ · `npm test` ✅ (102/102) · `npm run build` ✅.

**Contras:** los datos de AniList (puntuación, popularidad, descripciones) pueden tardar hasta 24 h en actualizarse en la web. Para un catálogo de anime es aceptable.

## 3. Lo que te toca hacer a ti

### 3.1 Desplegar (una sola vez)
Haz **un único** deploy a producción con este commit. Recuerda que cada deploy reinicia la caché: evita varios deploys seguidos.

### 3.2 Cloudflare: cachear de verdad (lo más importante)
Panel de Cloudflare → `orunei.sbs` → **Caching → Cache Rules → Create rule**:

- **Nombre:** `Cache paginas publicas Vercel`
- **Expresión** (botón *Edit expression*):
  ```
  (http.host eq "www.orunei.sbs"
   and (http.request.uri.path eq "/"
        or starts_with(http.request.uri.path, "/anime/")
        or http.request.uri.path in {"/seasonal" "/discover"}
        or starts_with(http.request.uri.path, "/discover/")
        or starts_with(http.request.uri.path, "/api/anilist/"))
   and not any(lower(http.request.headers.names[*])[*] eq "rsc"))
  ```
- **Cache eligibility:** *Eligible for cache*
- **Edge TTL:** *Ignore cache-control header and use this TTL* → **1 day**
- **Browser TTL:** *Respect origin*
- **Cache key:** dejar por defecto (incluye la query string).

Además, en **Caching → Tiered Cache** activa **Smart Tiered Caching** (gratis): así solo un datacenter de Cloudflare le pide la página a Vercel.

> La condición `rsc` deja fuera las peticiones internas de navegación de Next (payload RSC), porque Cloudflare ignora `Vary` y podría mezclar HTML con RSC. Cuando todo funcione bien, se puede estudiar cachearlas también.

**Comprobación:** abre `https://www.orunei.sbs/anime/21` dos veces y mira la cabecera `cf-cache-status` (F12 → Network). La segunda vez debe decir **HIT**.

### 3.3 Cloudflare: frenar bots antes de que lleguen a Vercel
- **Security → Bots:** activa **Bot Fight Mode** y **Block AI Scrapers and Crawlers**.
- **Security → WAF → Custom rules → Create:** *Block* cuando el User-Agent contenga los bots que ya bloqueas en `next.config.ts` (AhrefsBot, SemrushBot, MJ12bot, DotBot, Bytespider, PetalBot, DataForSeoBot, etc.), por ejemplo:
  ```
  (http.user_agent contains "AhrefsBot" or http.user_agent contains "SemrushBot" or http.user_agent contains "MJ12bot" or http.user_agent contains "DotBot" or http.user_agent contains "Bytespider" or http.user_agent contains "PetalBot" or http.user_agent contains "DataForSeoBot" or http.user_agent contains "BLEXBot" or http.user_agent contains "Barkrowler")
  ```
  Así se bloquean en Cloudflare y no consumen ni una petición de Vercel.

### 3.4 Vercel: cerrar la puerta trasera y los deploys de más
- **Project `orunei-v2` → Settings → Git → Ignored Build Step:** elige **"Only build production"**. Así las ramas y los PR no generan deploys (cada uno tiene su propia caché y consume).
- **Firewall → Custom Rule:** *Deny* cuando **Host** *ends with* `.vercel.app`. Así nadie usa `orunei-v2.vercel.app` para saltarse Cloudflare. ⚠️ Antes comprueba que tu dominio en Vercel es `www.orunei.sbs` (Settings → Domains).

### 3.5 Opcional: Web Analytics
Vas a ~47K de 50K eventos. Puedes quitar `<Analytics />` de `src/app/layout.tsx` y usar **Cloudflare Web Analytics** (gratis, sin límite de eventos).

### 3.6 Seguridad (aviso de Next.js)
`next build` avisa que **Next 16.4.3 tiene una vulnerabilidad conocida** y recomienda actualizar. No se tocó en este cambio; conviene hacerlo en un cambio aparte y probarlo.

## 4. Qué esperar después

Revisa el uso de Vercel **24–48 h** después del deploy y de las reglas de Cloudflare:

| Recurso | Estimado mensual con 2 + 3.2 |
| --- | --- |
| ISR Writes | < 100K (antes ~990K) |
| CDN Requests / Origin Transfer / CPU | bajan en proporción a los HIT de Cloudflare (objetivo: > 70 % HIT) |

Son estimaciones hechas a partir del código y las cabeceras en vivo. No se pudieron leer las métricas por ruta de Vercel porque el conector pide autorizar la cuenta. Si después del cambio algo sigue alto, esas métricas dirán qué ruta lo causa.

## 5. Nota de documentación
`ORUNEI_ESTADO_GLOBAL.md` (carpeta padre) dice que `crunchy/` está congelado y que se trabaja en `crunchy-prueba/`, que no existe. La realidad actual es: **`crunchy/` en Vercel + Cloudflare (DNS/proxy, Workers) + VPS (resolver)**. Conviene actualizar ese documento.
