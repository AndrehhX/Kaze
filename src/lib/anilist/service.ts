import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { anilistRequest } from "./client";
import {
  BROWSE_QUERY,
  CHARACTER_QUERY,
  DETAIL_QUERY,
  HOME_QUERY,
  MEDIA_BATCH_QUERY,
  META_QUERY,
  RECOMMENDATIONS_QUERY,
  STUDIO_SEARCH_QUERY,
  SUGGEST_QUERY,
} from "./queries";
import type { AiringItem, BrowseParams, Character, HomeData, MediaCard, MediaDetail, MediaHero, MediaSeason, PageInfo } from "./types";
import { seasonOf } from "@/lib/utils";

/* All public reads are cached server-side so AniList sees a handful of requests per hour, not per visitor. */

export async function getHomeData(): Promise<HomeData> {
  "use cache";
  cacheLife("hours");
  cacheTag("anilist:home");
  const now = new Date();
  const { season, year } = seasonOf(now);
  const nowSec = Math.floor(now.getTime() / 1000);
  type R = {
    trending: { media: MediaHero[] };
    season: { media: MediaHero[] };
    top: { media: MediaCard[] };
    gems: { media: MediaCard[] };
    upcoming: { media: MediaCard[] };
    favourites: { media: MediaCard[] };
    recent: { airingSchedules: AiringItem[] };
  };
  const d = await anilistRequest<R>(HOME_QUERY, { season, year, from: nowSec - 3 * 86400, to: nowSec });
  const seen = new Set<number>();
  const recent = d.recent.airingSchedules.filter((a) => {
    if (!a.media || a.media.isAdult || seen.has(a.media.id)) return false;
    seen.add(a.media.id);
    return true;
  });
  return {
    trending: d.trending.media,
    season: d.season.media,
    top: d.top.media,
    gems: d.gems.media,
    upcoming: d.upcoming.media,
    favourites: d.favourites.media,
    recent: recent.slice(0, 16),
    seasonInfo: { season, year },
  };
}

export function browseVariables(p: BrowseParams) {
  const sort = p.sort ?? (p.search ? "SEARCH_MATCH" : "POPULARITY_DESC");
  return {
    page: p.page ?? 1,
    perPage: Math.min(p.perPage ?? 24, 50),
    search: p.search || undefined,
    genres: p.genres?.length ? p.genres : undefined,
    excludedGenres: p.excludedGenres?.length ? p.excludedGenres : undefined,
    tags: p.tags?.length ? p.tags : undefined,
    year: p.year,
    // FuzzyDateInt is YYYYMMDD; "greater/lesser" are exclusive.
    yearFrom: p.yearFrom ? p.yearFrom * 10000 - 1 : undefined,
    yearTo: p.yearTo ? (p.yearTo + 1) * 10000 : undefined,
    season: p.season,
    formats: p.formats?.length ? p.formats : undefined,
    status: p.status,
    minScore: p.minScore ? p.minScore - 1 : undefined,
    minEpisodes: p.minEpisodes ? p.minEpisodes - 1 : undefined,
    maxEpisodes: p.maxEpisodes ? p.maxEpisodes + 1 : undefined,
    minPopularity: p.minPopularity,
    maxPopularity: p.maxPopularity,
    source: p.source,
    // ID_DESC is a stable tiebreaker so pagination never repeats items.
    sort: sort === "SEARCH_MATCH" ? (p.search ? ["SEARCH_MATCH"] : ["POPULARITY_DESC", "ID_DESC"]) : [sort, "ID_DESC"],
  };
}

export async function browseMedia(params: BrowseParams): Promise<{ pageInfo: PageInfo; media: MediaCard[] }> {
  "use cache";
  if (params.search) cacheLife("minutes");
  else cacheLife("hours");
  cacheTag("anilist:browse");
  if (params.studio) {
    type S = { Studio: { id: number; name: string; media: { pageInfo: PageInfo; nodes: MediaCard[] } } | null };
    const s = await anilistRequest<S>(STUDIO_SEARCH_QUERY, { search: params.studio, page: params.page ?? 1, perPage: params.perPage ?? 24 });
    if (!s.Studio) return { pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 24 }, media: [] };
    return { pageInfo: s.Studio.media.pageInfo, media: s.Studio.media.nodes.filter((m) => !m.isAdult) };
  }
  type R = { Page: { pageInfo: PageInfo; media: MediaCard[] } };
  const d = await anilistRequest<R>(BROWSE_QUERY, browseVariables(params));
  return d.Page;
}

export type Suggestion = Pick<MediaCard, "id" | "title" | "format" | "seasonYear" | "averageScore" | "episodes" | "status"> & {
  coverImage: { large: string | null; color: string | null };
};

export async function suggestMedia(search: string): Promise<Suggestion[]> {
  "use cache";
  cacheLife("minutes");
  type R = { Page: { media: Suggestion[] } };
  const d = await anilistRequest<R>(SUGGEST_QUERY, { search });
  return d.Page.media;
}

export async function getMediaDetail(id: number): Promise<MediaDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`anilist:media:${id}`);
  try {
    const d = await anilistRequest<{ Media: MediaDetail | null }>(DETAIL_QUERY, { id });
    return d.Media;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function getRecommendationsFor(id: number) {
  "use cache";
  cacheLife("hours");
  type R = {
    Media: {
      id: number;
      title: MediaCard["title"];
      coverImage: { large: string | null; color: string | null };
      genres: string[];
      recommendations: { nodes: { rating: number; mediaRecommendation: MediaCard | null }[] };
      relations: { edges: { relationType: string; node: MediaCard & { type: string } }[] };
    } | null;
  };
  const d = await anilistRequest<R>(RECOMMENDATIONS_QUERY, { id });
  return d.Media;
}

export async function getMediaBatch(ids: number[]): Promise<MediaCard[]> {
  "use cache";
  cacheLife("hours");
  if (!ids.length) return [];
  const d = await anilistRequest<{ Page: { media: MediaCard[] } }>(MEDIA_BATCH_QUERY, { ids: ids.slice(0, 50) });
  return d.Page.media;
}

export async function getCharacter(id: number): Promise<Character | null> {
  "use cache";
  cacheLife("days");
  try {
    const d = await anilistRequest<{ Character: Character | null }>(CHARACTER_QUERY, { id });
    return d.Character;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function getMeta(): Promise<{ genres: string[]; tags: { name: string; category: string; description: string }[] }> {
  "use cache";
  cacheLife("days");
  type R = { GenreCollection: string[]; MediaTagCollection: { name: string; category: string; isAdult: boolean; description: string }[] };
  const d = await anilistRequest<R>(META_QUERY);
  return {
    genres: d.GenreCollection.filter((g) => g !== "Hentai"),
    tags: d.MediaTagCollection.filter((t) => !t.isAdult).map(({ name, category, description }) => ({ name, category, description })),
  };
}

export async function getSeason(season: MediaSeason, year: number, page = 1) {
  "use cache";
  cacheLife("hours");
  type R = { Page: { pageInfo: PageInfo; media: MediaCard[] } };
  const d = await anilistRequest<R>(BROWSE_QUERY, browseVariables({ season, year, sort: "POPULARITY_DESC", perPage: 50, page }));
  return d.Page;
}
