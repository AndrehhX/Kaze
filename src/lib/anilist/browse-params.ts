import { z } from "zod";
import type { BrowseParams, BrowseSort, MediaFormat, MediaSeason, MediaSource, MediaStatus } from "./types";

export const SORTS: { value: BrowseSort; label: string }[] = [
  { value: "POPULARITY_DESC", label: "Más populares" },
  { value: "TRENDING_DESC", label: "Tendencias" },
  { value: "SCORE_DESC", label: "Mejor valorados" },
  { value: "FAVOURITES_DESC", label: "Más favoritos" },
  { value: "START_DATE_DESC", label: "Más recientes" },
  { value: "START_DATE", label: "Más antiguos" },
  { value: "TITLE_ROMAJI", label: "Título A–Z" },
  { value: "EPISODES_DESC", label: "Más episodios" },
];

export const FORMATS: { value: MediaFormat; label: string }[] = [
  { value: "TV", label: "Serie TV" },
  { value: "MOVIE", label: "Película" },
  { value: "ONA", label: "ONA" },
  { value: "OVA", label: "OVA" },
  { value: "SPECIAL", label: "Especial" },
  { value: "TV_SHORT", label: "Corto TV" },
  { value: "MUSIC", label: "Musical" },
];

export const SEASONS: { value: MediaSeason; label: string; jp: string }[] = [
  { value: "WINTER", label: "Invierno", jp: "冬" },
  { value: "SPRING", label: "Primavera", jp: "春" },
  { value: "SUMMER", label: "Verano", jp: "夏" },
  { value: "FALL", label: "Otoño", jp: "秋" },
];

export const STATUSES: { value: MediaStatus; label: string }[] = [
  { value: "RELEASING", label: "En emisión" },
  { value: "FINISHED", label: "Finalizado" },
  { value: "NOT_YET_RELEASED", label: "Próximamente" },
  { value: "HIATUS", label: "En pausa" },
  { value: "CANCELLED", label: "Cancelado" },
];

export const SOURCES: { value: MediaSource; label: string }[] = [
  { value: "ORIGINAL", label: "Original" },
  { value: "MANGA", label: "Manga" },
  { value: "LIGHT_NOVEL", label: "Novela ligera" },
  { value: "WEB_NOVEL", label: "Novela web" },
  { value: "NOVEL", label: "Novela" },
  { value: "VISUAL_NOVEL", label: "Novela visual" },
  { value: "VIDEO_GAME", label: "Videojuego" },
  { value: "OTHER", label: "Otro" },
];

export const GENRE_LABELS: Record<string, string> = {
  Action: "Acción",
  Adventure: "Aventura",
  Comedy: "Comedia",
  Drama: "Drama",
  Ecchi: "Ecchi",
  Fantasy: "Fantasía",
  Horror: "Terror",
  "Mahou Shoujo": "Chicas Mágicas",
  Mecha: "Mecha",
  Music: "Música",
  Mystery: "Misterio",
  Psychological: "Psicológico",
  Romance: "Romance",
  "Sci-Fi": "Ciencia Ficción",
  "Slice of Life": "Recuentos de la vida",
  Sports: "Deportes",
  Supernatural: "Sobrenatural",
  Thriller: "Suspense",
};

export function genreLabel(genre: string): string {
  return GENRE_LABELS[genre] ?? genre;
}

export const FALLBACK_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

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
  tags: csv,
  year: int(1940, 2100),
  from: int(1940, 2100),
  to: int(1940, 2100),
  season: z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]).optional(),
  format: csv.pipe(z.array(z.enum(["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"])).optional()),
  status: z.enum(["FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"]).optional(),
  score: int(0, 100),
  epMin: int(0, 5000),
  epMax: int(0, 5000),
  popMin: int(0, 10_000_000),
  popMax: int(0, 10_000_000),
  source: z
    .enum(["ORIGINAL", "MANGA", "LIGHT_NOVEL", "VISUAL_NOVEL", "VIDEO_GAME", "OTHER", "NOVEL", "DOUJINSHI", "ANIME", "WEB_NOVEL", "LIVE_ACTION", "GAME", "COMIC", "MULTIMEDIA_PROJECT", "PICTURE_BOOK"])
    .optional(),
  studio: z.string().max(80).optional(),
  sort: z
    .enum(["TRENDING_DESC", "POPULARITY_DESC", "SCORE_DESC", "FAVOURITES_DESC", "START_DATE_DESC", "START_DATE", "TITLE_ROMAJI", "EPISODES_DESC", "SEARCH_MATCH"])
    .optional(),
  page: int(1, 500),
});

type Raw = Record<string, string | string[] | undefined>;

/** Parse URL search params into validated browse params. Invalid values are dropped, never thrown. */
export function parseBrowseParams(input: URLSearchParams | Raw): BrowseParams {
  const raw: Record<string, string> = {};
  if (input instanceof URLSearchParams) {
    input.forEach((v, k) => (raw[k] = v));
  } else {
    for (const [k, v] of Object.entries(input)) if (typeof v === "string") raw[k] = v;
  }
  const out: BrowseParams = {};
  // Validate field-by-field so one bad value does not discard the rest.
  for (const key of Object.keys(schema.shape) as (keyof typeof schema.shape)[]) {
    const r = schema.shape[key].safeParse(raw[key]);
    if (!r.success || r.data === undefined) continue;
    const v = r.data as never;
    switch (key) {
      case "q":
        out.search = (v as string).trim() || undefined;
        break;
      case "from":
        out.yearFrom = v;
        break;
      case "to":
        out.yearTo = v;
        break;
      case "format":
        out.formats = v;
        break;
      case "score":
        out.minScore = v;
        break;
      case "epMin":
        out.minEpisodes = v;
        break;
      case "epMax":
        out.maxEpisodes = v;
        break;
      case "popMin":
        out.minPopularity = v;
        break;
      case "popMax":
        out.maxPopularity = v;
        break;
      default:
        (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

export function serializeBrowseParams(p: BrowseParams): URLSearchParams {
  const s = new URLSearchParams();
  if (p.search) s.set("q", p.search);
  if (p.genres?.length) s.set("genres", p.genres.join(","));
  if (p.tags?.length) s.set("tags", p.tags.join(","));
  if (p.year) s.set("year", String(p.year));
  if (p.yearFrom) s.set("from", String(p.yearFrom));
  if (p.yearTo) s.set("to", String(p.yearTo));
  if (p.season) s.set("season", p.season);
  if (p.formats?.length) s.set("format", p.formats.join(","));
  if (p.status) s.set("status", p.status);
  if (p.minScore) s.set("score", String(p.minScore));
  if (p.minEpisodes) s.set("epMin", String(p.minEpisodes));
  if (p.maxEpisodes) s.set("epMax", String(p.maxEpisodes));
  if (p.minPopularity) s.set("popMin", String(p.minPopularity));
  if (p.maxPopularity) s.set("popMax", String(p.maxPopularity));
  if (p.source) s.set("source", p.source);
  if (p.studio) s.set("studio", p.studio);
  if (p.sort) s.set("sort", p.sort);
  if (p.page && p.page > 1) s.set("page", String(p.page));
  return s;
}

export function activeFilterCount(p: BrowseParams): number {
  return [
    p.genres?.length,
    p.tags?.length,
    p.year,
    p.yearFrom || p.yearTo,
    p.season,
    p.formats?.length,
    p.status,
    p.minScore,
    p.minEpisodes || p.maxEpisodes,
    p.minPopularity || p.maxPopularity,
    p.source,
    p.studio,
  ].filter(Boolean).length;
}
