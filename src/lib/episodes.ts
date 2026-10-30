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

/**
 * Builds an honest episode list. AniList provides an episode *count*, an airing
 * schedule and, for some titles, official streaming episode titles/thumbnails.
 * Nothing is invented: unknown titles stay null and render as "Episode N".
 */
export function buildEpisodes(m: Pick<MediaDetail, "episodes" | "nextAiringEpisode" | "streamingEpisodes" | "airingSchedule" | "duration" | "status">, nowSec: number): EpisodeRow[] {
  const streaming = new Map<number, { title: string | null; thumbnail: string | null; url: string | null; site: string | null }>();
  for (const s of m.streamingEpisodes ?? []) {
    const match = s.title?.match(/^Episode\s+(\d+)\s*[-–:]\s*(.*)$/i);
    if (match) streaming.set(Number(match[1]), { title: match[2].trim() || null, thumbnail: s.thumbnail, url: s.url, site: s.site });
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

  const rows: EpisodeRow[] = [];
  for (let n = 1; n <= Math.min(total, 2000); n++) {
    const s = streaming.get(n);
    const at = schedule.get(n) ?? null;
    rows.push({
      number: n,
      title: s?.title ?? null,
      thumbnail: s?.thumbnail ?? null,
      officialUrl: s?.url?.replace(/^http:/, "https:") ?? null,
      officialSite: s?.site ?? null,
      airingAt: at,
      durationMin: m.duration ?? null,
      aired: n <= airedCount || (at != null && at <= nowSec),
    });
  }
  return rows;
}
