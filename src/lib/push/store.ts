import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "redis";

/**
 * Suscripciones de avisos push del navegador, guardadas en el Redis local de la VPS
 * (no en Supabase: no necesitan esquema nuevo y el navegador las vuelve a enviar
 * en cada visita, así que perder Redis solo retrasa los avisos hasta la siguiente visita).
 *
 * Clave por usuario: kaze:push:u:<userId>  (hash: sha256(endpoint) → JSON de la suscripción)
 */

export type PushSubscriptionJSON = { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null };

const PREFIX = "kaze:push:u:";
const MAX_PER_USER = 10;

type Client = ReturnType<typeof createClient>;
let client: Client | null = null;
let connecting: Promise<Client | null> | null = null;

async function redis(): Promise<Client | null> {
  if (client?.isReady) return client;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const c = createClient({
        url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        socket: { connectTimeout: 2000, reconnectStrategy: (n) => (n > 5 ? false : 500) },
      });
      c.on("error", () => {}); // sin Redis (p. ej. en local) los avisos push simplemente se desactivan
      await c.connect();
      client = c;
      return c;
    } catch {
      return null;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

const field = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

export async function pushStoreAvailable() {
  return (await redis()) !== null;
}

export async function saveSubscription(userId: string, sub: PushSubscriptionJSON) {
  const r = await redis();
  if (!r) throw new Error("Almacén de avisos no disponible");
  const key = PREFIX + userId;
  await r.hSet(key, field(sub.endpoint), JSON.stringify({ ...sub, savedAt: Date.now() }));
  // Evita crecer sin límite si alguien abre la web en muchos navegadores.
  const all = await r.hGetAll(key);
  const entries = Object.entries(all);
  if (entries.length > MAX_PER_USER) {
    const oldest = entries
      .map(([f, v]) => [f, (JSON.parse(v) as { savedAt?: number }).savedAt ?? 0] as const)
      .sort((a, b) => a[1] - b[1])
      .slice(0, entries.length - MAX_PER_USER)
      .map(([f]) => f);
    if (oldest.length) await r.hDel(key, oldest);
  }
}

export async function removeSubscription(userId: string, endpoint: string) {
  const r = await redis();
  if (!r) return;
  await r.hDel(PREFIX + userId, field(endpoint));
}

/** Suscripciones de varios usuarios a la vez. */
export async function subscriptionsFor(userIds: string[]): Promise<Map<string, PushSubscriptionJSON[]>> {
  const out = new Map<string, PushSubscriptionJSON[]>();
  const r = await redis();
  if (!r || !userIds.length) return out;
  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const results = await Promise.all(chunk.map((id) => r.hGetAll(PREFIX + id)));
    chunk.forEach((id, j) => {
      const subs = Object.values(results[j] ?? {}).flatMap((v) => {
        try {
          return [JSON.parse(v) as PushSubscriptionJSON];
        } catch {
          return [];
        }
      });
      if (subs.length) out.set(id, subs);
    });
  }
  return out;
}
