import { connection } from "next/server";
import { z } from "zod";
import { json, limitOrNull } from "@/lib/api-response";
import { getRequestUser } from "@/lib/supabase/server";
import { pushStoreAvailable, removeSubscription, saveSubscription } from "@/lib/push/store";
import { pushConfigured, sendPushToUsers, vapidPublicKey } from "@/lib/push/send";

/**
 * Avisos push del navegador (episodios nuevos de lo que sigues).
 *   GET    → { enabled, publicKey }   ¿está activo en el servidor?
 *   POST   { subscription, welcome? } guarda la suscripción del navegador (con sesión)
 *   DELETE { endpoint }               la quita
 */

const subSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

export async function GET(req: Request) {
  await connection();
  const limited = limitOrNull(req, "push-get", 30);
  if (limited) return limited;
  const enabled = pushConfigured() && (await pushStoreAvailable());
  return json({ enabled, publicKey: enabled ? vapidPublicKey() : null });
}

export async function POST(req: Request) {
  const limited = limitOrNull(req, "push-post", 12, 10 * 60_000);
  if (limited) return limited;
  const body = z.object({ subscription: subSchema, welcome: z.boolean().optional() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Suscripción no válida" }, { status: 400 });
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Inicia sesión para activar los avisos" }, { status: 401 });
  if (!pushConfigured()) return json({ error: "Los avisos push no están configurados en este servidor" }, { status: 503 });
  try {
    await saveSubscription(user.id, body.data.subscription);
  } catch {
    return json({ error: "No se pudo guardar la suscripción. Inténtalo más tarde." }, { status: 503 });
  }
  if (body.data.welcome) {
    await sendPushToUsers(
      new Map([[user.id, { title: "Avisos activados", body: "Te avisaremos aquí cuando salga un episodio nuevo de lo que sigues.", url: "/library", tag: "kaze-welcome" }]]),
    ).catch(() => 0);
  }
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const limited = limitOrNull(req, "push-delete", 12, 10 * 60_000);
  if (limited) return limited;
  const body = z.object({ endpoint: z.string().url().max(1000) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Petición no válida" }, { status: 400 });
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Sin sesión" }, { status: 401 });
  await removeSubscription(user.id, body.data.endpoint).catch(() => {});
  return json({ ok: true });
}
