"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import type { MediaCard } from "@/lib/anilist/types";
import type { RemoteStore } from "@/lib/data/remote";
import { normalizeEntry, snapshotFromMedia, type Collection, type LibraryEntry, type LibraryStatus, type MediaSnapshot } from "@/lib/library/types";

export type EntryPatch = Partial<Pick<LibraryEntry, "status" | "progress" | "score" | "notes" | "favorite" | "startedAt" | "completedAt" | "repeat">>;

type LibraryState = {
  entries: Record<number, LibraryEntry>;
  collections: Record<string, Collection>;
  /** Owner scope of the persisted data: "guest" or a user id. */
  scope: string;
  remote: RemoteStore | null;
  hydrated: boolean;
  syncing: boolean;
  lastCompleted: { mediaId: number; at: number } | null;

  upsert: (media: MediaCard | { id: number; snapshot: MediaSnapshot }, patch: EntryPatch) => LibraryEntry;
  update: (mediaId: number, patch: EntryPatch) => void;
  remove: (mediaId: number) => void;
  bulkUpdate: (ids: number[], patch: EntryPatch) => void;
  bulkRemove: (ids: number[]) => void;
  importEntries: (list: LibraryEntry[], opts?: { overwrite?: boolean }) => number;

  createCollection: (input: { name: string; description?: string; color?: string; isPublic?: boolean }) => Collection;
  updateCollection: (id: string, patch: Partial<Pick<Collection, "name" | "description" | "color" | "isPublic" | "mediaIds">>) => void;
  deleteCollection: (id: string) => void;
  toggleInCollection: (id: string, mediaId: number) => void;

  attachRemote: (remote: RemoteStore | null, scope: string) => void;
  replaceAll: (entries: LibraryEntry[], collections: Collection[]) => void;
  clearCompletedSignal: () => void;
};

function remoteError(err: unknown) {
  console.warn("[kaze] library sync failed", err);
  toast.error("Couldn't save to your account", { description: "Your change is kept on this device and will retry on the next edit." });
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      entries: {},
      collections: {},
      scope: "guest",
      remote: null,
      hydrated: false,
      syncing: false,
      lastCompleted: null,

      upsert: (media, patch) => {
        const now = Date.now();
        const id = "snapshot" in media ? media.id : media.id;
        const snapshot = "snapshot" in media ? media.snapshot : snapshotFromMedia(media);
        const prev = get().entries[id];
        const base: LibraryEntry = prev
          ? { ...prev, media: { ...prev.media, ...snapshot } }
          : {
              mediaId: id,
              status: "PLANNING",
              progress: 0,
              score: null,
              notes: "",
              favorite: false,
              startedAt: null,
              completedAt: null,
              repeat: 0,
              createdAt: now,
              updatedAt: now,
              media: snapshot,
            };
        const next = normalizeEntry({ ...base, ...patch, updatedAt: now }, now);
        const justCompleted = next.status === "COMPLETED" && prev?.status !== "COMPLETED";
        set((s) => ({ entries: { ...s.entries, [id]: next }, lastCompleted: justCompleted ? { mediaId: id, at: now } : s.lastCompleted }));
        if (typeof window !== "undefined" && get().scope === "guest") {
          try {
            const list = Object.values({ ...get().entries, [id]: next });
            localStorage.setItem("kaze:library:guest", JSON.stringify({ entries: list }));
          } catch {}
        }
        const remote = get().remote;
        if (remote) {
          remote.upsertEntry(next).catch(remoteError);
          if (patch.notes !== undefined) remote.saveNotes(id, next.notes).catch(remoteError);
        }
        return next;
      },

      update: (mediaId, patch) => {
        const prev = get().entries[mediaId];
        if (!prev) return;
        get().upsert({ id: mediaId, snapshot: prev.media }, patch);
      },

      remove: (mediaId) => {
        const prev = get().entries[mediaId];
        if (!prev) return;
        set((s) => {
          const entries = { ...s.entries };
          delete entries[mediaId];
          return { entries };
        });
        get().remote?.deleteEntry(mediaId).catch(remoteError);
      },

      bulkUpdate: (ids, patch) => {
        const now = Date.now();
        const updated: LibraryEntry[] = [];
        set((s) => {
          const entries = { ...s.entries };
          for (const id of ids) {
            const prev = entries[id];
            if (!prev) continue;
            const next = normalizeEntry({ ...prev, ...patch, updatedAt: now }, now);
            entries[id] = next;
            updated.push(next);
          }
          return { entries };
        });
        get().remote?.upsertEntries(updated).catch(remoteError);
      },

      bulkRemove: (ids) => {
        set((s) => {
          const entries = { ...s.entries };
          for (const id of ids) delete entries[id];
          return { entries };
        });
        const remote = get().remote;
        if (remote) Promise.all(ids.map((id) => remote.deleteEntry(id))).catch(remoteError);
      },

      importEntries: (list, opts) => {
        const imported: LibraryEntry[] = [];
        set((s) => {
          const entries = { ...s.entries };
          for (const e of list) {
            const existing = entries[e.mediaId];
            if (existing && !opts?.overwrite && existing.updatedAt >= e.updatedAt) continue;
            entries[e.mediaId] = normalizeEntry(e);
            imported.push(entries[e.mediaId]);
          }
          return { entries };
        });
        get().remote?.upsertEntries(imported).catch(remoteError);
        return imported.length;
      },

      createCollection: ({ name, description = "", color = "#a855f7", isPublic = false }) => {
        const now = Date.now();
        const c: Collection = { id: uid(), name: name.trim().slice(0, 60), description: description.slice(0, 400), color, isPublic, mediaIds: [], createdAt: now, updatedAt: now };
        set((s) => ({ collections: { ...s.collections, [c.id]: c } }));
        get().remote?.saveCollection(c, {}).catch(remoteError);
        return c;
      },

      updateCollection: (id, patch) => {
        const prev = get().collections[id];
        if (!prev) return;
        const next = { ...prev, ...patch, updatedAt: Date.now() };
        set((s) => ({ collections: { ...s.collections, [id]: next } }));
        const snaps = Object.fromEntries(next.mediaIds.map((m) => [m, get().entries[m]?.media]));
        get().remote?.saveCollection(next, snaps).catch(remoteError);
      },

      deleteCollection: (id) => {
        set((s) => {
          const collections = { ...s.collections };
          delete collections[id];
          return { collections };
        });
        get().remote?.deleteCollection(id).catch(remoteError);
      },

      toggleInCollection: (id, mediaId) => {
        const c = get().collections[id];
        if (!c) return;
        const has = c.mediaIds.includes(mediaId);
        get().updateCollection(id, { mediaIds: has ? c.mediaIds.filter((m) => m !== mediaId) : [...c.mediaIds, mediaId] });
      },

      attachRemote: (remote, scope) => set({ remote, scope }),
      replaceAll: (entries, collections) => {
        if (entries.length === 0 && collections.length === 0 && Object.keys(get().entries).length > 0) {
          // Preserve local storage entries when remote returns empty
          return;
        }
        set({
          entries: Object.fromEntries(entries.map((e) => [e.mediaId, e])),
          collections: Object.fromEntries(collections.map((c) => [c.id, c])),
        });
      },
      clearCompletedSignal: () => set({ lastCompleted: null }),
    }),
    {
      name: "kaze:library",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ entries: s.entries, collections: s.collections, scope: s.scope }),
      onRehydrateStorage: () => () => {
        useLibrary.setState({ hydrated: true });
        if (typeof window !== "undefined" && Object.keys(useLibrary.getState().entries).length === 0) {
          try {
            const raw = localStorage.getItem("kaze:library:guest");
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.entries?.length) {
                useLibrary.getState().importEntries(parsed.entries);
              }
            }
          } catch {}
        }
      },
    },
  ),
);

export function entriesByStatus(entries: Record<number, LibraryEntry>, status: LibraryStatus | "FAVORITES") {
  const list = Object.values(entries);
  return status === "FAVORITES" ? list.filter((e) => e.favorite) : list.filter((e) => e.status === status);
}
