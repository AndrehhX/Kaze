import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";

/**
 * Resumen semanal por correo: "Esta semana salieron N episodios de lo que sigues".
 * Lo lanza el cron de la VPS los domingos (POST /api/cron/weekly-digest).
 *
 *  1. Junta los avisos de episodios nuevos de los últimos 7 días (tabla `notifications`,
 *     los mismos que crea src/lib/episode-alerts.ts), agrupados por usuario.
 *  2. Solo a cuentas con correo confirmado que no se dieron de baja
 *     (app_metadata.weekly_digest === false = baja; se guarda en la cuenta, sin tocar tablas).
 *  3. Envía con la API de Brevo (BREVO_API_KEY + DIGEST_FROM_EMAIL en el .env de la VPS).
 *     Cada correo lleva un enlace de baja firmado y la cabecera List-Unsubscribe (baja en un clic).
 */

const WEEK_MS = 7 * 86_400_000;
/** Brevo gratis permite 300 correos al día: margen para los correos de registro. */
const MAX_PER_RUN = 250;

type Item = { mediaId: string; title: string; episode: number; cover: string; href: string };
export type DigestResult = { recipients: number; sent: number; skippedOptOut: number; skippedNoEmail: number; capped: number; errors: string[]; dryRun: boolean; sample: string[] };

// ── Enlace de baja firmado ─────────────────────────────────────────────
function secret() {
  return process.env.TOKEN_ENCRYPTION_KEY || process.env.CRON_SECRET || "";
}
export function unsubscribeToken(userId: string) {
  return createHmac("sha256", secret()).update(`digest|${userId}`).digest("base64url").slice(0, 32);
}
export function validUnsubscribeToken(userId: string, token: string) {
  if (!secret() || !token) return false;
  const a = Buffer.from(unsubscribeToken(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function unsubscribeUrl(userId: string) {
  return `${siteUrl}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}

/** Activa o desactiva el resumen para una cuenta (se guarda en app_metadata). */
export async function setDigestEnabled(userId: string, enabled: boolean) {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("Supabase admin no configurado");
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error("Cuenta no encontrada");
  const { error: upErr } = await db.auth.admin.updateUserById(userId, { app_metadata: { ...data.user.app_metadata, weekly_digest: enabled } });
  if (upErr) throw new Error(upErr.message);
}

export async function isDigestEnabled(userId: string) {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data } = await db.auth.admin.getUserById(userId);
  return data.user?.app_metadata?.weekly_digest !== false;
}

// ── Correo ─────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function renderEmail(items: Item[], unsubscribe: string) {
  const shown = items.slice(0, 8);
  const cards = shown
    .map(
      (i) => `
      <tr><td style="padding:8px 0">
        <a href="${siteUrl}${i.href}" style="text-decoration:none;color:#f4f1ff;display:block">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td width="64" valign="top">${i.cover ? `<img src="${esc(i.cover)}" width="64" height="90" alt="" style="border-radius:8px;display:block;object-fit:cover">` : ""}</td>
            <td style="padding-left:14px" valign="middle">
              <div style="font:600 15px/1.3 Arial,sans-serif;color:#f4f1ff">${esc(i.title)}</div>
              <div style="font:13px/1.4 Arial,sans-serif;color:#b7a8e8;margin-top:4px">Episodio ${i.episode} · Ver ahora →</div>
            </td>
          </tr></table>
        </a>
      </td></tr>`,
    )
    .join("");
  const more = items.length > shown.length ? `<p style="font:13px Arial,sans-serif;color:#9b93b8">…y ${items.length - shown.length} más en tu lista.</p>` : "";
  const n = items.length;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#0b0a14;padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:520px;background:#14122a;border-radius:16px;padding:24px" cellpadding="0" cellspacing="0">
      <tr><td style="font:800 20px Arial,sans-serif;color:#c084fc;letter-spacing:2px">KAZE 風</td></tr>
      <tr><td style="font:700 22px/1.3 Arial,sans-serif;color:#f4f1ff;padding-top:16px">Esta semana ${n === 1 ? "salió 1 episodio" : `salieron ${n} episodios`} de lo que sigues</td></tr>
      <tr><td style="font:14px/1.5 Arial,sans-serif;color:#b9b3d1;padding:8px 0 12px">Ponte al día cuando quieras:</td></tr>
      ${cards}
      <tr><td style="padding-top:18px">${more}
        <a href="${siteUrl}/library" style="display:inline-block;background:linear-gradient(90deg,#a855f7,#ec4899);color:#fff;font:700 15px Arial,sans-serif;padding:12px 22px;border-radius:999px;text-decoration:none">Abrir mi lista</a>
      </td></tr>
      <tr><td style="font:12px/1.5 Arial,sans-serif;color:#7d7699;padding-top:24px">
        KAZE es gratis y lo mantiene una sola persona. Si te gusta, puedes <a href="${siteUrl}/apoyar" style="color:#b7a8e8">apoyar el servidor</a>.<br>
        Te llega porque sigues estos animes en Orunei. ¿No quieres más resúmenes? <a href="${unsubscribe}" style="color:#b7a8e8">Darte de baja</a>.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [`Esta semana ${n === 1 ? "salió 1 episodio" : `salieron ${n} episodios`} de lo que sigues:`, ...shown.map((i) => `- ${i.title} · Episodio ${i.episode}: ${siteUrl}${i.href}`), "", `Darte de baja: ${unsubscribe}`].join("\n");
  return { html, text, subject: n === 1 ? `Nuevo episodio de ${shown[0].title}` : `${n} episodios nuevos de lo que sigues` };
}

async function sendBrevo(to: string, mail: { html: string; text: string; subject: string }, unsubscribe: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "KAZE · Orunei", email: process.env.DIGEST_FROM_EMAIL },
      to: [{ email: to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
      headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: ["weekly-digest"],
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

// ── Ejecución ──────────────────────────────────────────────────────────
export async function runWeeklyDigest({ now = Date.now(), dryRun = false, onlyUserId }: { now?: number; dryRun?: boolean; onlyUserId?: string } = {}): Promise<DigestResult> {
  const result: DigestResult = { recipients: 0, sent: 0, skippedOptOut: 0, skippedNoEmail: 0, capped: 0, errors: [], dryRun, sample: [] };
  const db = getSupabaseAdmin();
  if (!db) {
    result.errors.push("Supabase admin no configurado");
    return result;
  }
  if (!dryRun && (!process.env.BREVO_API_KEY || !process.env.DIGEST_FROM_EMAIL)) {
    result.errors.push("Faltan BREVO_API_KEY o DIGEST_FROM_EMAIL en el .env");
    return result;
  }

  let q = db
    .from("notifications")
    .select("user_id, payload, created_at")
    .eq("kind", "system")
    .eq("payload->>type", "new_episode")
    .gte("created_at", new Date(now - WEEK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(20000);
  if (onlyUserId) q = q.eq("user_id", onlyUserId);
  const { data: rows, error } = await q;
  if (error) {
    result.errors.push(`notifications: ${error.message}`);
    return result;
  }

  // Por usuario, el episodio más reciente de cada anime.
  const byUser = new Map<string, Map<string, Item>>();
  for (const r of (rows ?? []) as { user_id: string; payload: Record<string, string> }[]) {
    const p = r.payload;
    const items = byUser.get(r.user_id) ?? new Map<string, Item>();
    if (!items.has(p.media_id)) {
      const title = (p.message ?? "").replace(/^Nuevo episodio:\s*/, "").replace(/\s*·\s*Ep\.\s*\d+\s*$/, "") || "Anime";
      items.set(p.media_id, { mediaId: p.media_id, title, episode: Number(p.episode) || 0, cover: p.cover ?? "", href: p.href || `/anime/${p.media_id}` });
    }
    byUser.set(r.user_id, items);
  }
  result.recipients = byUser.size;
  if (!byUser.size) return result;

  // Correos y bajas (app_metadata), en páginas de 1000.
  const accounts = new Map<string, { email: string | null; confirmed: boolean; optedOut: boolean }>();
  for (let page = 1; page <= 50; page++) {
    const { data, error: uErr } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (uErr) {
      result.errors.push(`usuarios: ${uErr.message}`);
      break;
    }
    for (const u of data.users) accounts.set(u.id, { email: u.email ?? null, confirmed: Boolean(u.email_confirmed_at), optedOut: u.app_metadata?.weekly_digest === false });
    if (data.users.length < 1000) break;
  }

  for (const [userId, items] of byUser) {
    const acc = accounts.get(userId);
    if (!acc?.email || !acc.confirmed) {
      result.skippedNoEmail++;
      continue;
    }
    if (acc.optedOut) {
      result.skippedOptOut++;
      continue;
    }
    if (result.sent >= MAX_PER_RUN) {
      result.capped++;
      continue;
    }
    const list = [...items.values()];
    const unsub = unsubscribeUrl(userId);
    const mail = renderEmail(list, unsub);
    if (result.sample.length < 5) result.sample.push(`${userId.slice(0, 8)}… · ${mail.subject}`);
    if (dryRun) {
      result.sent++;
      continue;
    }
    try {
      await sendBrevo(acc.email, mail, unsub);
      result.sent++;
      await new Promise((r) => setTimeout(r, 150));
    } catch (e) {
      result.errors.push((e as Error).message);
      if (result.errors.length > 10) break;
    }
  }
  return result;
}
