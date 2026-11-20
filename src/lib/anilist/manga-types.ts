/** Typed subset of the AniList schema for MANGA-type media (manga, manhwa, manhua, light novels, one-shots). */

import type { AniListReview, CharacterEdge, ExternalLink, FuzzyDate, MangaFormat, MediaCard, MediaListStatus, MediaStatus, MediaTag, MediaTitle, PageInfo } from "./types";

export type CountryOfOrigin = "JP" | "KR" | "CN" | "TW";

export type MangaStaffEdge = {
  role: string;
  node: { id: number; name: { full: string; native: string | null }; image: { large: string | null } };
};

export type MangaCard = {
  id: number;
  idMal: number | null;
  title: MediaTitle;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  format: MangaFormat | null;
  status: MediaStatus | null;
  /** AniList only knows totals for finished series; ongoing titles are usually null. Never invent them. */
  chapters: number | null;
  volumes: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  genres: string[];
  isAdult: boolean;
  countryOfOrigin: CountryOfOrigin | string | null;
  startDate: FuzzyDate;
  endDate: FuzzyDate;
  /** Story & art credits, best-effort (AniList role strings such as "Story & Art", "Story", "Art"). */
  staff: { edges: MangaStaffEdge[] };
};

export type MangaHero = MangaCard & {
  description: string | null;
  tags: Pick<MediaTag, "id" | "name" | "rank" | "isMediaSpoiler">[];
};

export type MangaRelationEdge = {
  relationType: string;
  node: (MediaCard | MangaCard) & { type: "ANIME" | "MANGA"; format: string | null };
};

export type MangaDetail = MangaHero & {
  synonyms: string[];
  source: string | null;
  siteUrl: string;
  hashtag: string | null;
  tags: MediaTag[];
  relations: { edges: MangaRelationEdge[] };
  recommendations: { nodes: { rating: number; mediaRecommendation: (MangaCard & { type: "MANGA" | "ANIME" }) | null }[] };
  characters: { edges: Pick<CharacterEdge, "role" | "node">[] };
  allStaff: { edges: MangaStaffEdge[] };
  externalLinks: ExternalLink[];
  rankings: { id: number; rank: number; type: "RATED" | "POPULAR"; context: string; allTime: boolean; year: number | null }[];
  stats: {
    scoreDistribution: { score: number; amount: number }[];
    statusDistribution: { status: MediaListStatus; amount: number }[];
  } | null;
  reviews: { nodes: AniListReview[] };
};

export type MangaSort = "TRENDING_DESC" | "POPULARITY_DESC" | "SCORE_DESC" | "FAVOURITES_DESC" | "START_DATE_DESC" | "START_DATE" | "TITLE_ROMAJI" | "CHAPTERS_DESC" | "VOLUMES_DESC" | "UPDATED_AT_DESC" | "SEARCH_MATCH";

export type MangaBrowseParams = {
  search?: string;
  genres?: string[];
  excludedGenres?: string[];
  tags?: string[];
  yearFrom?: number;
  yearTo?: number;
  formats?: MangaFormat[];
  status?: MediaStatus;
  country?: CountryOfOrigin;
  minScore?: number;
  minChapters?: number;
  maxChapters?: number;
  minVolumes?: number;
  maxVolumes?: number;
  minPopularity?: number;
  maxPopularity?: number;
  /** Staff name search (author/artist). Resolved through AniList's Staff search. */
  author?: string;
  sort?: MangaSort;
  page?: number;
  perPage?: number;
};

export type MangaPage = { pageInfo: PageInfo; media: MangaCard[] };

export type MangaHomeData = {
  trending: MangaHero[];
  popularMonth: MangaCard[];
  topRated: MangaCard[];
  recentlyUpdated: MangaCard[];
  completed: MangaCard[];
  gems: MangaCard[];
  newDiscoveries: MangaCard[];
  shortReads: MangaCard[];
  longRunning: MangaCard[];
  manhwa: MangaCard[];
};

export type MangaCharacter = {
  id: number;
  name: { full: string; native: string | null; alternative: string[] };
  image: { large: string | null };
  description: string | null;
  gender: string | null;
  age: string | null;
  favourites: number | null;
  siteUrl: string;
  media: { edges: { characterRole: string; node: MangaCard & { type: "ANIME" | "MANGA" } }[] };
};

export type AniListMangaListEntry = {
  id: number;
  mediaId: number;
  status: MediaListStatus;
  score: number;
  progress: number;
  progressVolumes: number | null;
  repeat: number;
  notes: string | null;
  updatedAt: number;
  startedAt: FuzzyDate;
  completedAt: FuzzyDate;
  media: MangaCard;
};

export function isMangaFormat(format: string | null | undefined): format is MangaFormat {
  return format === "MANGA" || format === "NOVEL" || format === "ONE_SHOT";
}

/** Best-effort story/art credit line built only from AniList staff roles. */
export function creditsOf(m: Pick<MangaCard, "staff">): { author: string | null; artist: string | null } {
  const edges = m.staff?.edges ?? [];
  const find = (re: RegExp) => edges.find((e) => re.test(e.role))?.node.name.full ?? null;
  const both = find(/story\s*&\s*art/i);
  if (both) return { author: both, artist: both };
  return { author: find(/^(original )?(story|creator|original creator)/i) ?? find(/story/i), artist: find(/^(art|illustration)/i) ?? find(/\bart\b/i) };
}

/** Readable label for the country a work comes from (manga / manhwa / manhua). */
export function originLabel(country: string | null | undefined, format?: string | null): string {
  if (format === "NOVEL") return "Novela ligera";
  if (format === "ONE_SHOT") return "One-shot";
  if (country === "KR") return "Manhwa";
  if (country === "CN" || country === "TW") return "Manhua";
  return "Manga";
}

export function mangaTitle(m: { title: MediaTitle }): string {
  return m.title.english || m.title.userPreferred || m.title.romaji || "Sin título";
}
