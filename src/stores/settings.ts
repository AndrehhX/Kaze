"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES, type ThemeId } from "@/lib/themes";

export type SubtitleStyle = {
  size: "s" | "m" | "l" | "xl";
  color: "white" | "yellow" | "cyan";
  background: "none" | "shadow" | "box";
};

export type PlayerPrefs = {
  volume: number;
  muted: boolean;
  rate: number;
  autoNext: boolean;
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
  subtitleLang: string | null;
  subtitleStyle: SubtitleStyle;
  ambient: boolean;
  theater: boolean;
  showStats: boolean;
};

export type MotionPref = "system" | "reduce" | "full";

type SettingsState = {
  theme: ThemeId;
  motion: MotionPref;
  ambientEffects: boolean;
  gamification: boolean;
  player: PlayerPrefs;
  updatedAt: number;
  hydrated: boolean;
  setTheme: (t: ThemeId) => void;
  setMotion: (m: MotionPref) => void;
  setAmbientEffects: (v: boolean) => void;
  setGamification: (v: boolean) => void;
  setPlayer: (patch: Partial<PlayerPrefs>) => void;
  /** Apply settings fetched from the account (cross-device persistence). */
  applyRemote: (s: { theme?: ThemeId; motion?: MotionPref; ambientEffects?: boolean; gamification?: boolean; player?: Partial<PlayerPrefs>; updatedAt: number }) => void;
};

export const DEFAULT_PLAYER: PlayerPrefs = {
  volume: 0.9,
  muted: false,
  rate: 1,
  autoNext: true,
  autoSkipIntro: false,
  autoSkipOutro: false,
  subtitleLang: null,
  subtitleStyle: { size: "m", color: "white", background: "shadow" },
  ambient: true,
  theater: false,
  showStats: false,
};

function applyThemeToDocument(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const d = document.documentElement;
  d.dataset.theme = theme;
  d.style.colorScheme = THEMES[theme].scheme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

function applyMotionToDocument(motion: MotionPref) {
  if (typeof document === "undefined") return;
  const d = document.documentElement;
  if (motion === "system") delete d.dataset.motion;
  else d.dataset.motion = motion;
  try {
    localStorage.setItem("kaze:motion", motion);
  } catch {}
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      motion: "system",
      ambientEffects: true,
      gamification: true,
      player: DEFAULT_PLAYER,
      updatedAt: 0,
      hydrated: false,
      setTheme: (theme) => {
        applyThemeToDocument(theme);
        set({ theme, updatedAt: Date.now() });
      },
      setMotion: (motion) => {
        applyMotionToDocument(motion);
        set({ motion, updatedAt: Date.now() });
      },
      setAmbientEffects: (ambientEffects) => set({ ambientEffects, updatedAt: Date.now() }),
      setGamification: (gamification) => set({ gamification, updatedAt: Date.now() }),
      setPlayer: (patch) => set((s) => ({ player: { ...s.player, ...patch, subtitleStyle: { ...s.player.subtitleStyle, ...patch.subtitleStyle } }, updatedAt: Date.now() })),
      applyRemote: (r) =>
        set((s) => {
          if (r.updatedAt <= s.updatedAt) return s;
          if (r.theme) applyThemeToDocument(r.theme);
          if (r.motion) applyMotionToDocument(r.motion);
          return {
            theme: r.theme ?? s.theme,
            motion: r.motion ?? s.motion,
            ambientEffects: r.ambientEffects ?? s.ambientEffects,
            gamification: r.gamification ?? s.gamification,
            player: { ...s.player, ...r.player, subtitleStyle: { ...s.player.subtitleStyle, ...r.player?.subtitleStyle } },
            updatedAt: r.updatedAt,
          };
        }),
    }),
    {
      name: "kaze:settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // The boot script owns the theme key; keep the store in agreement with it.
        try {
          const t = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
          if (t && t in THEMES && t !== state.theme) state.theme = t;
        } catch {}
        state.player = { ...DEFAULT_PLAYER, ...state.player, subtitleStyle: { ...DEFAULT_PLAYER.subtitleStyle, ...state.player?.subtitleStyle } };
        useSettings.setState({ hydrated: true, theme: state.theme, player: state.player });
      },
    },
  ),
);
