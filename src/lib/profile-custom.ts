/**
 * Personalización del perfil estilo Steam: fondo, escaparates y nivel.
 *
 * Se guarda en public.profiles.pinned_sections (jsonb, lectura pública como el resto del
 * perfil, escritura solo del dueño por RLS). Así no hace falta cambiar el esquema.
 */

export type ShowcaseType = "featured" | "favorites" | "badges" | "stats" | "text" | "watching" | "genres" | "characters";

export type Showcase =
  | { type: "featured"; mediaId?: number | null }
  | { type: "favorites" }
  | { type: "badges"; ids: string[] }
  | { type: "stats" }
  | { type: "text"; title: string; body: string }
  | { type: "watching" }
  | { type: "genres" }
  | { type: "characters" };

export type ProfileBackground = { url: string; blur: number; dim: number };

export type ProfileCustom = { v: 1; background: ProfileBackground | null; showcases: Showcase[] };

export const MAX_SHOWCASES = 6;
export const MAX_BADGES = 6;
export const TEXT_TITLE_MAX = 60;
export const TEXT_BODY_MAX = 600;

export const SHOWCASE_INFO: Record<ShowcaseType, { label: string; description: string }> = {
  featured: { label: "Anime destacado", description: "Tu obra maestra, en grande." },
  favorites: { label: "Favoritos", description: "Las portadas de tus animes favoritos." },
  badges: { label: "Insignias destacadas", description: "Elige hasta 6 logros para presumir." },
  stats: { label: "Estadísticas", description: "Títulos, completados, episodios y nota media." },
  text: { label: "Texto propio", description: "Una frase, una cita o lo que quieras contar." },
  watching: { label: "Viendo ahora", description: "Lo que estás siguiendo en este momento." },
  genres: { label: "Mis géneros", description: "Tus géneros más vistos." },
  characters: { label: "Personajes favoritos", description: "Tus personajes favoritos." },
};

/** Orden por defecto: equivale al perfil de antes de la personalización. */
export const DEFAULT_SHOWCASES: Showcase[] = [{ type: "featured" }, { type: "favorites" }, { type: "characters" }, { type: "watching" }];

const clamp = (n: unknown, min: number, max: number, def: number) => {
  const x = typeof n === "number" && Number.isFinite(n) ? n : def;
  return Math.min(max, Math.max(min, Math.round(x)));
};

/** Solo imágenes https (no data: ni javascript:), para evitar contenido inyectado. */
export function safeImageUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const u = url.trim();
  if (u.length > 2048) return null;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function parseShowcase(raw: unknown): Showcase | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case "featured":
      return { type: "featured", mediaId: typeof r.mediaId === "number" && r.mediaId > 0 ? Math.floor(r.mediaId) : null };
    case "badges":
      return { type: "badges", ids: Array.isArray(r.ids) ? r.ids.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{2,40}$/.test(x)).slice(0, MAX_BADGES) : [] };
    case "text":
      return {
        type: "text",
        title: typeof r.title === "string" ? r.title.slice(0, TEXT_TITLE_MAX) : "",
        body: typeof r.body === "string" ? r.body.slice(0, TEXT_BODY_MAX) : "",
      };
    case "favorites":
    case "stats":
    case "watching":
    case "genres":
    case "characters":
      return { type: r.type };
    default:
      return null;
  }
}

/** Lee pinned_sections de forma tolerante (puede ser null, un array antiguo o datos inválidos). */
export function parseProfileCustom(raw: unknown): ProfileCustom {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { v: 1, background: null, showcases: DEFAULT_SHOWCASES };
  const r = raw as Record<string, unknown>;
  let background: ProfileBackground | null = null;
  if (r.background && typeof r.background === "object") {
    const b = r.background as Record<string, unknown>;
    const url = safeImageUrl(b.url);
    if (url) background = { url, blur: clamp(b.blur, 0, 20, 0), dim: clamp(b.dim, 0, 90, 45) };
  }
  const list = Array.isArray(r.showcases) ? r.showcases.map(parseShowcase).filter((s): s is Showcase => s !== null) : DEFAULT_SHOWCASES;
  // Sin duplicados del mismo tipo (excepto "text", que puede repetirse) y máximo 6.
  const seen = new Set<string>();
  const showcases = list.filter((s) => {
    if (s.type === "text") return true;
    if (seen.has(s.type)) return false;
    seen.add(s.type);
    return true;
  }).slice(0, MAX_SHOWCASES);
  return { v: 1, background, showcases };
}

// ── Nivel y experiencia ────────────────────────────────────────────────────

export type LevelInput = { episodes: number; completed: number; achievements: number; favorites: number };

export function experience({ episodes, completed, achievements, favorites }: LevelInput) {
  return Math.max(0, Math.round(episodes * 10 + completed * 100 + achievements * 250 + favorites * 20));
}

/** Experiencia total necesaria para alcanzar el nivel `level` (nivel 1 = 0). */
export function xpForLevel(level: number) {
  return level <= 1 ? 0 : Math.round(250 * Math.pow(level - 1, 1.6));
}

export function levelFromXp(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 999) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, xp, floor, next, progress: next > floor ? (xp - floor) / (next - floor) : 1 };
}

/** Color del anillo de nivel: cambia cada 10 niveles, como en Steam. */
export function levelTier(level: number) {
  const tiers = ["#9ca3af", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#f5f5f5"];
  return tiers[Math.min(tiers.length - 1, Math.floor(level / 10))];
}
