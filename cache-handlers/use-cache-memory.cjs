/**
 * Gestor de caché para "use cache" (cacheHandlers.default) en la VPS.
 *
 * Por qué existe: en Next 16.4, con `cacheMaxMemorySize: 0` el gestor por defecto devuelve
 * `set: () => Promise.resolve()` y NUNCA lee el stream de cada entrada; ese stream retiene la
 * petición completa y la memoria crecía ~1 MB por ficha de anime hasta caer por OOM.
 * Con el valor por defecto, la caché ISR en memoria mide mal el tamaño de las páginas y
 * también crecía sin tope real. Solución: caché ISR en memoria desactivada (solo disco) y
 * este gestor para "use cache", que:
 *   - siempre consume el stream (también si la entrada se descarta),
 *   - guarda solo bytes (Uint8Array) en un LRU con tope REAL en bytes,
 *   - respeta revalidate/expire y las etiquetas (revalidateTag/updateTag) como el original.
 */
"use strict";

const MAX_BYTES = Number(process.env.USE_CACHE_MAX_BYTES || 48 * 1024 * 1024); // 48 MB

/** key -> { meta, value: Uint8Array, size } ; el orden del Map es el orden LRU. */
const store = new Map();
let totalBytes = 0;
/** tag -> { stale?: number, expired?: number } (ms) */
const tagState = new Map();

const now = () => performance.timeOrigin + performance.now();

async function drain(stream) {
  try {
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

function remove(key) {
  const item = store.get(key);
  if (!item) return;
  totalBytes -= item.size;
  store.delete(key);
}

function evict() {
  for (const key of store.keys()) {
    if (totalBytes <= MAX_BYTES) break;
    remove(key);
  }
}

function tagsExpired(tags, timestamp) {
  const t = now();
  for (const tag of tags) {
    const s = tagState.get(tag);
    if (s && typeof s.expired === "number" && s.expired <= t && s.expired > timestamp) return true;
  }
  return false;
}

function tagsStale(tags, timestamp) {
  for (const tag of tags) {
    const s = tagState.get(tag);
    if (s && typeof s.stale === "number" && s.stale > timestamp) return true;
  }
  return false;
}

module.exports = {
  async get(cacheKey, softTags) {
    const item = store.get(cacheKey);
    if (!item) return undefined;
    const { meta, value } = item;
    // Igual que el gestor de Next en producción: pasado `revalidate`, se trata como fallo.
    if (meta.expire < 0 || now() > meta.timestamp + meta.revalidate * 1000) {
      remove(cacheKey);
      return undefined;
    }
    const allTags = softTags && softTags.length ? meta.tags.concat(softTags) : meta.tags;
    if (tagsExpired(allTags, meta.timestamp)) {
      remove(cacheKey);
      return undefined;
    }
    // Marcar como usado recientemente (al final del Map).
    store.delete(cacheKey);
    store.set(cacheKey, item);
    return {
      ...meta,
      revalidate: tagsStale(allTags, meta.timestamp) ? -1 : meta.revalidate,
      value: new ReadableStream({
        start(controller) {
          controller.enqueue(value);
          controller.close();
        },
      }),
    };
  },

  async set(cacheKey, pendingEntry) {
    let entry;
    try {
      entry = await pendingEntry;
    } catch {
      return;
    }
    // Siempre se lee el stream, aunque luego no se guarde: así no retiene la petición.
    const value = await drain(entry.value);
    if (!value) return; // stream con error: valor incompleto, se descarta
    if (entry.expire === 0) return; // entrada dinámica: Next la regenera siempre
    if (value.byteLength > MAX_BYTES / 4) return; // entradas gigantes no compensan
    const { value: _stream, ...meta } = entry;
    void _stream;
    remove(cacheKey);
    store.set(cacheKey, { meta, value, size: value.byteLength + cacheKey.length });
    totalBytes += value.byteLength + cacheKey.length;
    evict();
  },

  async refreshTags() {
    // Caché en memoria de una sola instancia: nada que sincronizar.
  },

  async getExpiration(tags) {
    let max = 0;
    for (const tag of tags) {
      const s = tagState.get(tag);
      if (s && typeof s.expired === "number" && s.expired > max) max = s.expired;
    }
    return max;
  },

  async updateTags(tags, durations) {
    const t = Math.round(now());
    for (const tag of tags) {
      const prev = tagState.get(tag) || {};
      if (durations) {
        const next = { ...prev, stale: t };
        if (durations.expire !== undefined) next.expired = t + durations.expire * 1000;
        tagState.set(tag, next);
      } else {
        tagState.set(tag, { ...prev, expired: t });
      }
    }
  },
};
