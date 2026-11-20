"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import type { MangaCard } from "@/lib/anilist/manga-types";
import type { MangaRemoteStore } from "@/lib/data/manga-remote";
import { parseChapterNumber } from "@/lib/manga/catalog";
import { newMangaEntry, normalizeMangaEntry, snapshotFromManga, type ChapterProgress, type MangaBookmark, type MangaCollection, type MangaLibraryEntry, type MangaSnapshot, type ReadingSession } from "@/lib/manga/types";

export type MangaEntryPatch = Partial<Pick<MangaLibraryEntry, "status" | "progress" | "progressVolumes" | "score" | "notes" | "favorite" | "startedAt" | "completedAt" | "repeat" | "lastChapterId" | "lastChapterLabel" | "lastPage">>;

type RemoteState = "local" | "syncing" | "synced" | "unavailable";

type MangaLibraryState = {
  entries: Record<number, MangaLibraryEntry>;
  collections: Record<string, MangaCollection>;
  chapterProgress: Record<string, ChapterProgress>;
  bookmarks: Record<string, MangaBookmark>;
  sessions: ReadingSession[];
  /** Manga ids the user opened from "Continue the story". */
  continued: number[];
  scope: string;
  remote: MangaRemoteStore | null;
  remoteState: RemoteState;
  hydrated: boolean;

  upsert: (media: MangaCard | { id: number; snapshot: MangaSnapshot }, patch: MangaEntryPatch) => MangaLibraryEntry;
  update: (mangaId: number, patch: MangaEntryPatch) => void;
  remove: (mangaId: number) => void;
  importEntries: (list: MangaLibraryEntry[], opts?: { overwrite?: boolean }) => number;
  recordChapterProgress: (input: { mangaId: number; snapshot: MangaSnapshot; chapterId: string; chapterLabel: string; chapterNumber: string | null; regular: boolean; page: number; pageCount: number }, opts?: { flush?: boolean }) => void;
  addBookmark: (b: Omit<MangaBookmark, "id" | "createdAt">) => MangaBookmark;
  removeBookmark: (id: string) => void;
  recordSession: (s: Omit<ReadingSession, "id">) => void;
  markContinued: (mangaId: number) => void;

  createCollection: (input: { name: string; description?: string; color?: string; isPublic?: boolean }) => MangaCollection;
  updateCollection: (id: string, patch: Partial<Pick<MangaCollection, "name" | "description" | "color" | "isPublic" | "mangaIds">>) => void;
  deleteCollection: (id: string) => void;
  toggleInCollection: (id: string, mangaId: number) => void;

  connect: (remote: MangaRemoteStore, scope: string) => Promise<void>;
  disconnect: () => void;
};

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
export const progressKey = (mangaId: number, chapterId: string) => `${mangaId}::${chapterId}`;

let warned = false;
function remoteError(err: unknown) {
  console.warn("[kaze] manga sync failed", err);
  if (warned) return;
  warned = true;
  toast.error("No se pudo guardar tu manga en la cuenta", { description: "Se conserva en este dispositivo y se reintentará con el próximo cambio." });
}

let pendingProgress = new Map<string, ChapterProgress>();
let progressTimer: ReturnType<typeof setTimeout> | null = null;

function newer<T extends { updatedAt: number }>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

export const useMangaLibrary = create<MangaLibraryState>()(
  persist(
    (set, get) => {
      const live = () => {
        const s = get();
        return s.remoteState === "synced" ? s.remote : null;
      };
      return {
        entries: {},
        collections: {},
        chapterProgress: {},
        bookmarks: {},
        sessions: [],
        continued: [],
        scope: "guest",
        remote: null,
        remoteState: "local",
        hydrated: false,

        upsert: (media, patch) => {
          const now = Date.now();
          const id = media.id;
          const snapshot = "snapshot" in media ? media.snapshot : snapshotFromManga(media);
          const prev = get().entries[id];
          const base = prev ? { ...prev, media: { ...prev.media, ...snapshot } } : newMangaEntry(id, snapshot, now);
          const next = normalizeMangaEntry({ ...base, ...patch, updatedAt: now }, now);
          set((s) => ({ entries: { ...s.entries, [id]: next } }));
          const r = live();
          if (r) {
            r.upsertEntries([next]).catch(remoteError);
            if (patch.notes !== undefined) r.saveNotes(id, next.notes).catch(remoteError);
          }
          return next;
        },

        update: (mangaId, patch) => {
          const prev = get().entries[mangaId];
          if (prev) get().upsert({ id: mangaId, snapshot: prev.media }, patch);
        },

        remove: (mangaId) => {
          if (!get().entries[mangaId]) return;
          set((s) => {
            const entries = { ...s.entries };
            delete entries[mangaId];
            return { entries };
          });
          live()?.deleteEntry(mangaId).catch(remoteError);
        },

        importEntries: (list, opts) => {
          const imported: MangaLibraryEntry[] = [];
          set((s) => {
            const entries = { ...s.entries };
            for (const e of list) {
              if (!e || typeof e.mangaId !== "number" || !e.media) continue;
              const existing = entries[e.mangaId];
              if (existing && !opts?.overwrite && existing.updatedAt >= e.updatedAt) continue;
              entries[e.mangaId] = normalizeMangaEntry({ ...newMangaEntry(e.mangaId, { ...e.media, kind: "manga" }), ...e });
              imported.push(entries[e.mangaId]);
            }
            return { entries };
          });
          live()?.upsertEntries(imported).catch(remoteError);
          return imported.length;
        },

        recordChapterProgress: (input, opts) => {
          const now = Date.now();
          const key = progressKey(input.mangaId, input.chapterId);
          const prevP = get().chapterProgress[key];
          const completed = Boolean(prevP?.completed) || (input.pageCount > 0 && input.page >= input.pageCount - 1);
          const p: ChapterProgress = { mangaId: input.mangaId, chapterId: input.chapterId, page: input.page, pageCount: input.pageCount, completed, updatedAt: now };
          set((s) => ({ chapterProgress: { ...s.chapterProgress, [key]: p } }));

          // Reflect into the library entry: resume point always; chapter count only for whole regular chapters.
          const entry = get().entries[input.mangaId];
          const n = parseChapterNumber(input.chapterNumber);
          const countable = completed && input.regular && n != null && Number.isInteger(n);
          const patch: MangaEntryPatch = { lastChapterId: input.chapterId, lastChapterLabel: input.chapterLabel, lastPage: input.page };
          if (countable) patch.progress = Math.max(entry?.progress ?? 0, n);
          if (!entry || entry.status === "PLANNING" || entry.status === "PAUSED") patch.status = "CURRENT";
          const needsEntryWrite = !entry || entry.lastChapterId !== input.chapterId || entry.lastPage !== input.page || (patch.progress ?? entry.progress) !== entry.progress || patch.status;
          if (needsEntryWrite) {
            // Entry rows are cheap but not free: only push to the account when something meaningful changed.
            const meaningful = !entry || patch.status || (patch.progress ?? entry.progress) !== entry.progress || entry.lastChapterId !== input.chapterId || opts?.flush;
            const next = normalizeMangaEntry({ ...(entry ?? newMangaEntry(input.mangaId, input.snapshot, now)), media: { ...(entry?.media ?? input.snapshot) }, ...patch, updatedAt: now }, now);
            set((s) => ({ entries: { ...s.entries, [input.mangaId]: next } }));
            if (meaningful) live()?.upsertEntries([next]).catch(remoteError);
          }

          const r = live();
          if (!r) return;
          pendingProgress.set(key, p);
          const flush = () => {
            const batch = [...pendingProgress.values()];
            pendingProgress = new Map();
            progressTimer = null;
            if (batch.length) r.saveProgress(batch).catch(remoteError);
          };
          if (opts?.flush) {
            if (progressTimer) clearTimeout(progressTimer);
            flush();
          } else if (!progressTimer) progressTimer = setTimeout(flush, 8000);
        },

        addBookmark: (b) => {
          const bm: MangaBookmark = { ...b, id: uid(), createdAt: Date.now() };
          set((s) => ({ bookmarks: { ...s.bookmarks, [bm.id]: bm } }));
          live()?.saveBookmark(bm).catch(remoteError);
          return bm;
        },

        removeBookmark: (id) => {
          set((s) => {
            const bookmarks = { ...s.bookmarks };
            delete bookmarks[id];
            return { bookmarks };
          });
          live()?.deleteBookmark(id).catch(remoteError);
        },

        recordSession: (s) => {
          if (s.activeSeconds < 5 && s.pagesViewed < 1) return;
          const session: ReadingSession = { ...s, id: uid(), activeSeconds: Math.round(s.activeSeconds) };
          set((st) => ({ sessions: [session, ...st.sessions].slice(0, 400) }));
          live()?.saveSession(session).catch(remoteError);
        },

        markContinued: (mangaId) => set((s) => ({ continued: [...new Set([...s.continued, mangaId])].slice(-200) })),

        createCollection: ({ name, description = "", color = "#e96b35", isPublic = false }) => {
          const now = Date.now();
          const c: MangaCollection = { id: uid(), name: name.trim().slice(0, 60) || "Colección", description: description.slice(0, 400), color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#e96b35", isPublic, mangaIds: [], createdAt: now, updatedAt: now };
          set((s) => ({ collections: { ...s.collections, [c.id]: c } }));
          live()?.saveCollection(c, {}).catch(remoteError);
          return c;
        },

        updateCollection: (id, patch) => {
          const prev = get().collections[id];
          if (!prev) return;
          const next = { ...prev, ...patch, updatedAt: Date.now() };
          set((s) => ({ collections: { ...s.collections, [id]: next } }));
          live()?.saveCollection(next, Object.fromEntries(next.mangaIds.map((m) => [m, get().entries[m]?.media]))).catch(remoteError);
        },

        deleteCollection: (id) => {
          set((s) => {
            const collections = { ...s.collections };
            delete collections[id];
            return { collections };
          });
          live()?.deleteCollection(id).catch(remoteError);
        },

        toggleInCollection: (id, mangaId) => {
          const c = get().collections[id];
          if (!c) return;
          get().updateCollection(id, { mangaIds: c.mangaIds.includes(mangaId) ? c.mangaIds.filter((m) => m !== mangaId) : [...c.mangaIds, mangaId] });
        },

        connect: async (remote, scope) => {
          set({ remote, scope, remoteState: "syncing" });
          try {
            const snap = await remote.loadAll();
            const s = get();
            // Union by id, newest wins; anything that only exists locally is uploaded so nothing is lost.
            const entries: Record<number, MangaLibraryEntry> = { ...s.entries };
            const toPush: MangaLibraryEntry[] = [];
            const remoteIds = new Set(snap.entries.map((e) => e.mangaId));
            for (const r of snap.entries) entries[r.mangaId] = newer(entries[r.mangaId], r)!;
            for (const l of Object.values(s.entries)) {
              const r = snap.entries.find((x) => x.mangaId === l.mangaId);
              if (!remoteIds.has(l.mangaId) || (r && l.updatedAt > r.updatedAt)) toPush.push(l);
            }
            const chapterProgress = { ...s.chapterProgress };
            for (const p of snap.progress) chapterProgress[progressKey(p.mangaId, p.chapterId)] = newer(chapterProgress[progressKey(p.mangaId, p.chapterId)], p)!;
            const bookmarks = { ...s.bookmarks, ...Object.fromEntries(snap.bookmarks.map((b) => [b.id, b])) };
            const collections = { ...s.collections };
            for (const c of snap.collections) collections[c.id] = newer(collections[c.id], c)!;
            const sessionIds = new Set(s.sessions.map((x) => x.id));
            const sessions = [...s.sessions, ...snap.sessions.filter((x) => !sessionIds.has(x.id))].sort((a, b) => b.startedAt - a.startedAt).slice(0, 400);
            set({ entries, chapterProgress, bookmarks, collections, sessions, remoteState: "synced" });
            if (toPush.length) await remote.upsertEntries(toPush);
          } catch (err) {
            // Tables missing or offline: keep working on this device, say so once in the console.
            console.info("[kaze] manga cloud sync unavailable, using device storage", (err as Error).message);
            set({ remoteState: "unavailable" });
          }
        },

        disconnect: () => set({ remote: null, scope: "guest", remoteState: "local" }),
      };
    },
    {
      name: "kaze:manga",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ entries: s.entries, collections: s.collections, chapterProgress: s.chapterProgress, bookmarks: s.bookmarks, sessions: s.sessions, continued: s.continued, scope: s.scope }),
      onRehydrateStorage: () => () => useMangaLibrary.setState({ hydrated: true }),
    },
  ),
);

export function mangaEntriesByStatus(entries: Record<number, MangaLibraryEntry>, status: MangaLibraryEntry["status"] | "FAVORITES" | "ALL") {
  const list = Object.values(entries);
  if (status === "ALL") return list;
  return status === "FAVORITES" ? list.filter((e) => e.favorite) : list.filter((e) => e.status === status);
}

/** Most recent resume points, newest first. */
export function continueReading(entries: Record<number, MangaLibraryEntry>, limit = 12) {
  return Object.values(entries)
    .filter((e) => e.lastChapterId && (e.status === "CURRENT" || e.status === "REPEATING"))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}
