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
    try {
      const [{ data: rows, error }, { data: notes }] = await Promise.all([
        this.db.from("anime_library_entries").select("*").eq("user_id", this.userId),
        this.db.from("library_notes").select("media_id, notes").eq("user_id", this.userId),
      ]);
      if (!error && rows && rows.length > 0) {
        const noteMap = new Map((notes ?? []).map((n: { media_id: number; notes: string }) => [n.media_id, n.notes]));
        return (rows as EntryRow[]).map((r) => rowToEntry(r, noteMap.get(r.media_id) ?? ""));
      }

      // Fallback: Si no existe anime_library_entries, intentar profile_anime
      try {
        const { data: paRows, error: paErr } = await this.db.from("profile_anime").select("*").eq("user_id", this.userId);
        if (!paErr && paRows && paRows.length > 0) {
          return (paRows as any[]).map((r) => ({
            mediaId: Number(r.anime_id || r.media_id || r.id),
            status: (r.status?.toUpperCase?.() || "CURRENT") as LibraryStatus,
            progress: Number(r.episodes_watched || r.progress || 0),
            score: r.score ? Number(r.score) : null,
            notes: r.notes || "",
            favorite: Boolean(r.favorite || r.is_favorite),
            startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
            completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
            repeat: Number(r.repeat || 0),
            createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
            updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
            media: r.media_snapshot || r.media || {
              title: r.title || "Anime",
              titleNative: null,
              cover: r.cover_image || r.cover || null,
              banner: r.banner_image || r.banner || null,
              color: null,
              episodes: r.total_episodes || null,
              format: "TV",
              year: null,
              genres: [],
              averageScore: null,
              studio: null,
              duration: null,
            },
            anilistUpdatedAt: null,
            syncedAt: Date.now(),
          }));
        }
      } catch {}

      return [];
    } catch {
      return [];
    }
  }

  async upsertEntry(e: LibraryEntry) {
    try {
      const { error } = await this.db.from("anime_library_entries").upsert(entryToRow(this.userId, e), { onConflict: "user_id,media_id" });
      if (error) {
        try {
          await this.db.from("profile_anime").upsert(
            {
              user_id: this.userId,
              anime_id: e.mediaId,
              status: e.status,
              episodes_watched: e.progress,
              score: e.score,
              is_favorite: e.favorite,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,anime_id" }
          );
        } catch {}
      }
    } catch {}
  }

  async upsertEntries(list: LibraryEntry[]) {
    if (!list.length) return;
    try {
      const { error } = await this.db.from("anime_library_entries").upsert(
        list.map((e) => entryToRow(this.userId, e)),
        { onConflict: "user_id,media_id" },
      );
      if (error) {
        try {
          await this.db.from("profile_anime").upsert(
            list.map((e) => ({
              user_id: this.userId,
              anime_id: e.mediaId,
              status: e.status,
              episodes_watched: e.progress,
              score: e.score,
              is_favorite: e.favorite,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "user_id,anime_id" }
          );
        } catch {}
      }
      const withNotes = list.filter((e) => e.notes);
      if (withNotes.length) {
        await this.db
          .from("library_notes")
          .upsert(withNotes.map((e) => ({ user_id: this.userId, media_id: e.mediaId, notes: e.notes, updated_at: new Date().toISOString() })));
      }
    } catch {}
  }

  async deleteEntry(mediaId: number) {
    try {
      await this.db.from("anime_library_entries").delete().eq("user_id", this.userId).eq("media_id", mediaId);
      await this.db.from("library_notes").delete().eq("user_id", this.userId).eq("media_id", mediaId);
    } catch {}
  }

  async saveNotes(mediaId: number, notes: string) {
    try {
      await this.db
        .from("library_notes")
        .upsert({ user_id: this.userId, media_id: mediaId, notes, updated_at: new Date().toISOString() });
    } catch {}
  }

  async loadCollections(): Promise<Collection[]> {
    try {
      const { data, error } = await this.db
        .from("anime_collections")
        .select("id, name, description, color, is_public, created_at, updated_at, collection_items(media_id, position)")
        .eq("user_id", this.userId)
        .order("updated_at", { ascending: false });
      if (error || !data) return [];
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
        mediaIds: [...(c.collection_items ?? [])].sort((a, b) => a.position - b.position).map((i) => i.media_id),
        createdAt: toMs(c.created_at) ?? Date.now(),
        updatedAt: toMs(c.updated_at) ?? Date.now(),
      }));
    } catch {
      return [];
    }
  }

  async saveCollection(c: Collection, snapshots: Record<number, MediaSnapshot | undefined>) {
    try {
      const { error } = await this.db.from("anime_collections").upsert({
        id: c.id,
        user_id: this.userId,
        name: c.name,
        description: c.description,
        color: c.color,
        is_public: c.isPublic,
      });
      if (error) return;
      await this.db.from("collection_items").delete().eq("collection_id", c.id);
      if (c.mediaIds.length) {
        await this.db.from("collection_items").insert(
          c.mediaIds.map((id, position) => ({ collection_id: c.id, media_id: id, position, media_snapshot: snapshots[id] ?? {} })),
        );
      }
    } catch {}
  }

  async deleteCollection(id: string) {
    try {
      await this.db.from("anime_collections").delete().eq("id", id).eq("user_id", this.userId);
    } catch {}
  }

  async loadProgress(): Promise<WatchProgress[]> {
    try {
      const { data, error } = await this.db
        .from("watch_progress")
        .select("*")
        .eq("user_id", this.userId)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error || !data) return [];
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
    } catch {
      return [];
    }
  }

  async saveProgress(p: WatchProgress) {
    try {
      await this.db.from("watch_progress").upsert({
        user_id: this.userId,
        series_id: p.seriesId,
        episode_id: p.episodeId,
        position_seconds: Math.max(0, p.position),
        duration_seconds: Math.max(0, p.duration),
        completed: p.completed,
        updated_at: new Date(p.updatedAt).toISOString(),
      });
    } catch {}
  }

  async loadSettings() {
    try {
      const { data, error } = await this.db.from("user_settings").select("*").eq("user_id", this.userId).maybeSingle();
      if (error || !data) return null;
      return data as
        | { theme: string; motion: string; ambient_effects: boolean; gamification_enabled: boolean; player: Record<string, unknown>; updated_at: string }
        | null;
    } catch {
      return null;
    }
  }

  async saveSettings(s: { theme: string; motion: string; ambientEffects: boolean; gamification: boolean; player: unknown }) {
    try {
      await this.db.from("user_settings").upsert({
        user_id: this.userId,
        theme: s.theme,
        motion: s.motion,
        ambient_effects: s.ambientEffects,
        gamification_enabled: s.gamification,
        player: s.player,
      });
    } catch {}
  }
}
