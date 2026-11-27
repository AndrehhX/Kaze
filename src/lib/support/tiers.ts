/**
 * Apoya KAZE: niveles, cosméticos y reglas (compartido entre el cliente y el servidor).
 *
 * El anime es gratis para todos. Quien apoya en Ko-fi recibe cosméticos para destacar
 * en la comunidad. Nada de lo que está aquí cambia lo que se puede ver.
 */

export const KOFI_URL = "https://ko-fi.com/andrehwallet";
export const KOFI_MEMBERSHIP_URL = `${KOFI_URL}/tiers`;

export type TierLevel = 1 | 2 | 3;

export type TierInfo = { level: TierLevel; id: "brisa" | "viento" | "tormenta"; name: string; emoji: string; price: number; color: string; perks: string[] };

export const TIERS: Record<TierLevel, TierInfo> = {
  1: {
    level: 1,
    id: "brisa",
    name: "Brisa",
    emoji: "🍃",
    price: 2,
    color: "#34d399",
    perks: ["Insignia 風 en tu perfil y tus comentarios", "Nombre con color (6 a elegir)", "Rol de Discord con color", "Tu nombre en el muro de apoyo (si quieres)"],
  },
  2: {
    level: 2,
    id: "viento",
    name: "Viento",
    emoji: "🌀",
    price: 4,
    color: "#38bdf8",
    perks: ["Todo lo de Brisa", "4 marcos de avatar exclusivos", "Comentarios con marco de color", "Efecto animado en tu perfil (pétalos, estrellas, nieve o luciérnagas)"],
  },
  3: {
    level: 3,
    id: "tormenta",
    name: "Tormenta",
    emoji: "⚡",
    price: 8,
    color: "#fbbf24",
    perks: ["Todo lo de Viento", "Nombre con degradado animado", "Wrapped edición Tormenta", "Votar qué se hace después en KAZE", "Canal privado en Discord y versiones de la app antes que nadie"],
  },
};

export const TIER_LEVELS: TierLevel[] = [1, 2, 3];

/** Los primeros 50 en apoyar se quedan la insignia de Fundador para siempre. */
export const FOUNDER_LIMIT = 50;
/** Días que da cada pago. La membresía se renueva cada mes; los 3 días extra son margen por si el cobro se retrasa. */
export const SUBSCRIPTION_DAYS = 33;
export const ONE_TIME_DAYS = 30;
/** Pago mínimo para recibir algo (por debajo, las comisiones se comen casi todo). */
export const MIN_AMOUNT = 2;

/** Lo que cuesta mantener KAZE al mes (lo que se muestra en /apoyar). Ajusta las cifras reales aquí. */
export const MONTHLY_COSTS: { label: string; usd: number }[] = [
  { label: "Servidor (VPS)", usd: 10 },
  { label: "Dominio orunei.sbs", usd: 1 },
  { label: "Correo y servicios", usd: 1 },
];
export const MONTHLY_GOAL = MONTHLY_COSTS.reduce((a, c) => a + c.usd, 0);

/** Encuesta abierta para quienes están en Tormenta. Cambia el id para empezar una nueva. */
export const CURRENT_POLL = {
  id: "2026-12",
  question: "¿Qué hacemos después en KAZE?",
  options: [
    { id: "app-ios", label: "Versión para iPhone (web instalable mejorada)" },
    { id: "manga-offline", label: "Leer manga sin conexión en la app" },
    { id: "parties-voice", label: "Chat de voz en las salas de visionado" },
    { id: "listas-compartidas", label: "Listas compartidas entre amigos" },
  ],
} as const;

// ── Cosméticos ─────────────────────────────────────────────────────────

export type Cosmetic = { id: string; name: string; tier: TierLevel };

/** Color del nombre (Brisa). La clase CSS es k-name-<id>, con versión oscura para los temas claros. */
export const NAME_COLORS: (Cosmetic & { swatch: string })[] = [
  { id: "menta", name: "Menta", tier: 1, swatch: "#34d399" },
  { id: "cielo", name: "Cielo", tier: 1, swatch: "#38bdf8" },
  { id: "lavanda", name: "Lavanda", tier: 1, swatch: "#a78bfa" },
  { id: "sakura", name: "Sakura", tier: 1, swatch: "#f472b6" },
  { id: "ambar", name: "Ámbar", tier: 1, swatch: "#fbbf24" },
  { id: "carmesi", name: "Carmesí", tier: 1, swatch: "#f87171" },
];

/** Nombre con degradado animado (Tormenta). Clase CSS k-grad-<id>. */
export const NAME_GRADIENTS: (Cosmetic & { from: string; to: string })[] = [
  { id: "aurora", name: "Aurora", tier: 3, from: "#34d399", to: "#818cf8" },
  { id: "atardecer", name: "Atardecer", tier: 3, from: "#fb923c", to: "#ec4899" },
  { id: "tormenta", name: "Tormenta", tier: 3, from: "#fbbf24", to: "#a855f7" },
  { id: "hielo", name: "Hielo", tier: 3, from: "#67e8f9", to: "#c4b5fd" },
];

/** Marcos de avatar exclusivos (Viento). Los marcos gratis siguen en Ajustes → Perfil. */
export const SUPPORTER_FRAMES: (Cosmetic & { icon: string })[] = [
  { id: "kz-viento", name: "Remolino 風", tier: 2, icon: "🌀" },
  { id: "kz-rayo", name: "Tormenta eléctrica", tier: 2, icon: "⚡" },
  { id: "kz-luna", name: "Luna llena", tier: 2, icon: "🌕" },
  { id: "kz-hanabi", name: "Hanabi", tier: 2, icon: "🎆" },
];

/** Marco de color para tus comentarios (Viento). */
export const COMMENT_FRAMES: (Cosmetic & { swatch: string })[] = [
  { id: "menta", name: "Menta", tier: 2, swatch: "#34d399" },
  { id: "cielo", name: "Cielo", tier: 2, swatch: "#38bdf8" },
  { id: "lavanda", name: "Lavanda", tier: 2, swatch: "#a78bfa" },
  { id: "sakura", name: "Sakura", tier: 2, swatch: "#f472b6" },
  { id: "ambar", name: "Ámbar", tier: 2, swatch: "#fbbf24" },
];

/** Efecto animado en el perfil (Viento). */
export const PROFILE_EFFECTS: (Cosmetic & { icon: string })[] = [
  { id: "petalos", name: "Pétalos de sakura", tier: 2, icon: "🌸" },
  { id: "estrellas", name: "Cielo estrellado", tier: 2, icon: "✨" },
  { id: "nieve", name: "Nieve", tier: 2, icon: "❄️" },
  { id: "luciernagas", name: "Luciérnagas", tier: 2, icon: "🟡" },
];

export type Equipped = {
  nameColor?: string;
  nameGradient?: string;
  avatarFrame?: string;
  commentFrame?: string;
  profileEffect?: string;
};

const CATALOG: Record<keyof Equipped, Cosmetic[]> = {
  nameColor: NAME_COLORS,
  nameGradient: NAME_GRADIENTS,
  avatarFrame: SUPPORTER_FRAMES,
  commentFrame: COMMENT_FRAMES,
  profileEffect: PROFILE_EFFECTS,
};

export const EQUIP_SLOTS = Object.keys(CATALOG) as (keyof Equipped)[];

/** Lee los cosméticos guardados ignorando lo que no existe. */
export function parseEquipped(raw: unknown): Equipped {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: Equipped = {};
  for (const slot of EQUIP_SLOTS) {
    const v = r[slot];
    if (typeof v === "string" && CATALOG[slot].some((c) => c.id === v)) out[slot] = v;
  }
  return out;
}

/** Comprueba en el servidor que cada cosmético corresponde al nivel. Devuelve el error o null. */
export function validateEquip(next: Equipped, tier: TierLevel): string | null {
  for (const slot of EQUIP_SLOTS) {
    const v = next[slot];
    if (v === undefined) continue;
    const item = CATALOG[slot].find((c) => c.id === v);
    if (!item) return `Cosmético desconocido: ${v}`;
    if (item.tier > tier) return `${item.name} es de ${TIERS[item.tier].name}`;
  }
  return null;
}

// ── Estado público de quien apoya ──────────────────────────────────────

export type SupporterPublic = { tier: number; expires_at: string | null; founder: boolean; equipped?: unknown; since?: string };

/** Nivel activo ahora (0 si no apoya o ya venció). La insignia de Fundador va aparte. */
export function activeTier(s: SupporterPublic | null | undefined, now?: number): 0 | TierLevel {
  if (!s || !s.expires_at) return 0;
  // La hora se pide solo si hay algo que comprobar (Next no deja leerla al prerenderizar).
  if (new Date(s.expires_at).getTime() <= (now ?? Date.now())) return 0;
  const t = Math.round(s.tier);
  return t >= 3 ? 3 : t === 2 ? 2 : t === 1 ? 1 : 0;
}

/** Cosméticos que de verdad se muestran: solo los que el nivel activo permite. */
export function visibleCosmetics(s: SupporterPublic | null | undefined, now?: number): Equipped {
  const tier = activeTier(s, now);
  if (!tier || !s) return {};
  const eq = parseEquipped(s.equipped);
  const out: Equipped = {};
  for (const slot of EQUIP_SLOTS) {
    const v = eq[slot];
    const item = v ? CATALOG[slot].find((c) => c.id === v) : undefined;
    if (item && item.tier <= tier) out[slot] = v;
  }
  // El degradado manda sobre el color plano.
  if (out.nameGradient) delete out.nameColor;
  return out;
}

/** Supabase a veces devuelve la relación 1 a 1 como lista. */
export function oneSupporter(raw: unknown): SupporterPublic | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && typeof v === "object" ? (v as SupporterPublic) : null;
}

// ── Cálculo del nivel a partir de los pagos ────────────────────────────

export type PaymentLite = { tier: number | null; amount: number; is_subscription: boolean; received_at: string };

/** Nivel según el importe (para apoyos de una sola vez o membresías sin nombre reconocible). */
export function tierFromAmount(amount: number): 0 | TierLevel {
  if (amount >= TIERS[3].price) return 3;
  if (amount >= TIERS[2].price) return 2;
  if (amount >= MIN_AMOUNT) return 1;
  return 0;
}

/** Nivel según el nombre de la membresía de Ko-fi ("Brisa", "Viento 🌀", "Tormenta"...). */
export function tierFromName(name: string | null | undefined): 0 | TierLevel {
  const n = (name ?? "").toLowerCase();
  if (n.includes("tormenta")) return 3;
  if (n.includes("viento")) return 2;
  if (n.includes("brisa")) return 1;
  return 0;
}

/**
 * Nivel y vencimiento actuales a partir de todos los pagos (y del regalo manual, si hay).
 * Cada pago cubre una ventana de días; el nivel es el más alto entre las ventanas que siguen
 * abiertas, y vence cuando termina la última ventana de ese nivel.
 */
export function computeStatus(payments: PaymentLite[], manual: { tier: number | null; until: string | null } | null, now = Date.now()): { tier: TierLevel; expires_at: string } | null {
  const windows: { tier: TierLevel; end: number }[] = [];
  for (const p of payments) {
    const tier = (p.tier && p.tier >= 1 && p.tier <= 3 ? p.tier : tierFromAmount(p.amount)) as 0 | TierLevel;
    if (!tier) continue;
    const start = new Date(p.received_at).getTime();
    if (!Number.isFinite(start)) continue;
    windows.push({ tier, end: start + (p.is_subscription ? SUBSCRIPTION_DAYS : ONE_TIME_DAYS) * 86_400_000 });
  }
  if (manual?.tier && manual.until) {
    const end = new Date(manual.until).getTime();
    const t = Math.min(3, Math.max(1, Math.round(manual.tier))) as TierLevel;
    if (Number.isFinite(end)) windows.push({ tier: t, end });
  }
  const open = windows.filter((w) => w.end > now);
  if (!open.length) {
    // Venció: se guarda el último nivel con su fecha, así los cosméticos se ocultan pero no se pierden.
    const last = windows.sort((a, b) => b.end - a.end)[0];
    return last ? { tier: last.tier, expires_at: new Date(last.end).toISOString() } : null;
  }
  const tier = Math.max(...open.map((w) => w.tier)) as TierLevel;
  const end = Math.max(...open.filter((w) => w.tier === tier).map((w) => w.end));
  return { tier, expires_at: new Date(end).toISOString() };
}

/** "@usuario" escrito en el mensaje de Ko-fi, para vincular el pago a la cuenta. */
export function usernameFromMessage(message: string | null | undefined): string | null {
  const m = (message ?? "").match(/@([A-Za-z0-9_]{3,24})\b/);
  return m ? m[1] : null;
}
