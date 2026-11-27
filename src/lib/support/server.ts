import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  CURRENT_POLL,
  FOUNDER_LIMIT,
  MONTHLY_GOAL,
  computeStatus,
  parseEquipped,
  tierFromAmount,
  tierFromName,
  usernameFromMessage,
  validateEquip,
  activeTier,
  type Equipped,
  type PaymentLite,
  type TierLevel,
} from "./tiers";

/**
 * Apoya KAZE (servidor): webhook de Ko-fi, vincular pagos a cuentas y estadísticas de /apoyar.
 * Todo con la clave de servicio: las tablas supporters/supporter_payments no se pueden escribir desde el navegador.
 */

export type KofiPayload = {
  verification_token?: string;
  message_id?: string;
  timestamp?: string;
  type?: string;
  is_public?: boolean;
  from_name?: string;
  message?: string | null;
  amount?: string;
  email?: string;
  currency?: string;
  is_subscription_payment?: boolean;
  is_first_subscription_payment?: boolean;
  kofi_transaction_id?: string;
  tier_name?: string | null;
};

function admin() {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("Supabase admin no configurado");
  return db;
}

/** Ko-fi manda el token en cada aviso: así sabemos que el aviso viene de Ko-fi de verdad. */
export function validKofiToken(token: string | undefined) {
  const secret = process.env.KOFI_VERIFICATION_TOKEN;
  if (!secret || !token) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Nivel que da un pago de Ko-fi (0 = no da nada, p. ej. menos de 2 US$). */
export function tierForPayment(p: KofiPayload): 0 | TierLevel {
  const amount = Number(p.amount) || 0;
  if (p.is_subscription_payment) return tierFromName(p.tier_name) || tierFromAmount(amount);
  return tierFromAmount(amount);
}

async function userIdByUsername(username: string) {
  const { data } = await admin().from("profiles").select("id").ilike("username", username).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Busca la cuenta con ese correo (confirmado). */
async function userIdByEmail(email: string) {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const db = admin();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target && u.email_confirmed_at);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/** Recalcula el nivel de una cuenta con todos sus pagos y lo guarda. */
export async function recomputeSupporter(userId: string) {
  const db = admin();
  const [{ data: pays }, { data: row }] = await Promise.all([
    db.from("supporter_payments").select("tier, amount, is_subscription, received_at").eq("user_id", userId).order("received_at", { ascending: false }).limit(500),
    db.from("supporters").select("user_id, founder, manual_tier, manual_until, last_payment_at").eq("user_id", userId).maybeSingle(),
  ]);
  const payments = ((pays ?? []) as { tier: number | null; amount: number | string; is_subscription: boolean; received_at: string }[]).map<PaymentLite>((p) => ({ ...p, amount: Number(p.amount) || 0 }));
  const status = computeStatus(payments, row ? { tier: row.manual_tier, until: row.manual_until } : null);
  if (!status) return null;

  let founder = Boolean(row?.founder);
  if (!founder && payments.length > 0) {
    const { count } = await db.from("supporters").select("user_id", { count: "exact", head: true }).eq("founder", true);
    founder = (count ?? 0) < FOUNDER_LIMIT;
  }
  const patch = {
    user_id: userId,
    tier: status.tier,
    expires_at: status.expires_at,
    founder,
    last_payment_at: payments[0]?.received_at ?? row?.last_payment_at ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("supporters").upsert(patch, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  return patch;
}

/** Procesa un aviso de Ko-fi. Idempotente: si Ko-fi repite el aviso, no se cuenta dos veces. */
export async function handleKofiPayment(p: KofiPayload) {
  const db = admin();
  const txId = (p.kofi_transaction_id ?? "").trim();
  if (!txId) return { ok: false as const, reason: "sin transacción" };

  const { data: existing } = await db.from("supporter_payments").select("id, user_id").eq("kofi_transaction_id", txId).maybeSingle();
  if (existing) return { ok: true as const, duplicate: true, linked: Boolean(existing.user_id) };

  const tier = tierForPayment(p);
  const named = usernameFromMessage(p.message);
  const userId = (named && (await userIdByUsername(named))) || (p.email ? await userIdByEmail(p.email) : null);

  const { error } = await db.from("supporter_payments").insert({
    kofi_transaction_id: txId,
    message_id: p.message_id ?? null,
    type: (p.type ?? "Donation").slice(0, 40),
    tier_name: p.tier_name ?? null,
    tier: tier || null,
    amount: Number(p.amount) || 0,
    currency: (p.currency ?? "USD").slice(0, 8),
    email: p.email ? p.email.trim().toLowerCase().slice(0, 320) : null,
    from_name: (p.from_name ?? "").slice(0, 80) || null,
    message: p.message ? p.message.slice(0, 500) : null,
    is_public: Boolean(p.is_public),
    is_subscription: Boolean(p.is_subscription_payment),
    user_id: userId,
    received_at: p.timestamp && Number.isFinite(Date.parse(p.timestamp)) ? new Date(p.timestamp).toISOString() : new Date().toISOString(),
  });
  if (error) {
    if (/duplicate key/i.test(error.message)) return { ok: true as const, duplicate: true, linked: false };
    throw new Error(error.message);
  }
  if (userId && tier) await recomputeSupporter(userId);
  return { ok: true as const, duplicate: false, linked: Boolean(userId), tier };
}

/** Vincula a mano un pago que no se pudo asociar (otro correo y sin @usuario en el mensaje). */
export async function claimPayment(userId: string, transactionId: string, email: string) {
  const db = admin();
  const { data } = await db.from("supporter_payments").select("id, user_id, email").eq("kofi_transaction_id", transactionId.trim()).maybeSingle();
  if (!data || (data.email ?? "") !== email.trim().toLowerCase()) return { ok: false as const, error: "No encontramos un pago con ese código y ese correo." };
  if (data.user_id && data.user_id !== userId) return { ok: false as const, error: "Ese pago ya está vinculado a otra cuenta." };
  if (!data.user_id) {
    const { error } = await db.from("supporter_payments").update({ user_id: userId }).eq("id", data.id).is("user_id", null);
    if (error) return { ok: false as const, error: "No se pudo vincular. Inténtalo de nuevo." };
  }
  await recomputeSupporter(userId);
  return { ok: true as const };
}

export async function getMySupport(userId: string) {
  const db = admin();
  const [{ data: row }, { data: vote }] = await Promise.all([
    db.from("supporters").select("tier, expires_at, founder, since, show_on_wall, equipped").eq("user_id", userId).maybeSingle(),
    db.from("supporter_votes").select("option").eq("user_id", userId).eq("poll", CURRENT_POLL.id).maybeSingle(),
  ]);
  return {
    supporter: row ? { ...row, equipped: parseEquipped(row.equipped) } : null,
    activeTier: activeTier(row),
    vote: (vote?.option as string | undefined) ?? null,
  };
}

/** Guarda los cosméticos puestos, comprobando que el nivel activo los permite. */
export async function saveEquipped(userId: string, next: Equipped, showOnWall?: boolean) {
  const db = admin();
  const { data: row } = await db.from("supporters").select("tier, expires_at, founder").eq("user_id", userId).maybeSingle();
  const tier = activeTier(row);
  const clean = parseEquipped(next);
  const hasCosmetics = Object.keys(clean).length > 0;
  if (!row) return { ok: false as const, error: "Todavía no apoyas a KAZE." };
  if (hasCosmetics) {
    if (!tier) return { ok: false as const, error: "Tu apoyo venció: renuévalo para usar los cosméticos." };
    const err = validateEquip(clean, tier);
    if (err) return { ok: false as const, error: err };
  }
  const patch: Record<string, unknown> = { equipped: clean, updated_at: new Date().toISOString() };
  if (typeof showOnWall === "boolean") patch.show_on_wall = showOnWall;
  const { error } = await db.from("supporters").update(patch).eq("user_id", userId);
  if (error) return { ok: false as const, error: "No se pudo guardar." };
  return { ok: true as const };
}

export async function castVote(userId: string, option: string) {
  if (!CURRENT_POLL.options.some((o) => o.id === option)) return { ok: false as const, error: "Opción no válida." };
  const db = admin();
  const { data: row } = await db.from("supporters").select("tier, expires_at, founder").eq("user_id", userId).maybeSingle();
  if (activeTier(row) < 3) return { ok: false as const, error: "Las votaciones son para quienes están en Tormenta." };
  const { error } = await db.from("supporter_votes").upsert({ user_id: userId, poll: CURRENT_POLL.id, option, created_at: new Date().toISOString() }, { onConflict: "user_id,poll" });
  if (error) return { ok: false as const, error: "No se pudo guardar tu voto." };
  return { ok: true as const };
}

export type WallEntry = { username: string; display_name: string; avatar_url: string | null; tier: number; founder: boolean; active: boolean };

/** Datos públicos de /apoyar: meta del mes, lo recaudado, el muro y la encuesta (sin correos ni importes individuales). */
export async function supportStats(now = new Date()) {
  const db = admin();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [{ data: pays }, { data: wall }, { count: founders }, { data: votes }] = await Promise.all([
    db.from("supporter_payments").select("amount, currency").gte("received_at", monthStart).limit(5000),
    db.from("supporters").select("tier, expires_at, founder, since, profile:profiles!supporters_user_id_fkey(username, display_name, avatar_url)").eq("show_on_wall", true).order("tier", { ascending: false }).order("since").limit(300),
    db.from("supporters").select("user_id", { count: "exact", head: true }).eq("founder", true),
    db.from("supporter_votes").select("option").eq("poll", CURRENT_POLL.id).limit(5000),
  ]);
  // Ko-fi cobra en la moneda de cada quien; aquí se suman tal cual (casi todo llega en USD).
  const raised = Math.round(((pays ?? []) as { amount: number | string }[]).reduce((a, p) => a + (Number(p.amount) || 0), 0) * 100) / 100;
  const t = now.getTime();
  const entries: WallEntry[] = [];
  for (const w of (wall ?? []) as unknown as { tier: number; expires_at: string | null; founder: boolean; profile: { username: string; display_name: string; avatar_url: string | null } | { username: string; display_name: string; avatar_url: string | null }[] | null }[]) {
    const p = Array.isArray(w.profile) ? w.profile[0] : w.profile;
    const active = activeTier(w, t) > 0;
    if (!p || (!active && !w.founder)) continue;
    entries.push({ username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, tier: w.tier, founder: w.founder, active });
  }
  const tally: Record<string, number> = Object.fromEntries(CURRENT_POLL.options.map((o) => [o.id, 0]));
  for (const v of (votes ?? []) as { option: string }[]) if (v.option in tally) tally[v.option]++;
  return {
    goal: MONTHLY_GOAL,
    raised,
    activeCount: entries.filter((e) => e.active).length,
    foundersLeft: Math.max(0, FOUNDER_LIMIT - (founders ?? 0)),
    wall: entries,
    poll: { id: CURRENT_POLL.id, tally },
  };
}
