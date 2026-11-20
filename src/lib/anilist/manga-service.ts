import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { anilistRequest } from "./client";
import {
  ANIME_SOURCE_QUERY,
  MANGA_BATCH_QUERY,
  MANGA_BROWSE_QUERY,
  MANGA_CHARACTER_QUERY,
  MANGA_DETAIL_QUERY,
  MANGA_HOME_QUERY,
  MANGA_STAFF_SEARCH_QUERY,
  MANGA_SUGGEST_QUERY,
} from "./manga-queries";
import { mangaBrowseVariables } from "./manga-params";
import type { MangaBrowseParams, MangaCard, MangaCharacter, MangaDetail, MangaHero, MangaHomeData, MangaPage } from "./manga-types";
import type { MediaTitle, PageInfo } from "./types";

/*
 * Manga reads go through the same transport as anime (de-duplication, fast-fail on 429, 30 min memory cache).
 * Bounded, shared pages (home, detail) also use the Next data cache; high-cardinality searches do not,
 * mirroring the anime suggest change that stopped unbounded ISR writes.
 */

const EMPTY_PAGE: PageInfo = { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 24 };
const safe = <T extends { isAdult: boolean }>(list: T[]) => list.filter((m) => !m.isAdult);

export async function getMangaHome(): Promise<MangaHomeData> {
  "use cache";
  cacheLife("hours");
  cacheTag("anilist:manga-home");
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  const recentFrom = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  type P<T> = { media: T[] };
  type R = { [K in keyof MangaHomeData]: P<MangaHomeData[K][number]> };
  const r = await anilistRequest<R>(MANGA_HOME_QUERY, { recentFrom });
  const out = {} as MangaHomeData;
  for (const k of Object.keys(r) as (keyof MangaHomeData)[]) (out as Record<string, unknown>)[k] = safe(r[k].media as MangaCard[]);
  return out;
}

export async function browseManga(params: MangaBrowseParams): Promise<MangaPage> {
  if (params.author) {
    type S = { Staff: { staffMedia: { pageInfo: PageInfo; nodes: MangaCard[] } } | null };
    try {
      const s = await anilistRequest<S>(MANGA_STAFF_SEARCH_QUERY, { search: params.author, page: params.page ?? 1, perPage: Math.min(params.perPage ?? 24, 50) });
      if (!s.Staff) return { pageInfo: EMPTY_PAGE, media: [] };
      return { pageInfo: s.Staff.staffMedia.pageInfo, media: safe(s.Staff.staffMedia.nodes) };
    } catch (err) {
      if ((err as { status?: number }).status === 404) return { pageInfo: EMPTY_PAGE, media: [] };
      throw err;
    }
  }
  const d = await anilistRequest<{ Page: MangaPage }>(MANGA_BROWSE_QUERY, mangaBrowseVariables(params));
  return { pageInfo: d.Page.pageInfo, media: safe(d.Page.media) };
}

export type MangaSuggestion = {
  id: number;
  title: MediaTitle;
  coverImage: { large: string | null; color: string | null };
  format: string | null;
  status: string | null;
  chapters: number | null;
  volumes: number | null;
  averageScore: number | null;
  countryOfOrigin: string | null;
  startDate: { year: number | null };
};

const suggestCache = new Map<string, { expires: number; data: MangaSuggestion[] }>();

export async function suggestManga(search: string): Promise<MangaSuggestion[]> {
  const key = search.trim().toLowerCase();
  const hit = suggestCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  const d = await anilistRequest<{ Page: { media: MangaSuggestion[] } }>(MANGA_SUGGEST_QUERY, { search: key });
  if (suggestCache.size > 200) {
    const first = suggestCache.keys().next().value;
    if (first) suggestCache.delete(first);
  }
  suggestCache.set(key, { expires: Date.now() + 10 * 60_000, data: d.Page.media });
  return d.Page.media;
}

export async function getMangaDetail(id: number): Promise<MangaDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`anilist:manga:${id}`);
  try {
    const d = await anilistRequest<{ Media: MangaDetail | null }>(MANGA_DETAIL_QUERY, { id });
    return d.Media;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function getMangaBatch(ids: number[]): Promise<MangaCard[]> {
  if (!ids.length) return [];
  const d = await anilistRequest<{ Page: { media: MangaCard[] } }>(MANGA_BATCH_QUERY, { ids: ids.slice(0, 50) });
  return d.Page.media;
}

export type AnimeSourceInfo = {
  id: number;
  title: MediaTitle;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  format: string | null;
  episodes: number | null;
  seasonYear: number | null;
  source: string | null;
  status: string | null;
  relations: { edges: { relationType: string; node: MangaCard & { type: "ANIME" | "MANGA" } }[] };
};

export async function getAnimeSource(animeId: number): Promise<AnimeSourceInfo | null> {
  "use cache";
  cacheLife("days");
  cacheTag(`anilist:anime-source:${animeId}`);
  try {
    const d = await anilistRequest<{ Media: AnimeSourceInfo | null }>(ANIME_SOURCE_QUERY, { id: animeId });
    return d.Media;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function getMangaCharacter(id: number): Promise<MangaCharacter | null> {
  "use cache";
  cacheLife("days");
  try {
    const d = await anilistRequest<{ Character: MangaCharacter | null }>(MANGA_CHARACTER_QUERY, { id });
    return d.Character;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export type { MangaHero };
