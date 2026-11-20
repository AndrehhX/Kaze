import type { MediaListStatus } from "@/lib/anilist/types";
import { creditsOf, type MangaCard } from "@/lib/anilist/manga-types";

/** Manga list statuses mirror AniList's so sync is lossless; labels are manga-specific. */
export type MangaStatus = MediaListStatus;

export const MANGA_LIBRARY_STATUSES: { value: MangaStatus; label: string; jp: string }[] = [
  { value: "CURRENT", label: "Leyendo", jp: "読書中" },
  { value: "PLANNING", label: "Por leer", jp: "予定" },
  { value: "COMPLETED", label: "Completado", jp: "読了" },
  { value: "PAUSED", label: "En pausa", jp: "中断" },
  { value: "DROPPED", label: "Abandonado", jp: "中止" },
  { value: "REPEATING", label: "Releyendo", jp: "再読" },
];

export function mangaStatusMeta(s: MangaStatus) {
  return MANGA_LIBRARY_STATUSES.find((x) => x.value === s) ?? MANGA_LIBRARY_STATUSES[0];
}

/** Denormalized metadata so the manga library renders offline and without refetching AniList. */
export type MangaSnapshot = {
  kind: "manga";
  title: string;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  color: string | null;
  chapters: number | null;
  volumes: number | null;
  format: string | null;
  country: string | null;
  year: number | null;
  genres: string[];
  averageScore: number | null;
  author: string | null;
  /** Route slug for KAZE Originals demo series (non-AniList). */
  slug?: string | null;
};

export type MangaLibraryEntry = {
  /** AniList id (positive) or a KAZE Originals demo id (negative). */
  mangaId: number;
  status: MangaStatus;
  /** Chapters read — integer, AniList-compatible. */
  progress: number;
  progressVolumes: number;
  /** Page-level resume point (KAZE-only; AniList cannot store it). */
  lastChapterId: string | null;
  lastChapterLabel: string | null;
  lastPage: number | null;
  score: number | null;
  notes: string;
  favorite: boolean;
  startedAt: string | null;
  completedAt: string | null;
  repeat: number;
  createdAt: number;
  updatedAt: number;
  media: MangaSnapshot;
  anilistUpdatedAt?: number | null;
  syncedAt?: number | null;
};

export type MangaCollection = {
  id: string;
  name: string;
  description: string;
  color: string;
  isPublic: boolean;
  mangaIds: number[];
  createdAt: number;
  updatedAt: number;
};

export type ChapterProgress = {
  mangaId: number;
  chapterId: string;
  /** 0-based index of the last page viewed. */
  page: number;
  pageCount: number;
  completed: boolean;
  updatedAt: number;
};

export type MangaBookmark = {
  id: string;
  mangaId: number;
  chapterId: string;
  chapterLabel: string;
  page: number;
  note: string;
  createdAt: number;
};

/** A measured reading session: time only counts while the reader is visible and the user is active. */
export type ReadingSession = {
  id: string;
  mangaId: number;
  chapterId: string;
  startedAt: number;
  endedAt: number;
  activeSeconds: number;
  pagesViewed: number;
};

export function snapshotFromManga(m: MangaCard): MangaSnapshot {
  return {
    kind: "manga",
    title: m.title.english || m.title.userPreferred || m.title.romaji || "Sin título",
    titleNative: m.title.native,
    cover: m.coverImage.extraLarge || m.coverImage.large,
    banner: m.bannerImage,
    color: m.coverImage.color,
    chapters: m.chapters,
    volumes: m.volumes,
    format: m.format,
    country: m.countryOfOrigin,
    year: m.startDate?.year ?? null,
    genres: m.genres ?? [],
    averageScore: m.averageScore,
    author: creditsOf(m).author,
  };
}

/** Status/progress invariants after any edit. Totals are only enforced when AniList actually knows them. */
export function normalizeMangaEntry(e: MangaLibraryEntry, now = Date.now()): MangaLibraryEntry {
  const totalCh = e.media.chapters ?? null;
  const totalVol = e.media.volumes ?? null;
  let progress = Math.max(0, Math.floor(e.progress || 0));
  let progressVolumes = Math.max(0, Math.floor(e.progressVolumes || 0));
  if (totalCh) progress = Math.min(progress, totalCh);
  if (totalVol) progressVolumes = Math.min(progressVolumes, totalVol);
  let status = e.status;
  let completedAt = e.completedAt;
  let startedAt = e.startedAt;
  const today = new Date(now).toISOString().slice(0, 10);
  if (totalCh && progress >= totalCh && (status === "CURRENT" || status === "REPEATING")) status = "COMPLETED";
  if (status === "COMPLETED") {
    if (totalCh) progress = totalCh;
    if (totalVol) progressVolumes = totalVol;
    completedAt = completedAt ?? today;
  }
  if ((status === "CURRENT" || status === "COMPLETED" || status === "REPEATING") && !startedAt && progress > 0) startedAt = today;
  const score = e.score == null ? null : Math.max(0, Math.min(100, Math.round(e.score)));
  return { ...e, progress, progressVolumes, status, completedAt, startedAt, score: score === 0 ? null : score };
}

export function newMangaEntry(mangaId: number, media: MangaSnapshot, now = Date.now()): MangaLibraryEntry {
  return {
    mangaId,
    status: "PLANNING",
    progress: 0,
    progressVolumes: 0,
    lastChapterId: null,
    lastChapterLabel: null,
    lastPage: null,
    score: null,
    notes: "",
    favorite: false,
    startedAt: null,
    completedAt: null,
    repeat: 0,
    createdAt: now,
    updatedAt: now,
    media,
  };
}

/** Canonical URL for a manga (demo series use their slug). */
export function mangaHref(id: number, slug?: string | null) {
  return slug ? `/manga/${slug}` : `/manga/${id}`;
}
