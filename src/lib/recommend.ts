import type { MediaCard } from "@/lib/anilist/types";
import type { LibraryEntry } from "@/lib/library/types";
import { genreLabel } from "@/lib/anilist/browse-params";

/**
 * Explainable, rule-based recommendations (v2). No ML, no paid APIs.
 * Every result carries the reason that contributed most to its score so the
 * UI can say *why*. Signals:
 *  - géneros de tu biblioteca y de lo que realmente ves (progreso de episodios)
 *  - recomendaciones de fans de AniList para varios de tus títulos (más peso si coinciden)
 *  - continuaciones (secuelas) de lo que ya viste
 *  - nota de la comunidad, popularidad y si está en emisión
 */

export type GenreProfile = { weights: Record<string, number>; top: string[]; sampleSize: number };

const STATUS_WEIGHT: Record<LibraryEntry["status"], number> = {
  COMPLETED: 1,
  REPEATING: 1.25,
  CURRENT: 0.8,
  PAUSED: 0.35,
  PLANNING: 0.25,
  DROPPED: -0.6,
};

const HALF_LIFE_MS = 45 * 864e5; // 45 días de vida media

const decayFor = (updatedAt: number | string | undefined, now: number) => {
  if (!updatedAt) return 1;
  const age = Math.max(0, now - new Date(updatedAt).getTime());
  return 0.4 + 0.6 * 0.5 ** (age / HALF_LIFE_MS);
};

/** Series que el usuario ha visto en el reproductor (aunque no estén en su biblioteca). */
export type WatchedSignal = { media: MediaCard; episodes: number; updatedAt: number };

export function buildGenreProfile(entries: LibraryEntry[], watched: WatchedSignal[] = []): GenreProfile {
  const weights: Record<string, number> = {};
  const now = Date.now();
  const inLibrary = new Set(entries.map((e) => e.mediaId));

  for (const e of entries) {
    let w = STATUS_WEIGHT[e.status];
    if (e.score != null) w *= e.score >= 80 ? 1.5 : e.score >= 60 ? 1 : 0.4;
    if (e.favorite) w += 0.6;
    w *= decayFor(e.updatedAt, now);
    for (const g of e.media.genres) weights[g] = (weights[g] ?? 0) + w;
  }

  // Ver varios episodios es una señal de gusto tan fuerte como añadirlo a la lista.
  let watchedCount = 0;
  for (const s of watched) {
    if (inLibrary.has(s.media.id)) continue;
    watchedCount++;
    const w = Math.min(1.1, 0.35 + s.episodes * 0.15) * decayFor(s.updatedAt, now);
    for (const g of s.media.genres) weights[g] = (weights[g] ?? 0) + w;
  }

  const max = Math.max(0, ...Object.values(weights));
  if (max > 0) for (const g of Object.keys(weights)) weights[g] = weights[g] / max;
  const top = Object.entries(weights)
    .filter(([, w]) => w > 0.25)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);
  return { weights, top, sampleSize: entries.filter((e) => e.status !== "PLANNING").length + watchedCount };
}

export type Recommendation = { media: MediaCard; score: number; reason: string; factors: { label: string; value: number }[] };

export type RecContext = {
  profile: GenreProfile;
  /** Media ids already in the library or watched (excluded). */
  exclude: Set<number>;
  /** AniList "users who liked X also liked Y" signals: candidate id → seed titles. */
  peerSignals?: Map<number, { seedTitle: string; rating: number }[]>;
  /** Continuaciones directas de algo que ya viste: candidate id → título visto. */
  sequelOf?: Map<number, string>;
};

const LOW_VALUE_FORMATS = new Set(["MUSIC", "SPECIAL"]);

export function scoreCandidate(m: MediaCard, ctx: RecContext): Recommendation | null {
  if (ctx.exclude.has(m.id) || m.isAdult) return null;
  if (m.status === "NOT_YET_RELEASED") return null;
  if (m.format && LOW_VALUE_FORMATS.has(m.format)) return null;
  const factors: { label: string; value: number; reason: string }[] = [];

  const sequel = ctx.sequelOf?.get(m.id);
  if (sequel) factors.push({ label: "Continuación", value: 45, reason: `Continúa ${sequel}` });

  const matched = m.genres.filter((g) => (ctx.profile.weights[g] ?? 0) > 0.25).sort((a, b) => (ctx.profile.weights[b] ?? 0) - (ctx.profile.weights[a] ?? 0));
  const affinity = m.genres.reduce((sum, g) => sum + Math.max(-0.5, ctx.profile.weights[g] ?? 0), 0) / Math.max(1, Math.sqrt(m.genres.length));
  if (affinity !== 0) {
    const names = matched.slice(0, 2).map((g) => genreLabel(g).toLowerCase()).join(" y ");
    factors.push({ label: "Afinidad de géneros", value: affinity * 40, reason: names ? `Porque te gusta ${names}` : "Cerca de tus gustos" });
  }

  const peers = ctx.peerSignals?.get(m.id);
  if (peers?.length) {
    const best = [...peers].sort((a, b) => b.rating - a.rating)[0];
    const seeds = new Set(peers.map((p) => p.seedTitle)).size;
    // Coincidir con varios de tus títulos pesa mucho más que un solo voto.
    const v = Math.min(42, 12 + seeds * 9 + Math.log10(1 + best.rating) * 5);
    factors.push({
      label: "Fans de AniList",
      value: v,
      reason: seeds > 1 ? `Recomendado por fans de ${seeds} de tus animes` : `A los fans de ${best.seedTitle} les encantó`,
    });
  }

  if (m.averageScore) {
    const v = Math.max(-6, (m.averageScore - 62) * 0.6);
    factors.push({ label: "Nota de la comunidad", value: v, reason: `Nota ${m.averageScore}% en AniList` });
  }

  if (m.popularity) {
    // Pequeño empujón a lo conocido, para que lo de nicho necesite afinidad real.
    factors.push({ label: "Popularidad", value: Math.min(6, Math.log10(m.popularity) * 1.2), reason: "Muy visto" });
  }

  if (m.status === "RELEASING") factors.push({ label: "En emisión", value: 3, reason: "En emisión ahora" });

  const score = factors.reduce((s, f) => s + f.value, 0);
  if (score <= 0) return null;
  const lead = [...factors].sort((a, b) => b.value - a.value)[0];
  return { media: m, score, reason: lead.reason, factors: factors.map(({ label, value }) => ({ label, value: Math.round(value * 10) / 10 })) };
}

export function recommend(candidates: MediaCard[], ctx: RecContext, limit = 18): Recommendation[] {
  const seen = new Set<number>();
  const out: Recommendation[] = [];
  for (const m of candidates) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const r = scoreCandidate(m, ctx);
    if (r) out.push(r);
  }
  out.sort((a, b) => b.score - a.score);
  // Diversidad: que la fila no sean ocho gemelos del mismo género ni del mismo estudio.
  const result: Recommendation[] = [];
  const primaryCount: Record<string, number> = {};
  const studioCount: Record<number, number> = {};
  const skipped: Recommendation[] = [];
  for (const r of out) {
    const p = r.media.genres[0] ?? "?";
    const studio = r.media.studios?.nodes?.[0]?.id;
    if ((primaryCount[p] ?? 0) >= Math.ceil(limit / 3) || (studio != null && (studioCount[studio] ?? 0) >= 3)) {
      skipped.push(r);
      continue;
    }
    primaryCount[p] = (primaryCount[p] ?? 0) + 1;
    if (studio != null) studioCount[studio] = (studioCount[studio] ?? 0) + 1;
    result.push(r);
    if (result.length >= limit) break;
  }
  // Si la diversidad dejó la fila corta, se rellena con lo mejor que quedó fuera.
  for (const r of skipped) {
    if (result.length >= limit) break;
    result.push(r);
  }
  return result;
}

/** Choose the library title that best represents what the user loves (for "Because you loved…"). */
export function pickSeed(entries: LibraryEntry[]): LibraryEntry | null {
  return rankSeeds(entries)[0] ?? null;
}

/** Títulos de la biblioteca ordenados por lo bien que representan tus gustos. */
export function rankSeeds(entries: LibraryEntry[]): LibraryEntry[] {
  return entries
    .filter((e) => e.status === "COMPLETED" || e.status === "REPEATING" || e.status === "CURRENT" || e.favorite)
    .filter((e) => e.score == null || e.score >= 60)
    .map((e) => ({ e, s: (e.score ?? 65) + (e.favorite ? 25 : 0) + (e.status === "COMPLETED" ? 5 : 0) + e.updatedAt / 1e13 }))
    .sort((a, b) => b.s - a.s)
    .map(({ e }) => e);
}
