import { z } from "zod";
import type { MangaFormat, MediaStatus } from "./types";
import type { CountryOfOrigin, MangaBrowseParams, MangaSort } from "./manga-types";

export const MANGA_SORTS: { value: MangaSort; label: string }[] = [
  { value: "POPULARITY_DESC", label: "Más populares" },
  { value: "TRENDING_DESC", label: "Tendencias" },
  { value: "SCORE_DESC", label: "Mejor valorados" },
  { value: "FAVOURITES_DESC", label: "Más favoritos" },
  { value: "START_DATE_DESC", label: "Más recientes" },
  { value: "START_DATE", label: "Más antiguos" },
  { value: "CHAPTERS_DESC", label: "Más capítulos" },
  { value: "VOLUMES_DESC", label: "Más volúmenes" },
  { value: "TITLE_ROMAJI", label: "Título A–Z" },
];

export const MANGA_FORMATS: { value: MangaFormat; label: string }[] = [
  { value: "MANGA", label: "Manga / Manhwa" },
  { value: "ONE_SHOT", label: "One-shot" },
  { value: "NOVEL", label: "Novela ligera" },
];

export const MANGA_STATUSES: { value: MediaStatus; label: string }[] = [
  { value: "RELEASING", label: "En publicación" },
  { value: "FINISHED", label: "Finalizado" },
  { value: "HIATUS", label: "En pausa" },
  { value: "NOT_YET_RELEASED", label: "Próximamente" },
  { value: "CANCELLED", label: "Cancelado" },
];

export const COUNTRIES: { value: CountryOfOrigin; label: string; jp: string }[] = [
  { value: "JP", label: "Manga (Japón)", jp: "漫画" },
  { value: "KR", label: "Manhwa (Corea)", jp: "만화" },
  { value: "CN", label: "Manhua (China)", jp: "漫画" },
  { value: "TW", label: "Taiwán", jp: "漫畫" },
];

/** Length buckets map to real AniList chapter filters (titles with unknown totals are excluded by AniList). */
export const LENGTHS = [
  { value: "short", label: "Corta (≤ 30 cap.)", min: undefined, max: 30 },
  { value: "medium", label: "Media (31–120)", min: 31, max: 120 },
  { value: "long", label: "Larga (121–300)", min: 121, max: 300 },
  { value: "epic", label: "Épica (300+)", min: 301, max: undefined },
] as const;
export type LengthBucket = (typeof LENGTHS)[number]["value"];

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12) : undefined));
const int = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(min).max(max).optional());

const schema = z.object({
  q: z.string().max(100).optional(),
  genres: csv,
  exclude: csv,
  tags: csv,
  from: int(1900, 2100),
  to: int(1900, 2100),
  format: csv.pipe(z.array(z.enum(["MANGA", "NOVEL", "ONE_SHOT"])).optional()),
  status: z.enum(["FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"]).optional(),
  country: z.enum(["JP", "KR", "CN", "TW"]).optional(),
  score: int(0, 100),
  chMin: int(0, 5000),
  chMax: int(0, 5000),
  volMin: int(0, 500),
  volMax: int(0, 500),
  popMin: int(0, 10_000_000),
  popMax: int(0, 10_000_000),
  author: z.string().max(80).optional(),
  sort: z.enum(["TRENDING_DESC", "POPULARITY_DESC", "SCORE_DESC", "FAVOURITES_DESC", "START_DATE_DESC", "START_DATE", "TITLE_ROMAJI", "CHAPTERS_DESC", "VOLUMES_DESC", "UPDATED_AT_DESC", "SEARCH_MATCH"]).optional(),
  page: int(1, 500),
});

const KEY_MAP: Record<string, keyof MangaBrowseParams> = {
  q: "search",
  exclude: "excludedGenres",
  from: "yearFrom",
  to: "yearTo",
  format: "formats",
  score: "minScore",
  chMin: "minChapters",
  chMax: "maxChapters",
  volMin: "minVolumes",
  volMax: "maxVolumes",
  popMin: "minPopularity",
  popMax: "maxPopularity",
};

type Raw = Record<string, string | string[] | undefined>;

/** Validates URL params field-by-field: one bad value is dropped, never the whole query. */
export function parseMangaParams(input: URLSearchParams | Raw): MangaBrowseParams {
  const raw: Record<string, string> = {};
  if (input instanceof URLSearchParams) input.forEach((v, k) => (raw[k] = v));
  else for (const [k, v] of Object.entries(input)) if (typeof v === "string") raw[k] = v;
  const out: MangaBrowseParams = {};
  for (const key of Object.keys(schema.shape) as (keyof typeof schema.shape)[]) {
    const r = schema.shape[key].safeParse(raw[key]);
    if (!r.success || r.data === undefined) continue;
    const target = KEY_MAP[key] ?? (key as keyof MangaBrowseParams);
    const value = key === "q" || key === "author" ? (r.data as string).trim() || undefined : r.data;
    if (value !== undefined) (out as Record<string, unknown>)[target] = value;
  }
  return out;
}

export function serializeMangaParams(p: MangaBrowseParams): URLSearchParams {
  const s = new URLSearchParams();
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    s.set(k, Array.isArray(v) ? v.join(",") : String(v));
  };
  set("q", p.search);
  set("genres", p.genres);
  set("exclude", p.excludedGenres);
  set("tags", p.tags);
  set("from", p.yearFrom);
  set("to", p.yearTo);
  set("format", p.formats);
  set("status", p.status);
  set("country", p.country);
  set("score", p.minScore || undefined);
  set("chMin", p.minChapters);
  set("chMax", p.maxChapters);
  set("volMin", p.minVolumes);
  set("volMax", p.maxVolumes);
  set("popMin", p.minPopularity);
  set("popMax", p.maxPopularity);
  set("author", p.author);
  set("sort", p.sort);
  if (p.page && p.page > 1) s.set("page", String(p.page));
  return s;
}

export function activeMangaFilterCount(p: MangaBrowseParams): number {
  return [
    p.genres?.length,
    p.excludedGenres?.length,
    p.tags?.length,
    p.yearFrom || p.yearTo,
    p.formats?.length,
    p.status,
    p.country,
    p.minScore,
    p.minChapters || p.maxChapters,
    p.minVolumes || p.maxVolumes,
    p.minPopularity || p.maxPopularity,
    p.author,
  ].filter(Boolean).length;
}

/** Converts validated params into AniList variables. AniList's *_greater / *_lesser filters are exclusive. */
export function mangaBrowseVariables(p: MangaBrowseParams) {
  const sort = p.sort ?? (p.search ? "SEARCH_MATCH" : "POPULARITY_DESC");
  return {
    page: p.page ?? 1,
    perPage: Math.min(p.perPage ?? 24, 50),
    search: p.search || undefined,
    genres: p.genres?.length ? p.genres : undefined,
    excludedGenres: p.excludedGenres?.length ? p.excludedGenres : undefined,
    tags: p.tags?.length ? p.tags : undefined,
    yearFrom: p.yearFrom ? p.yearFrom * 10000 - 1 : undefined,
    yearTo: p.yearTo ? (p.yearTo + 1) * 10000 : undefined,
    formats: p.formats?.length ? p.formats : undefined,
    status: p.status,
    country: p.country,
    minScore: p.minScore ? p.minScore - 1 : undefined,
    minChapters: p.minChapters ? p.minChapters - 1 : undefined,
    maxChapters: p.maxChapters ? p.maxChapters + 1 : undefined,
    minVolumes: p.minVolumes ? p.minVolumes - 1 : undefined,
    maxVolumes: p.maxVolumes ? p.maxVolumes + 1 : undefined,
    minPopularity: p.minPopularity,
    maxPopularity: p.maxPopularity,
    sort: sort === "SEARCH_MATCH" ? (p.search ? ["SEARCH_MATCH"] : ["POPULARITY_DESC", "ID_DESC"]) : [sort, "ID_DESC"],
  };
}
