import { useEffect, useState } from "react";
import type { Profile } from "@/stores/auth";

export const GUEST_PROFILE_STORAGE_KEY = "kaze:profile:guest";

export const DEFAULT_GUEST_PROFILE: Profile = {
  id: "guest",
  username: "guest",
  display_name: "Invitado",
  bio: "Personaliza tu universo, añade series favoritas y haz tuyo este espacio.",
  avatar_url: null,
  banner_url: null,
  avatar_frame: null,
  custom_accent: null,
  profile_theme: "midnight",
  favorite_genres: ["Action", "Fantasy", "Sci-Fi"],
  favorite_anime: [],
  favorite_characters: [],
  visibility: "public",
  show_watch_history: true,
  show_favorites: true,
  show_activity: true,
  show_lists: true,
  show_online_status: true,
  created_at: new Date(0).toISOString(),
};

export function readGuestProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT_GUEST_PROFILE;
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_GUEST_PROFILE;
    const parsed = JSON.parse(raw);
    if (parsed.display_name === "Otaku Viajero") parsed.display_name = "Invitado";
    return { ...DEFAULT_GUEST_PROFILE, ...parsed };
  } catch {
    return DEFAULT_GUEST_PROFILE;
  }
}

export function writeGuestProfile(patch: Partial<Profile>): Profile {
  if (typeof window === "undefined") return DEFAULT_GUEST_PROFILE;
  const current = readGuestProfile();
  const updated: Profile = {
    ...current,
    ...patch,
    id: "guest",
    username: patch.username?.trim() ? patch.username.trim() : current.username,
  };
  try {
    localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("kaze:guest-profile-changed", { detail: updated }));
  } catch (err) {
    console.warn("[kaze] failed to write guest profile", err);
  }
  return updated;
}

export function useGuestProfile(): [Profile, (patch: Partial<Profile>) => Profile] {
  const [profile, setProfile] = useState<Profile>(readGuestProfile);

  useEffect(() => {
    setProfile(readGuestProfile());
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<Profile>).detail;
      if (detail) setProfile(detail);
      else setProfile(readGuestProfile());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === GUEST_PROFILE_STORAGE_KEY) {
        setProfile(readGuestProfile());
      }
    };
    window.addEventListener("kaze:guest-profile-changed", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("kaze:guest-profile-changed", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [profile, writeGuestProfile];
}
