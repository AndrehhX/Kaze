import { fuzzyToIso, reconcile, type RemoteEntry, type SyncDecision } from "@/lib/library/sync";
import type { AniListMangaListEntry } from "@/lib/anilist/manga-types";
import { snapshotFromManga, type MangaLibraryEntry } from "./types";

/**
 * AniList ⇄ KAZE manga list reconciliation. Uses the same rules as anime (never silently overwrite,
 * progress takes the max, newer side wins status/score/notes) plus volume progress.
 * Page-level resume data (lastChapterId / lastPage) is KAZE-only and is never sent to or overwritten by AniList.
 */

export type MangaRemoteEntry = RemoteEntry & { progressVolumes: number };
type Adapted = MangaLibraryEntry & { mediaId: number };
export type MangaSyncDecision = SyncDecision<Adapted> & { volumes?: number };

export function remoteFromAniListManga(e: AniListMangaListEntry): MangaRemoteEntry {
  return {
    mediaId: e.mediaId,
    status: e.status,
    progress: e.progress,
    progressVolumes: e.progressVolumes ?? 0,
    score: e.score || null,
    notes: e.notes ?? "",
    updatedAt: e.updatedAt * 1000,
    startedAt: fuzzyToIso(e.startedAt),
    completedAt: fuzzyToIso(e.completedAt),
    repeat: e.repeat,
  };
}

export function reconcileManga(local: MangaLibraryEntry[], remote: MangaRemoteEntry[], lastSyncAt: number | null): MangaSyncDecision[] {
  // Demo series (negative ids) do not exist on AniList and never take part in sync.
  const adapted: Adapted[] = local.filter((e) => e.mangaId > 0).map((e) => ({ ...e, mediaId: e.mangaId }));
  const remoteMap = new Map(remote.map((r) => [r.mediaId, r]));
  const localMap = new Map(adapted.map((l) => [l.mediaId, l]));
  return reconcile(adapted, remote, lastSyncAt).map((d) => {
    const r = remoteMap.get(d.mediaId);
    const l = localMap.get(d.mediaId);
    // Volumes are not part of the shared rule set: keep the higher count, like chapter progress.
    if (d.kind === "noop" && r && l && r.progressVolumes !== l.progressVolumes) {
      const volumes = Math.max(r.progressVolumes, l.progressVolumes);
      return { kind: "merge", mediaId: d.mediaId, merged: { ...r }, pushRemote: volumes !== r.progressVolumes, conflict: ["volumes"], volumes };
    }
    return { ...d, volumes: Math.max(r?.progressVolumes ?? 0, l?.progressVolumes ?? 0) };
  });
}

/** Builds the local entry that results from applying a remote/merged record, preserving KAZE-only fields. */
export function applyRemoteToLocal(r: RemoteEntry, volumes: number, prev: MangaLibraryEntry | undefined, media: AniListMangaListEntry | undefined, now = Date.now()): MangaLibraryEntry {
  return {
    mangaId: r.mediaId,
    status: r.status,
    progress: r.progress,
    progressVolumes: volumes,
    lastChapterId: prev?.lastChapterId ?? null,
    lastChapterLabel: prev?.lastChapterLabel ?? null,
    lastPage: prev?.lastPage ?? null,
    score: r.score,
    notes: r.notes,
    favorite: prev?.favorite ?? false,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    repeat: r.repeat,
    createdAt: prev?.createdAt ?? now,
    updatedAt: Math.max(r.updatedAt, prev?.updatedAt ?? 0),
    media: prev?.media ?? (media ? snapshotFromManga(media.media) : { kind: "manga", title: `AniList #${r.mediaId}`, titleNative: null, cover: null, banner: null, color: null, chapters: null, volumes: null, format: null, country: null, year: null, genres: [], averageScore: null, author: null }),
    anilistUpdatedAt: r.updatedAt,
    syncedAt: now,
  };
}

export function summarize(decisions: MangaSyncDecision[]) {
  return decisions.reduce<Record<string, number>>((a, d) => ((a[d.kind] = (a[d.kind] ?? 0) + 1), a), {});
}
