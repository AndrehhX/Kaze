import type { LibraryEntry } from "@/lib/library/types";
import type { MangaCard } from "@/lib/anilist/manga-types";
import { genreLabel } from "@/lib/anilist/browse-params";
import type { MangaLibraryEntry } from "./types";

/**
 * Explainable, rule-based manga recommendations (not machine learning).
 * Signals: genres of anime and manga the user rated well or completed, authors they read, and AniList's own
 * recommendations of manga they liked. Every result carries the human-readable reason that produced it.
 */

export type MangaRecommendation = { media: MangaCard; score: number; reason: string };

export type TasteProfile = { genres: Map<string, number>; authors: Map<string, number>; animeTitles: string[] };

export function buildTaste(anime: LibraryEntry[], manga: MangaLibraryEntry[]): TasteProfile {
  const genres = new Map<string, number>();
  const authors = new Map<string, number>();
  const weight = (status: string, score: number | null, favorite: boolean) => (favorite ? 3 : 0) + (status === "COMPLETED" ? 1.5 : status === "CURRENT" ? 1 : status === "DROPPED" ? -1 : 0.4) + (score ? (score - 60) / 20 : 0);
  for (const e of anime) {
    const w = weight(e.status, e.score, e.favorite);
    for (const g of e.media.genres) genres.set(g, (genres.get(g) ?? 0) + w);
  }
  for (const e of manga) {
    const w = weight(e.status, e.score, e.favorite) * 1.2;
    for (const g of e.media.genres) genres.set(g, (genres.get(g) ?? 0) + w);
    if (e.media.author) authors.set(e.media.author, (authors.get(e.media.author) ?? 0) + w);
  }
  const animeTitles = anime.filter((e) => e.favorite || e.status === "COMPLETED").map((e) => e.media.title);
  return { genres, authors, animeTitles };
}

export function topGenres(t: TasteProfile, n = 3) {
  return [...t.genres.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([g]) => g);
}

export function recommendManga(pool: MangaCard[], taste: TasteProfile, owned: Set<number>, limit = 12): MangaRecommendation[] {
  const top = topGenres(taste, 4);
  const out: MangaRecommendation[] = [];
  const seen = new Set<number>();
  for (const m of pool) {
    if (m.isAdult || owned.has(m.id) || seen.has(m.id)) continue;
    seen.add(m.id);
    const matched = m.genres.filter((g) => top.includes(g));
    const author = m.staff?.edges.map((e) => e.node.name.full).find((a) => taste.authors.has(a));
    let score = matched.reduce((a, g) => a + (taste.genres.get(g) ?? 0), 0) + (m.averageScore ?? 60) / 25;
    if (author) score += (taste.authors.get(author) ?? 0) * 1.5 + 2;
    if (score <= 0 || (!matched.length && !author)) continue;
    const reason = author
      ? `Del mismo autor que ya lees: ${author}.`
      : matched.length >= 2
        ? `Porque disfrutas ${matched.slice(0, 2).map(genreLabel).join(" y ").toLowerCase()} en tu anime y manga.`
        : `Porque te gusta el género ${genreLabel(matched[0]).toLowerCase()}.`;
    out.push({ media: m, score, reason });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
