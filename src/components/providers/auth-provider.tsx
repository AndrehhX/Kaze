"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { RemoteStore } from "@/lib/data/remote";
import { useAuth, type Profile } from "@/stores/auth";
import { useLibrary } from "@/stores/library";
import { useProgress } from "@/stores/progress";
import { useSettings, type MotionPref, type PlayerPrefs } from "@/stores/settings";
import { isThemeId } from "@/lib/themes";
import type { LibraryEntry } from "@/lib/library/types";
import { readGuestProfile } from "@/lib/profile/guest";

const GUEST_BACKUP_KEY = "kaze:library:guest";

function readGuestBackup(): { entries: LibraryEntry[] } {
  try {
    return JSON.parse(localStorage.getItem(GUEST_BACKUP_KEY) ?? '{"entries":[]}');
  } catch {
    return { entries: [] };
  }
}

/**
 * Owns the Supabase session lifecycle and swaps the persistence backend:
 * guest → device storage; signed in → Supabase (RLS-protected) with a local cache.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const setAuth = useAuth((s) => s.set);
  const libraryHydrated = useLibrary((s) => s.hydrated);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!libraryHydrated) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setAuth({ status: "unconfigured", user: null, profile: null });
      return;
    }

    let cancelled = false;

    async function activate(userId: string, email: string | null, emailConfirmed: boolean, metadata?: Record<string, any> | null) {
      if (currentUserId.current === userId) return;
      currentUserId.current = userId;
      const db = getSupabaseBrowser()!;
      const remote = new RemoteStore(db, userId);
      const lib = useLibrary.getState();

      // Keep a copy of guest data so the user can import it into their account.
      if (lib.scope === "guest" && Object.keys(lib.entries).length) {
        try {
          localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify({ entries: Object.values(lib.entries) }));
        } catch {}
      }

      setAuth({ status: "signed-in", user: { id: userId, email, emailConfirmed } });
      useLibrary.setState({ syncing: true });

      // 1. Cargar o aprovisionar el perfil de forma aislada e infalible
      let profileData: Profile | null = null;
      try {
        const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
        if (!error && data) {
          profileData = {
            ...(data as Profile),
            favorite_genres: Array.isArray(data.favorite_genres) ? data.favorite_genres : [],
            favorite_characters: Array.isArray(data.favorite_characters) ? data.favorite_characters : [],
            favorite_anime: Array.isArray(data.favorite_anime) ? data.favorite_anime : [],
          };
        }
      } catch (err) {
        console.warn("[kaze] could not fetch remote profile", err);
      }

      if (!profileData) {
        const metaUsername = metadata?.username || metadata?.preferred_username || metadata?.user_name;
        const metaDisplayName = metadata?.display_name || metadata?.full_name || metadata?.name || metaUsername;
        const metaAvatar = metadata?.avatar_url || metadata?.picture || metadata?.avatar || null;
        const baseName = (email ? email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") : "user") || "user";

        profileData = {
          id: userId,
          username: (metaUsername || baseName).slice(0, 24),
          display_name: (metaDisplayName || baseName).slice(0, 48),
          bio: "",
          avatar_url: metaAvatar,
          banner_url: null,
          profile_theme: "midnight",
          favorite_genres: [],
          favorite_anime: [],
          favorite_characters: [],
          visibility: "public",
          show_watch_history: true,
          show_favorites: true,
          show_activity: true,
          show_lists: true,
          show_online_status: true,
          created_at: new Date().toISOString(),
        };
        try {
          await db.from("profiles").upsert(profileData, { onConflict: "id" });
        } catch {}
      }

      if (cancelled) return;
      setAuth({ profile: profileData });

      // 2. Sincronizar datos secundarios sin bloquear al usuario
      try {
        const [entries, collections, progress, settings] = await Promise.all([
          remote.loadLibrary(),
          remote.loadCollections(),
          remote.loadProgress(),
          remote.loadSettings(),
        ]);
        if (cancelled) return;

        if (entries.length > 0 || collections.length > 0) {
          useLibrary.getState().replaceAll(entries, collections);
        } else {
          const localEntries = Object.values(useLibrary.getState().entries);
          if (localEntries.length > 0) {
            remote.upsertEntries(localEntries).catch(() => {});
          }
        }
        useLibrary.getState().attachRemote(remote, userId);
        useProgress.getState().setRemote(remote);
        if (progress.length > 0) {
          useProgress.getState().mergeRemote(progress);
        }
        if (settings) {
          useSettings.getState().applyRemote({
            theme: isThemeId(settings.theme) ? settings.theme : undefined,
            motion: settings.motion as MotionPref,
            ambientEffects: settings.ambient_effects,
            gamification: settings.gamification_enabled,
            player: settings.player as Partial<PlayerPrefs>,
            updatedAt: new Date(settings.updated_at).getTime(),
          });
        }
        const guest = readGuestBackup().entries.filter((g) => !entries.some((e) => e.mediaId === g.mediaId));
        if (guest.length) {
          toast(`${guest.length} título${guest.length > 1 ? "s" : ""} guardado${guest.length > 1 ? "s" : ""} en este dispositivo`, {
            description: "¿Importar a tu biblioteca en la nube?",
            duration: 15000,
            action: {
              label: "Importar",
              onClick: () => {
                const n = useLibrary.getState().importEntries(guest);
                localStorage.removeItem(GUEST_BACKUP_KEY);
                toast.success(`Importado${n === 1 ? "" : "s"} ${n} título${n === 1 ? "" : "s"}`);
              },
            },
          });
        }
      } catch (err) {
        console.warn("[kaze] remote sync partial fallback", err);
      } finally {
        useLibrary.setState({ syncing: false });
      }
    }

    function deactivate() {
      if (currentUserId.current === null && useAuth.getState().status === "signed-out") return;
      currentUserId.current = null;
      setAuth({ status: "signed-out", user: null, profile: null });
      useProgress.getState().setRemote(null);
      useLibrary.getState().attachRemote(null, "guest");
      // Preservar siempre la biblioteca e historial local del usuario en este dispositivo
    }

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user) activate(data.user.id, data.user.email ?? null, Boolean(data.user.email_confirmed_at), data.user.user_metadata);
      else deactivate();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) deactivate();
      else if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        activate(session.user.id, session.user.email ?? null, Boolean(session.user.email_confirmed_at), session.user.user_metadata);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [libraryHydrated, setAuth]);

  // Opt-in presence: last_seen_at is written only while the user shares online status.
  const shareOnline = useAuth((s) => s.profile?.show_online_status);
  const profileId = useAuth((s) => s.profile?.id);
  useEffect(() => {
    const db = getSupabaseBrowser();
    if (!db || !profileId || !shareOnline) return;
    const beat = () => db.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profileId).then(() => {});
    beat();
    const t = setInterval(beat, 4 * 60_000);
    return () => clearInterval(t);
  }, [profileId, shareOnline]);

  // Persist settings to the account (debounced) so themes follow the user across devices.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const unsub = useSettings.subscribe((s, prev) => {
      if (s.updatedAt === prev.updatedAt || !s.hydrated) return;
      const remote = useLibrary.getState().remote;
      if (!remote) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        remote
          .saveSettings({ theme: s.theme, motion: s.motion, ambientEffects: s.ambientEffects, gamification: s.gamification, player: s.player })
          .catch((err) => console.warn("[kaze] settings sync failed", err));
      }, 1200);
    });
    return () => {
      unsub();
      if (t) clearTimeout(t);
    };
  }, []);

  return children;
}

export async function refreshProfile() {
  const supabase = getSupabaseBrowser();
  const id = useAuth.getState().user?.id;
  if (!supabase || !id) return;
  try {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (data) {
      useAuth.getState().set({
        profile: {
          ...(data as Profile),
          favorite_genres: Array.isArray(data.favorite_genres) ? data.favorite_genres : [],
          favorite_characters: Array.isArray(data.favorite_characters) ? data.favorite_characters : [],
          favorite_anime: Array.isArray(data.favorite_anime) ? data.favorite_anime : [],
        },
      });
    }
  } catch {}
}
