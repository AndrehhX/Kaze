import type { MediaCard, MediaListStatus } from "@/lib/anilist/types";

export type LibraryStatus = MediaListStatus;

export const LIBRARY_STATUSES: { value: LibraryStatus; label: string; jp: string; short: string }[] = [
  { value: "CURRENT", label: "Watching", jp: "視聴中", short: "Watching" },
  { value: "PLANNING", label: "Plan to Watch", jp: "予定", short: "Planning" },
  { value: "COMPLETED", label: "Completed", jp: "完了", short: "Completed" },
  { value: "PAUSED", label: "Paused", jp: "中断", short: "Paused" },
  { value: "DROPPED", label: "Dropped", jp: "中止", short: "Dropped" },
  { value: "REPEATING", label: "Rewatching", jp: "再視聴", short: "Rewatching" },
];

export function statusMeta(s: LibraryStatus) {
  return LIBRARY_STATUSES.find((x) => x.value === s) ?? LIBRARY_STATUSES[0];
}

/** Small, denormalized snapshot of AniList metadata so the library renders without refetching. */
export type MediaSnapshot = {
  title: string;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  color: string | null;
  episodes: number | null;
  format: string | null;
  year: number | null;
  genres: string[];
  averageScore: number | null;
  studio: string | null;
  duration: number | null;
};

export type LibraryEntry = {
  mediaId: number;
  status: LibraryStatus;
  progress: number;
  /** 0–100, null when unrated. */
  score: number | null;
  notes: string;
  favorite: boolean;
  startedAt: string | null;
  completedAt: string | null;
  repeat: number;
  createdAt: number;
  updatedAt: number;
  media: MediaSnapshot;
  /** AniList sync bookkeeping. */
  anilistUpdatedAt?: number | null;
  syncedAt?: number | null;
};

export type Collection = {
  id: string;
  name: string;
  description: string;
  color: string;
  isPublic: boolean;
  mediaIds: number[];
  createdAt: number;
  updatedAt: number;
};

export function snapshotFromMedia(m: MediaCard): MediaSnapshot {
  return {
    title: m.title.english || m.title.userPreferred || m.title.romaji || "Untitled",
    titleNative: m.title.native,
    cover: m.coverImage.extraLarge || m.coverImage.large,
    banner: m.bannerImage,
    color: m.coverImage.color,
    episodes: m.episodes,
    format: m.format,
    year: m.seasonYear ?? m.startDate?.year ?? null,
    genres: m.genres ?? [],
    averageScore: m.averageScore,
    studio: m.studios?.nodes?.[0]?.name ?? null,
    duration: m.duration,
  };
}

/** Normalizes status/progress invariants after any edit. */
export function normalizeEntry(e: LibraryEntry, now = Date.now()): LibraryEntry {
  const total = e.media.episodes ?? null;
  let progress = Math.max(0, Math.floor(e.progress || 0));
  if (total) progress = Math.min(progress, total);
  let status = e.status;
  let completedAt = e.completedAt;
  let startedAt = e.startedAt;
  const today = new Date(now).toISOString().slice(0, 10);
  if (total && progress >= total && (status === "CURRENT" || status === "REPEATING")) {
    status = "COMPLETED";
  }
  if (status === "COMPLETED") {
    if (total) progress = total;
    completedAt = completedAt ?? today;
  }
  if ((status === "CURRENT" || status === "COMPLETED") && !startedAt && progress > 0) startedAt = today;
  const score = e.score == null ? null : Math.max(0, Math.min(100, Math.round(e.score)));
  return { ...e, progress, status, completedAt, startedAt, score: score === 0 ? null : score };
}
