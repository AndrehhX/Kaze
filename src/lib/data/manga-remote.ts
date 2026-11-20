"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChapterProgress, MangaBookmark, MangaCollection, MangaLibraryEntry, MangaSnapshot, ReadingSession } from "@/lib/manga/types";

/**
 * Supabase persistence for the manga library (tables from supabase/migrations/*_kaze_manga.sql).
 * Runs with the user's JWT: Row Level Security decides access. Every method throws on error so the
 * store can detect a database that has not been migrated yet and fall back to device storage.
 */

type EntryRow = {
  user_id: string;
  manga_id: number;
  status: MangaLibraryEntry["status"];
  progress: number;
  progress_volumes: number;
  last_chapter_id: string | null;
  last_chapter_label: string | null;
  last_page: number | null;
  score: number | null;
  favorite: boolean;
  started_at: string | null;
  completed_at: string | null;
  repeat: number;
  media_snapshot: MangaSnapshot;
  anilist_updated_at: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

const toMs = (s: string | null | undefined) => (s ? new Date(s).getTime() : null);
const toIso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);

export function mangaRowToEntry(r: EntryRow, notes = ""): MangaLibraryEntry {
  return {
    mangaId: r.manga_id,
    status: r.status,
    progress: r.progress,
    progressVolumes: r.progress_volumes,
    lastChapterId: r.last_chapter_id,
    lastChapterLabel: r.last_chapter_label,
    lastPage: r.last_page,
    score: r.score,
    notes,
    favorite: r.favorite,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    repeat: r.repeat,
    createdAt: toMs(r.created_at) ?? Date.now(),
    updatedAt: toMs(r.updated_at) ?? Date.now(),
    media: { ...r.media_snapshot, kind: "manga" },
    anilistUpdatedAt: toMs(r.anilist_updated_at),
    syncedAt: toMs(r.synced_at),
  };
}

export function mangaEntryToRow(userId: string, e: MangaLibraryEntry) {
  return {
    user_id: userId,
    manga_id: e.mangaId,
    status: e.status,
    progress: e.progress,
    progress_volumes: e.progressVolumes,
    last_chapter_id: e.lastChapterId,
    last_chapter_label: e.lastChapterLabel,
    last_page: e.lastPage,
    score: e.score,
    favorite: e.favorite,
    started_at: e.startedAt,
    completed_at: e.completedAt,
    repeat: e.repeat,
    media_snapshot: e.media,
    anilist_updated_at: toIso(e.anilistUpdatedAt),
    synced_at: toIso(e.syncedAt),
    updated_at: new Date(e.updatedAt).toISOString(),
  };
}

export type MangaRemoteSnapshot = {
  entries: MangaLibraryEntry[];
  progress: ChapterProgress[];
  bookmarks: MangaBookmark[];
  collections: MangaCollection[];
  sessions: ReadingSession[];
};

export class MangaRemoteStore {
  constructor(
    private readonly db: SupabaseClient,
    readonly userId: string,
  ) {}

  private async must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return (data ?? ([] as unknown)) as T;
  }

  async loadAll(): Promise<MangaRemoteSnapshot> {
    const [rows, notes, progress, bookmarks, collections, sessions] = await Promise.all([
      this.must<EntryRow[]>(this.db.from("manga_library_entries").select("*").eq("user_id", this.userId)),
      this.db.from("library_notes").select("media_id, notes").eq("user_id", this.userId).then((r) => (r.data ?? []) as { media_id: number; notes: string }[]),
      this.must<{ manga_id: number; chapter_id: string; page: number; page_count: number; completed: boolean; updated_at: string }[]>(
        this.db.from("manga_reading_progress").select("*").eq("user_id", this.userId).order("updated_at", { ascending: false }).limit(500),
      ),
      this.must<{ id: string; manga_id: number; chapter_id: string; chapter_label: string; page: number; note: string; created_at: string }[]>(this.db.from("manga_bookmarks").select("*").eq("user_id", this.userId)),
      this.must<{ id: string; name: string; description: string; color: string; is_public: boolean; created_at: string; updated_at: string; manga_collection_items: { manga_id: number; position: number }[] }[]>(
        this.db.from("manga_collections").select("id, name, description, color, is_public, created_at, updated_at, manga_collection_items(manga_id, position)").eq("user_id", this.userId),
      ),
      this.must<{ id: string; manga_id: number; chapter_id: string; started_at: string; ended_at: string; active_seconds: number; pages_viewed: number }[]>(
        this.db.from("manga_reading_sessions").select("*").eq("user_id", this.userId).order("started_at", { ascending: false }).limit(500),
      ),
    ]);
    const noteMap = new Map(notes.map((n) => [n.media_id, n.notes]));
    return {
      entries: rows.map((r) => mangaRowToEntry(r, noteMap.get(r.manga_id) ?? "")),
      progress: progress.map((p) => ({ mangaId: p.manga_id, chapterId: p.chapter_id, page: p.page, pageCount: p.page_count, completed: p.completed, updatedAt: toMs(p.updated_at) ?? Date.now() })),
      bookmarks: bookmarks.map((b) => ({ id: b.id, mangaId: b.manga_id, chapterId: b.chapter_id, chapterLabel: b.chapter_label, page: b.page, note: b.note, createdAt: toMs(b.created_at) ?? Date.now() })),
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        color: c.color,
        isPublic: c.is_public,
        mangaIds: [...(c.manga_collection_items ?? [])].sort((a, b) => a.position - b.position).map((i) => i.manga_id),
        createdAt: toMs(c.created_at) ?? Date.now(),
        updatedAt: toMs(c.updated_at) ?? Date.now(),
      })),
      sessions: sessions.map((s) => ({ id: s.id, mangaId: s.manga_id, chapterId: s.chapter_id, startedAt: toMs(s.started_at) ?? 0, endedAt: toMs(s.ended_at) ?? 0, activeSeconds: s.active_seconds, pagesViewed: s.pages_viewed })),
    };
  }

  async upsertEntries(list: MangaLibraryEntry[]) {
    if (!list.length) return;
    await this.must(this.db.from("manga_library_entries").upsert(list.map((e) => mangaEntryToRow(this.userId, e)), { onConflict: "user_id,manga_id" }));
    const withNotes = list.filter((e) => e.notes);
    if (withNotes.length) await this.must(this.db.from("library_notes").upsert(withNotes.map((e) => ({ user_id: this.userId, media_id: e.mangaId, notes: e.notes, updated_at: new Date().toISOString() }))));
  }

  async deleteEntry(mangaId: number) {
    await this.must(this.db.from("manga_library_entries").delete().eq("user_id", this.userId).eq("manga_id", mangaId));
    await this.db.from("library_notes").delete().eq("user_id", this.userId).eq("media_id", mangaId);
  }

  async saveNotes(mangaId: number, notes: string) {
    await this.must(this.db.from("library_notes").upsert({ user_id: this.userId, media_id: mangaId, notes, updated_at: new Date().toISOString() }));
  }

  async saveProgress(list: ChapterProgress[]) {
    if (!list.length) return;
    await this.must(
      this.db.from("manga_reading_progress").upsert(
        list.map((p) => ({ user_id: this.userId, manga_id: p.mangaId, chapter_id: p.chapterId, page: p.page, page_count: p.pageCount, completed: p.completed, updated_at: new Date(p.updatedAt).toISOString() })),
        { onConflict: "user_id,manga_id,chapter_id" },
      ),
    );
  }

  async saveBookmark(b: MangaBookmark) {
    await this.must(this.db.from("manga_bookmarks").upsert({ id: b.id, user_id: this.userId, manga_id: b.mangaId, chapter_id: b.chapterId, chapter_label: b.chapterLabel, page: b.page, note: b.note, created_at: new Date(b.createdAt).toISOString() }));
  }

  async deleteBookmark(id: string) {
    await this.must(this.db.from("manga_bookmarks").delete().eq("id", id).eq("user_id", this.userId));
  }

  async saveSession(s: ReadingSession) {
    await this.must(
      this.db.from("manga_reading_sessions").upsert({ id: s.id, user_id: this.userId, manga_id: s.mangaId, chapter_id: s.chapterId, started_at: new Date(s.startedAt).toISOString(), ended_at: new Date(s.endedAt).toISOString(), active_seconds: Math.round(s.activeSeconds), pages_viewed: s.pagesViewed }),
    );
  }

  async saveCollection(c: MangaCollection, snapshots: Record<number, MangaSnapshot | undefined>) {
    await this.must(this.db.from("manga_collections").upsert({ id: c.id, user_id: this.userId, name: c.name, description: c.description, color: c.color, is_public: c.isPublic }));
    await this.must(this.db.from("manga_collection_items").delete().eq("collection_id", c.id));
    if (c.mangaIds.length) await this.must(this.db.from("manga_collection_items").insert(c.mangaIds.map((id, position) => ({ collection_id: c.id, manga_id: id, position, media_snapshot: snapshots[id] ?? {} }))));
  }

  async deleteCollection(id: string) {
    await this.must(this.db.from("manga_collections").delete().eq("id", id).eq("user_id", this.userId));
  }
}
