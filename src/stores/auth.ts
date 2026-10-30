"use client";

import { create } from "zustand";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  profile_theme: string;
  favorite_genres: string[];
  favorite_anime: number[];
  favorite_characters: { id: number; name: string; image: string | null }[];
  visibility: "public" | "friends" | "private";
  show_watch_history: boolean;
  show_favorites: boolean;
  show_activity: boolean;
  show_lists: boolean;
  show_online_status: boolean;
  last_seen_at?: string | null;
  created_at: string;
};

export type AuthStatus = "loading" | "unconfigured" | "signed-out" | "signed-in";

type AuthState = {
  status: AuthStatus;
  user: { id: string; email: string | null; emailConfirmed: boolean } | null;
  profile: Profile | null;
  set: (s: Partial<Omit<AuthState, "set">>) => void;
};

export const useAuth = create<AuthState>()((set) => ({
  status: "loading",
  user: null,
  profile: null,
  set: (s) => set(s),
}));
