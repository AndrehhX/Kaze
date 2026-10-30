import type { MediaCard } from "@/lib/anilist/types";
import type { LibraryEntry } from "@/lib/library/types";

/**
 * Explainable, rule-based recommendations (v1). No ML, no paid APIs.
 * Every result carries the reason that contributed most to its score so the
 * UI can say *why*. The scoring interface is deliberately small so a learned
 * model can replace `scoreCandidate` later without touching the UI.
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

export function buildGenreProfile(entries: LibraryEntry[]): GenreProfile {
  const weights: Record<string, number> = {};
  const now = Date.now();
  const HALF_LIFE_MS = 45 * 864e5; // 45 días de vida media

  for (const e of entries) {
    let w = STATUS_WEIGHT[e.status];
    if (e.score != null) w *= e.score >= 80 ? 1.5 : e.score >= 60 ? 1 : 0.4;
    if (e.favorite) w += 0.6;

    // Decaimiento temporal suave (los gustos recientes tienen mayor peso)
    if (e.updatedAt) {
      const age = Math.max(0, now - new Date(e.updatedAt).getTime());
      const decay = 0.5 ** (age / HALF_LIFE_MS);
      w *= 0.4 + 0.6 * decay;
    }

    for (const g of e.media.genres) weights[g] = (weights[g] ?? 0) + w;
  }
  const max = Math.max(0, ...Object.values(weights));
  if (max > 0) for (const g of Object.keys(weights)) weights[g] = weights[g] / max;
  const top = Object.entries(weights)
    .filter(([, w]) => w > 0.25)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);
  return { weights, top, sampleSize: entries.filter((e) => e.status !== "PLANNING").length };
}

export type Recommendation = { media: MediaCard; score: number; reason: string; factors: { label: string; value: number }[] };

export type RecContext = {
  profile: GenreProfile;
  /** Media ids already in the library (excluded). */
  exclude: Set<number>;
  /** AniList "users who liked X also liked Y" signals: candidate id → seed titles. */
  peerSignals?: Map<number, { seedTitle: string; rating: number }[]>;
};

export function scoreCandidate(m: MediaCard, ctx: RecContext): Recommendation | null {
  if (ctx.exclude.has(m.id) || m.isAdult) return null;
  const factors: { label: string; value: number; reason: string }[] = [];

  const matched = m.genres.filter((g) => (ctx.profile.weights[g] ?? 0) > 0.25);
  const affinity = m.genres.reduce((sum, g) => sum + Math.max(-0.5, ctx.profile.weights[g] ?? 0), 0) / Math.max(1, Math.sqrt(m.genres.length));
  if (affinity !== 0) {
    const names = matched.slice(0, 2).join(" and ");
    factors.push({ label: "Genre affinity", value: affinity * 40, reason: names ? `Because you enjoy ${names}` : "Close to your taste" });
  }

  const peers = ctx.peerSignals?.get(m.id);
  if (peers?.length) {
    const best = [...peers].sort((a, b) => b.rating - a.rating)[0];
    const v = Math.min(30, 10 + peers.length * 6 + Math.log10(1 + best.rating) * 4);
    factors.push({ label: "AniList recommendations", value: v, reason: `Recommended by AniList fans of ${best.seedTitle}` });
  }

  if (m.averageScore) {
    const v = Math.max(0, (m.averageScore - 60) * 0.6);
    factors.push({ label: "Community rating", value: v, reason: `Rated ${m.averageScore}% by the AniList community` });
  }

  if (m.popularity) {
    // Small nudge for well-known titles so niche picks need real affinity to surface.
    factors.push({ label: "Popularity", value: Math.min(6, Math.log10(m.popularity) * 1.2), reason: "Widely watched" });
  }

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
  // Diversity: avoid a rail of eight near-identical genre twins.
  const result: Recommendation[] = [];
  const primaryCount: Record<string, number> = {};
  for (const r of out) {
    const p = r.media.genres[0] ?? "?";
    if ((primaryCount[p] ?? 0) >= Math.ceil(limit / 3)) continue;
    primaryCount[p] = (primaryCount[p] ?? 0) + 1;
    result.push(r);
    if (result.length >= limit) break;
  }
  return result;
}

/** Choose the library title that best represents what the user loves (for "Because you loved…"). */
export function pickSeed(entries: LibraryEntry[]): LibraryEntry | null {
  const ranked = entries
    .filter((e) => e.status === "COMPLETED" || e.status === "REPEATING" || e.status === "CURRENT" || e.favorite)
    .map((e) => ({ e, s: (e.score ?? 65) + (e.favorite ? 25 : 0) + (e.status === "COMPLETED" ? 5 : 0) + e.updatedAt / 1e13 }))
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.e ?? null;
}
