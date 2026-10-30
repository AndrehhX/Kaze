"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, LibraryEntry, LibraryStatus, MediaSnapshot } from "@/lib/library/types";
import type { WatchProgress } from "@/stores/progress";

/**
 * Supabase persistence for signed-in users. Every call runs with the user's
 * JWT, so Row Level Security is the authority — the client never decides access.
 */

type EntryRow = {
  user_id: string;
  media_id: number;
  status: LibraryStatus;
  progress: number;
  score: number | null;
  favorite: boolean;
  started_at: string | null;
  completed_at: string | null;
  repeat: number;
  media_snapshot: MediaSnapshot;
  anilist_updated_at: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

const toMs = (s: string | null | undefined) => (s ? new Date(s).getTime() : null);
const toIso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);

export function rowToEntry(r: EntryRow, notes = ""): LibraryEntry {
  return {
    mediaId: r.media_id,
    status: r.status,
    progress: r.progress,
    score: r.score,
    notes,
    favorite: r.favorite,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    repeat: r.repeat,
    createdAt: toMs(r.created_at) ?? Date.now(),
    updatedAt: toMs(r.updated_at) ?? Date.now(),
    media: r.media_snapshot,
    anilistUpdatedAt: toMs(r.anilist_updated_at),
    syncedAt: toMs(r.synced_at),
  };
}

export function entryToRow(userId: string, e: LibraryEntry) {
  return {
    user_id: userId,
    media_id: e.mediaId,
    status: e.status,
    progress: e.progress,
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

export class RemoteStore {
  constructor(
    private readonly db: SupabaseClient,
    readonly userId: string,
  ) {}

  async loadLibrary(): Promise<LibraryEntry[]> {
    const [{ data: rows, error }, { data: notes, error: nErr }] = await Promise.all([
      this.db.from("anime_library_entries").select("*").eq("user_id", this.userId),
      this.db.from("library_notes").select("media_id, notes").eq("user_id", this.userId),
    ]);
    if (error) throw error;
    if (nErr) throw nErr;
    const noteMap = new Map((notes ?? []).map((n: { media_id: number; notes: string }) => [n.media_id, n.notes]));
    return (rows as EntryRow[]).map((r) => rowToEntry(r, noteMap.get(r.media_id) ?? ""));
  }

  async upsertEntry(e: LibraryEntry) {
    const { error } = await this.db.from("anime_library_entries").upsert(entryToRow(this.userId, e), { onConflict: "user_id,media_id" });
    if (error) throw error;
  }

  async upsertEntries(list: LibraryEntry[]) {
    if (!list.length) return;
    const { error } = await this.db.from("anime_library_entries").upsert(
      list.map((e) => entryToRow(this.userId, e)),
      { onConflict: "user_id,media_id" },
    );
    if (error) throw error;
    const withNotes = list.filter((e) => e.notes);
    if (withNotes.length) {
      const { error: nErr } = await this.db
        .from("library_notes")
        .upsert(withNotes.map((e) => ({ user_id: this.userId, media_id: e.mediaId, notes: e.notes, updated_at: new Date().toISOString() })));
      if (nErr) throw nErr;
    }
  }

  async deleteEntry(mediaId: number) {
    const { error } = await this.db.from("anime_library_entries").delete().eq("user_id", this.userId).eq("media_id", mediaId);
    if (error) throw error;
    await this.db.from("library_notes").delete().eq("user_id", this.userId).eq("media_id", mediaId);
  }

  async saveNotes(mediaId: number, notes: string) {
    const { error } = await this.db
      .from("library_notes")
      .upsert({ user_id: this.userId, media_id: mediaId, notes, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  async loadCollections(): Promise<Collection[]> {
    const { data, error } = await this.db
      .from("anime_collections")
      .select("id, name, description, color, is_public, created_at, updated_at, collection_items(media_id, position)")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    type Row = {
      id: string;
      name: string;
      description: string;
      color: string;
      is_public: boolean;
      created_at: string;
      updated_at: string;
      collection_items: { media_id: number; position: number }[];
    };
    return (data as Row[]).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      color: c.color,
      isPublic: c.is_public,
      mediaIds: [...c.collection_items].sort((a, b) => a.position - b.position).map((i) => i.media_id),
      createdAt: toMs(c.created_at) ?? Date.now(),
      updatedAt: toMs(c.updated_at) ?? Date.now(),
    }));
  }

  async saveCollection(c: Collection, snapshots: Record<number, MediaSnapshot | undefined>) {
    const { error } = await this.db.from("anime_collections").upsert({
      id: c.id,
      user_id: this.userId,
      name: c.name,
      description: c.description,
      color: c.color,
      is_public: c.isPublic,
    });
    if (error) throw error;
    const { error: delErr } = await this.db.from("collection_items").delete().eq("collection_id", c.id);
    if (delErr) throw delErr;
    if (c.mediaIds.length) {
      const { error: insErr } = await this.db.from("collection_items").insert(
        c.mediaIds.map((id, position) => ({ collection_id: c.id, media_id: id, position, media_snapshot: snapshots[id] ?? {} })),
      );
      if (insErr) throw insErr;
    }
  }

  async deleteCollection(id: string) {
    const { error } = await this.db.from("anime_collections").delete().eq("id", id).eq("user_id", this.userId);
    if (error) throw error;
  }

  async loadProgress(): Promise<WatchProgress[]> {
    const { data, error } = await this.db
      .from("watch_progress")
      .select("*")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map(
      (r: { series_id: string; episode_id: string; position_seconds: number; duration_seconds: number; completed: boolean; updated_at: string }) => ({
        seriesId: r.series_id,
        episodeId: r.episode_id,
        position: r.position_seconds,
        duration: r.duration_seconds,
        completed: r.completed,
        updatedAt: toMs(r.updated_at) ?? Date.now(),
        title: null,
      }),
    );
  }

  async saveProgress(p: WatchProgress) {
    const { error } = await this.db.from("watch_progress").upsert({
      user_id: this.userId,
      series_id: p.seriesId,
      episode_id: p.episodeId,
      position_seconds: Math.max(0, p.position),
      duration_seconds: Math.max(0, p.duration),
      completed: p.completed,
      updated_at: new Date(p.updatedAt).toISOString(),
    });
    if (error) throw error;
  }

  async loadSettings() {
    const { data, error } = await this.db.from("user_settings").select("*").eq("user_id", this.userId).maybeSingle();
    if (error) throw error;
    return data as
      | { theme: string; motion: string; ambient_effects: boolean; gamification_enabled: boolean; player: Record<string, unknown>; updated_at: string }
      | null;
  }

  async saveSettings(s: { theme: string; motion: string; ambientEffects: boolean; gamification: boolean; player: unknown }) {
    const { error } = await this.db.from("user_settings").upsert({
      user_id: this.userId,
      theme: s.theme,
      motion: s.motion,
      ambient_effects: s.ambientEffects,
      gamification_enabled: s.gamification,
      player: s.player,
    });
    if (error) throw error;
  }
}
