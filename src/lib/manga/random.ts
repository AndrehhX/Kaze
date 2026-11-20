import type { MangaCard } from "@/lib/anilist/manga-types";
import type { MangaLibraryEntry } from "./types";
import { LENGTHS, type LengthBucket } from "@/lib/anilist/manga-params";

/**
 * Random discovery. The server supplies a candidate pool (AniList query built from the same filters);
 * these client-side rules then enforce what AniList cannot (library exclusions, unknown lengths) and
 * pick uniformly at random with a cryptographic RNG.
 */

export type RandomFilters = {
  genres: string[];
  tags: string[];
  format: "MANGA" | "ONE_SHOT" | "NOVEL" | null;
  status: "FINISHED" | "RELEASING" | "HIATUS" | null;
  country: "JP" | "KR" | "CN" | null;
  yearFrom: number | null;
  yearTo: number | null;
  minScore: number | null;
  length: LengthBucket | null;
  popularity: "any" | "popular" | "niche";
  completedOnly: boolean;
  excludeRead: boolean;
  excludeLibrary: boolean;
};

export const DEFAULT_RANDOM_FILTERS: RandomFilters = {
  genres: [],
  tags: [],
  format: null,
  status: null,
  country: null,
  yearFrom: null,
  yearTo: null,
  minScore: null,
  length: null,
  popularity: "any",
  completedOnly: false,
  excludeRead: false,
  excludeLibrary: false,
};

/** Builds the AniList query string for the candidate pool (same param names as /api/manga/browse). */
export function poolQuery(f: RandomFilters, page: number): URLSearchParams {
  const s = new URLSearchParams({ perPage: "50", page: String(page), sort: "POPULARITY_DESC" });
  if (f.genres.length) s.set("genres", f.genres.join(","));
  if (f.tags.length) s.set("tags", f.tags.join(","));
  if (f.format) s.set("format", f.format);
  const status = f.completedOnly ? "FINISHED" : f.status;
  if (status) s.set("status", status);
  if (f.country) s.set("country", f.country);
  if (f.yearFrom) s.set("from", String(f.yearFrom));
  if (f.yearTo) s.set("to", String(f.yearTo));
  if (f.minScore) s.set("score", String(f.minScore));
  const len = LENGTHS.find((l) => l.value === f.length);
  if (len?.min) s.set("chMin", String(len.min));
  if (len?.max) s.set("chMax", String(len.max));
  if (f.popularity === "popular") s.set("popMin", "30000");
  if (f.popularity === "niche") {
    s.set("popMin", "1500");
    s.set("popMax", "15000");
  }
  return s;
}

export type EligibilityReason = "adult" | "in-library" | "already-read" | "status" | "format" | "country" | "genre" | "score" | "length" | "year";

/** Re-checks every filter locally so a stale or partial server pool can never leak an ineligible title. */
export function eligibility(m: MangaCard, f: RandomFilters, library: Record<number, MangaLibraryEntry>): EligibilityReason | null {
  if (m.isAdult) return "adult";
  const entry = library[m.id];
  if (f.excludeLibrary && entry) return "in-library";
  if (f.excludeRead && entry && (entry.status === "COMPLETED" || entry.progress > 0)) return "already-read";
  if (f.completedOnly && m.status !== "FINISHED") return "status";
  if (f.status && !f.completedOnly && m.status !== f.status) return "status";
  if (f.format && m.format !== f.format) return "format";
  if (f.country && m.countryOfOrigin !== f.country) return "country";
  if (f.genres.length && !f.genres.every((g) => m.genres.includes(g))) return "genre";
  if (f.minScore && (m.averageScore ?? 0) < f.minScore) return "score";
  const len = LENGTHS.find((l) => l.value === f.length);
  if (len) {
    if (m.chapters == null) return "length";
    if (len.min && m.chapters < len.min) return "length";
    if (len.max && m.chapters > len.max) return "length";
  }
  const y = m.startDate?.year ?? null;
  if (f.yearFrom && (y == null || y < f.yearFrom)) return "year";
  if (f.yearTo && (y == null || y > f.yearTo)) return "year";
  return null;
}

export function eligiblePool(pool: MangaCard[], f: RandomFilters, library: Record<number, MangaLibraryEntry>, recentlyShown: number[] = []) {
  const seen = new Set<number>();
  const out = pool.filter((m) => !seen.has(m.id) && seen.add(m.id) && eligibility(m, f, library) === null);
  // Avoid repeating the last few winners while the pool is large enough.
  const fresh = out.filter((m) => !recentlyShown.includes(m.id));
  return fresh.length >= 3 ? fresh : out;
}

/** Uniform integer in [0, n) without modulo bias. */
export function randomIndex(n: number, rng: (max: number) => number = cryptoRandom): number {
  if (n <= 0) throw new Error("empty pool");
  return rng(n);
}

function cryptoRandom(max: number): number {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) return Math.floor(Math.random() * max);
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  do c.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

export function pickRandom<T>(pool: T[], rng?: (max: number) => number): T | null {
  if (!pool.length) return null;
  return pool[randomIndex(pool.length, rng)];
}

/** Picks a random AniList page inside the result set so spins are not limited to the top 50 titles. */
export function randomPage(total: number, perPage = 50, maxPages = 20, rng?: (max: number) => number): number {
  const pages = Math.max(1, Math.min(maxPages, Math.ceil(total / perPage)));
  return randomIndex(pages, rng) + 1;
}
