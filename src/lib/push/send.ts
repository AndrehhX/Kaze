import "server-only";
import webpush from "web-push";
import { removeSubscription, subscriptionsFor, type PushSubscriptionJSON } from "@/lib/push/store";

/** Lo que muestra el service worker (public/sw.js → evento "push"). */
export type PushMessage = { title: string; body: string; url: string; icon?: string; tag?: string };

let configured: boolean | null = null;

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

function configure() {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://www.orunei.sbs", pub, priv);
  return (configured = true);
}

export function pushConfigured() {
  return configure();
}

async function sendOne(userId: string, sub: PushSubscriptionJSON, msg: PushMessage) {
  try {
    await webpush.sendNotification(sub, JSON.stringify(msg), { TTL: 6 * 3600, urgency: "normal", topic: msg.tag?.replace(/[^\w-]/g, "").slice(0, 32) });
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    // 404/410: el navegador anuló la suscripción (desinstaló, borró datos…). Se limpia.
    if (status === 404 || status === 410) await removeSubscription(userId, sub.endpoint).catch(() => {});
    return false;
  }
}

/** Envía un aviso a cada usuario (todas sus suscripciones). Devuelve cuántos envíos salieron bien. */
export async function sendPushToUsers(messages: Map<string, PushMessage>): Promise<number> {
  if (!configure() || !messages.size) return 0;
  const subs = await subscriptionsFor([...messages.keys()]);
  const jobs: Array<() => Promise<boolean>> = [];
  for (const [userId, list] of subs) {
    const msg = messages.get(userId)!;
    for (const s of list) jobs.push(() => sendOne(userId, s, msg));
  }
  let ok = 0;
  // Pocas a la vez: la VPS tiene 1 núcleo.
  for (let i = 0; i < jobs.length; i += 20) {
    const res = await Promise.all(jobs.slice(i, i + 20).map((j) => j()));
    ok += res.filter(Boolean).length;
  }
  return ok;
}
