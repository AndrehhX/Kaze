"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RemoteStore } from "@/lib/data/remote";

export type WatchProgress = {
  seriesId: string;
  episodeId: string;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
  title: string | null;
  seriesTitle?: string | null;
  thumbnail?: string | null;
  episodeNumber?: number;
  isDemo?: boolean;
};

const key = (s: string, e: string) => `${s}::${e}`;
/** Treat the last 5% (or final 90s) as "finished" so credits do not block completion. */
export function isEffectivelyComplete(position: number, duration: number) {
  if (!duration) return false;
  return position >= duration - Math.min(90, duration * 0.05);
}

type ProgressState = {
  items: Record<string, WatchProgress>;
  remote: RemoteStore | null;
  hydrated: boolean;
  get: (seriesId: string, episodeId: string) => WatchProgress | undefined;
  save: (p: Omit<WatchProgress, "updatedAt" | "completed"> & { completed?: boolean }, opts?: { flush?: boolean }) => void;
  clear: (seriesId: string, episodeId: string) => void;
  setRemote: (r: RemoteStore | null) => void;
  mergeRemote: (list: WatchProgress[]) => void;
};

let pending: WatchProgress | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      items: {},
      remote: null,
      hydrated: false,
      get: (s, e) => get().items[key(s, e)],
      save: (p, opts) => {
        const completed = p.completed ?? isEffectivelyComplete(p.position, p.duration);
        const item: WatchProgress = { ...p, completed, updatedAt: Date.now() };
        set((st) => ({ items: { ...st.items, [key(p.seriesId, p.episodeId)]: item } }));
        const remote = get().remote;
        if (!remote) return;
        // Throttle network writes; flush immediately on pause/end/unload.
        pending = item;
        const flush = () => {
          const toSend = pending;
          pending = null;
          timer = null;
          if (toSend) remote.saveProgress(toSend).catch((err) => console.warn("[kaze] progress sync failed", err));
        };
        if (opts?.flush) {
          if (timer) clearTimeout(timer);
          flush();
        } else if (!timer) {
          timer = setTimeout(flush, 10_000);
        }
      },
      clear: (s, e) =>
        set((st) => {
          const items = { ...st.items };
          delete items[key(s, e)];
          return { items };
        }),
      setRemote: (remote) => set({ remote }),
      mergeRemote: (list) =>
        set((st) => {
          const items = { ...st.items };
          for (const r of list) {
            const k = key(r.seriesId, r.episodeId);
            const local = items[k];
            if (!local || r.updatedAt > local.updatedAt) items[k] = { ...r, title: local?.title ?? r.title };
          }
          return { items };
        }),
    }),
    {
      name: "kaze:progress",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => () => useProgress.setState({ hydrated: true }),
    },
  ),
);

export function recentProgress(items: Record<string, WatchProgress>, limit = 12) {
  return Object.values(items)
    .filter((p) => !p.completed && p.position > 5)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}
