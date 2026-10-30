import type { MediaDetail } from "@/lib/anilist/types";

export type EpisodeRow = {
  number: number;
  title: string | null;
  thumbnail: string | null;
  /** Official streaming page for this episode (from AniList's streamingEpisodes). */
  officialUrl: string | null;
  officialSite: string | null;
  airingAt: number | null;
  durationMin: number | null;
  aired: boolean;
};

export function parseEpisodeNumber(title?: string | null, url?: string | null): number | null {
  if (title) {
    const m =
      title.match(/(?:Episode|Episodio|Cap[ií]tulo|Ep\.?)\s*(\d+)/i) ||
      title.match(/^(\d+)\s*[-–:.]/i) ||
      title.match(/^(\d+)$/);
    if (m) return parseInt(m[1], 10);
  }
  if (url) {
    const m = url.match(/episode-(\d+)/i) || url.match(/\/(\d+)\/?$/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

export function parseEpisodeTitle(title?: string | null): string | null {
  if (!title) return null;
  const m =
    title.match(/(?:Episode|Episodio|Cap[ií]tulo|Ep\.?)\s*\d+\s*[-–:]\s*(.*)/i) ||
    title.match(/^\d+\s*[-–:]\s*(.*)/i);
  if (m && m[1].trim()) return m[1].trim();
  if (/^(?:Episode|Episodio|Cap[ií]tulo|Ep\.?)\s*\d+$/i.test(title.trim()) || /^\d+$/.test(title.trim())) {
    return null;
  }
  return title.trim();
}

/**
 * Builds an honest episode list. AniList provides an episode *count*, an airing
 * schedule and, for some titles, official streaming episode titles/thumbnails.
 * When official thumbnails are missing, falls back cleanly to the media's banner or cover.
 */
export function buildEpisodes(
  m: Pick<MediaDetail, "episodes" | "nextAiringEpisode" | "streamingEpisodes" | "airingSchedule" | "duration" | "status"> & {
    bannerImage?: string | null;
    coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  },
  nowSec: number
): EpisodeRow[] {
  const streaming = new Map<number, { title: string | null; thumbnail: string | null; url: string | null; site: string | null }>();
  for (const s of m.streamingEpisodes ?? []) {
    const num = parseEpisodeNumber(s.title, s.url);
    if (num != null) {
      streaming.set(num, {
        title: parseEpisodeTitle(s.title),
        thumbnail: s.thumbnail || null,
        url: s.url,
        site: s.site,
      });
    }
  }
  const schedule = new Map<number, number>();
  for (const a of m.airingSchedule?.nodes ?? []) schedule.set(a.episode, a.airingAt);

  const airedCount =
    m.status === "FINISHED"
      ? (m.episodes ?? Math.max(0, ...streaming.keys()))
      : m.nextAiringEpisode
        ? m.nextAiringEpisode.episode - 1
        : m.status === "NOT_YET_RELEASED"
          ? 0
          : Math.max(0, ...streaming.keys(), ...[...schedule.entries()].filter(([, t]) => t <= nowSec).map(([e]) => e));
  const total = Math.max(m.episodes ?? 0, airedCount, ...schedule.keys());

  const fallbackThumb = m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large || null;

  const rows: EpisodeRow[] = [];
  for (let n = 1; n <= Math.min(total, 2000); n++) {
    const s = streaming.get(n);
    const at = schedule.get(n) ?? null;
    rows.push({
      number: n,
      title: s?.title ?? null,
      thumbnail: s?.thumbnail || fallbackThumb,
      officialUrl: s?.url?.replace(/^http:/, "https:") ?? null,
      officialSite: s?.site ?? null,
      airingAt: at,
      durationMin: m.duration ?? null,
      aired: n <= airedCount || (at != null && at <= nowSec),
    });
  }
  return rows;
}
