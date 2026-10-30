"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Device-local conveniences: recently viewed titles and recent searches. Never synced. */
export type RecentItem = { id: number; title: string; cover: string | null; color: string | null; at: number };

type LocalState = {
  recentlyViewed: RecentItem[];
  recentSearches: string[];
  savedSearches: { id: string; name: string; query: string; at: number }[];
  hydrated: boolean;
  pushViewed: (item: Omit<RecentItem, "at">) => void;
  clearViewed: () => void;
  pushSearch: (q: string) => void;
  clearSearches: () => void;
  saveSearch: (name: string, query: string) => void;
  removeSavedSearch: (id: string) => void;
};

export const useLocal = create<LocalState>()(
  persist(
    (set) => ({
      recentlyViewed: [],
      recentSearches: [],
      savedSearches: [],
      hydrated: false,
      pushViewed: (item) =>
        set((s) => ({ recentlyViewed: [{ ...item, at: Date.now() }, ...s.recentlyViewed.filter((r) => r.id !== item.id)].slice(0, 20) })),
      clearViewed: () => set({ recentlyViewed: [] }),
      pushSearch: (q) => {
        const t = q.trim();
        if (t.length < 2) return;
        set((s) => ({ recentSearches: [t, ...s.recentSearches.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 8) }));
      },
      clearSearches: () => set({ recentSearches: [] }),
      saveSearch: (name, query) =>
        set((s) => ({ savedSearches: [{ id: Math.random().toString(36).slice(2), name: name.slice(0, 40), query, at: Date.now() }, ...s.savedSearches].slice(0, 20) })),
      removeSavedSearch: (id) => set((s) => ({ savedSearches: s.savedSearches.filter((x) => x.id !== id) })),
    }),
    {
      name: "kaze:local",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => () => useLocal.setState({ hydrated: true }),
    },
  ),
);
