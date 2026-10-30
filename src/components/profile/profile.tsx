"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "motion/react";
import {
  Award,
  Calendar,
  Camera,
  Footprints,
  Flag,
  Medal,
  Crown,
  Gauge,
  Compass,
  Map as MapIcon,
  Hourglass,
  PenLine,
  Popcorn,
  Lock,
  Share2,
  Edit3,
  Sparkles,
  Play,
  Globe,
  Tv,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { rowToEntry } from "@/lib/data/remote";
import { useAuth, type Profile } from "@/stores/auth";
import { useLibrary } from "@/stores/library";
import { useSettings } from "@/stores/settings";
import { computeDna, type Achievement } from "@/lib/dna";
import { useAchievements } from "./achievements";
import type { LibraryEntry } from "@/lib/library/types";
import { THEME_IDS, THEMES, isThemeId, type ThemeId } from "@/lib/themes";
import { Avatar } from "@/components/shell/user-menu";
import { EmptyState, SafeImage, Skeleton } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { FriendButton } from "@/components/social/friends";
import { ActivityList, useUserActivity } from "@/components/social/friends-activity";
import { ReportButton } from "@/components/social/report";
import { refreshProfile } from "@/components/providers/auth-provider";
import { friendlyDbError } from "@/lib/social";
import { useKazeMotion } from "@/lib/motion";
import { cn, formatNumber } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/env";
import { FALLBACK_GENRES } from "@/lib/anilist/browse-params";
import { useGuestProfile, writeGuestProfile, DEFAULT_GUEST_PROFILE } from "@/lib/profile/guest";

export type ProfileData = {
  profile: Profile | null;
  isMe: boolean;
  guest: boolean;
  entries: LibraryEntry[];
  listsHidden: boolean;
  loading: boolean;
  notFound: boolean;
};

export function normalizeProfile(p: Profile | null | undefined): Profile {
  if (!p) return DEFAULT_GUEST_PROFILE;
  return {
    ...DEFAULT_GUEST_PROFILE,
    ...p,
    favorite_genres: Array.isArray(p.favorite_genres) ? p.favorite_genres : [],
    favorite_characters: Array.isArray(p.favorite_characters) ? p.favorite_characters : [],
    favorite_anime: Array.isArray(p.favorite_anime) ? p.favorite_anime : [],
  };
}

export function useProfileData(username: string): ProfileData {
  const me = useAuth((s) => s.profile);
  const status = useAuth((s) => s.status);
  const localEntries = useLibrary((s) => s.entries);
  const hydrated = useLibrary((s) => s.hydrated);
  const [guestProfile] = useGuestProfile();
  const theme = useSettings((s) => s.theme);

  const isGuestRoute = username.toLowerCase() === "guest";
  const isMeAuth = Boolean(me && me.username.toLowerCase() === username.toLowerCase());
  const isMeGuest = isGuestRoute && status !== "signed-in";
  const isMe = isMeAuth || isMeGuest || (status !== "signed-in" && username.toLowerCase() === guestProfile.username.toLowerCase());

  const remote = useQuery({
    queryKey: ["profile", username],
    enabled: isSupabaseConfigured && !isMe && !isGuestRoute && status !== "loading",
    queryFn: async () => {
      const db = getSupabaseBrowser()!;
      const { data: profile, error } = await db.from("profiles").select("*").ilike("username", username).maybeSingle();
      if (error) throw error;
      if (!profile) return null;
      const { data: rows } = await db.from("anime_library_entries").select("*").eq("user_id", profile.id);
      return { profile: profile as Profile, entries: (rows ?? []).map((r) => rowToEntry(r)) };
    },
  });

  const localList = useMemo(() => Object.values(localEntries), [localEntries]);

  if (status === "loading") {
    return {
      profile: null,
      isMe: false,
      guest: false,
      entries: [],
      listsHidden: false,
      loading: true,
      notFound: false,
    };
  }

  if (isGuestRoute || (status !== "signed-in" && isMe)) {
    return {
      profile: normalizeProfile({ ...guestProfile, profile_theme: guestProfile.profile_theme || theme }),
      isMe: true,
      guest: true,
      entries: localList,
      listsHidden: false,
      loading: !hydrated,
      notFound: false,
    };
  }

  if (isMeAuth && me) {
    return {
      profile: normalizeProfile(me),
      isMe: true,
      guest: false,
      entries: localList,
      listsHidden: false,
      loading: !hydrated,
      notFound: false,
    };
  }

  if (!isSupabaseConfigured) {
    return {
      profile: null,
      isMe: false,
      guest: false,
      entries: [],
      listsHidden: false,
      loading: false,
      notFound: true,
    };
  }

  const p = remote.data?.profile ? normalizeProfile(remote.data.profile) : null;
  const remoteEntries = remote.data?.entries ?? [];
  return {
    profile: p,
    isMe: false,
    guest: false,
    entries: remoteEntries,
    listsHidden: Boolean(p && (!p.show_lists || (remoteEntries.length === 0 && p.visibility !== "public"))),
    loading: remote.isLoading,
    notFound: remote.isSuccess && !remote.data,
  };
}

const ICONS: Record<string, ReactNode> = {
  footprints: <Footprints className="size-5" />,
  flag: <Flag className="size-5" />,
  medal: <Medal className="size-5" />,
  crown: <Crown className="size-5" />,
  gauge: <Gauge className="size-5" />,
  compass: <Compass className="size-5" />,
  map: <MapIcon className="size-5" />,
  hourglass: <Hourglass className="size-5" />,
  pen: <PenLine className="size-5" />,
  popcorn: <Popcorn className="size-5" />,
  calendar: <Calendar className="size-5" />,
};

export function Badge({ a }: { a: Achievement }) {
  return (
    <li className={cn("k-card flex items-center gap-3 p-3", !a.earned && "opacity-55")} title={a.description}>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          a.earned ? "bg-gradient-to-br from-primary to-accent text-white" : "bg-[var(--k-btn-ghost)] text-muted",
        )}
      >
        {ICONS[a.icon] ?? <Award className="size-5" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{a.name}</span>
        <span className="block text-xs text-muted">{a.earned ? a.description : `${a.progress}/${a.target} · ${a.description}`}</span>
      </span>
    </li>
  );
}

/** Componente de cabecera y estructura del perfil */
export function ProfileShell({
  username,
  tab,
  children,
}: {
  username: string;
  tab: "overview" | "stats" | "lists";
  children: (d: ProfileData) => ReactNode;
}) {
  const d = useProfileData(username);
  const { reduced } = useKazeMotion();
  const { scrollY } = useScroll();
  const bannerY = useTransform(scrollY, [0, 400], [0, reduced ? 0 : 120]);
  const kanjiY = useTransform(scrollY, [0, 400], [0, reduced ? 0 : -60]);
  const [edit, setEdit] = useState(false);

  if (d.loading) return <Skeleton className="container-k mt-8 h-80" />;

  if (d.notFound || !d.profile)
    return (
      <div className="container-k pt-10">
        <EmptyState
          jp="無"
          title="No encontramos este universo"
          body={
            isSupabaseConfigured
              ? "Este perfil no existe, es privado o no está disponible."
              : "Los perfiles públicos requieren cuentas activas. Tu perfil en este dispositivo está en /profile/guest."
          }
          action={
            <Link href="/profile/guest" className="k-btn k-btn-outline k-btn-sm">
              Abrir mi perfil en este dispositivo
            </Link>
          }
        />
      </div>
    );

  const p = normalizeProfile(d.profile);
  const pTheme: ThemeId = isThemeId(p.profile_theme) ? p.profile_theme : "midnight";
  const favorites = d.entries.filter((e) => e.favorite);
  const name = p.display_name || p.username;
  const base = `/profile/${p.username}`;

  const share = async () => {
    const url = `${location.origin}${base}`;
    try {
      if (navigator.share) await navigator.share({ title: `${name} en Orunei`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace del perfil copiado");
      }
    } catch {}
  };

  return (
    <div data-theme={pTheme} className="bg-bg text-fg min-h-screen" style={{ colorScheme: THEMES[pTheme].scheme }}>
      <div className="relative -mt-[var(--k-nav-h)] overflow-hidden">
        {/* Banner con paralaje */}
        <motion.div style={{ y: bannerY }} className="absolute inset-0 h-[min(48svh,420px)] overflow-hidden" aria-hidden>
          {p.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.banner_url} alt="" className="size-full object-cover" />
          ) : favorites[0]?.media.banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={favorites[0].media.banner} alt="" className="size-full object-cover opacity-70" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,var(--k-primary),transparent_55%),radial-gradient(ellipse_at_90%_60%,var(--k-accent),transparent_50%)] opacity-60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
        </motion.div>

        {/* Botón flotante para cambiar portada en hover */}
        {d.isMe && (
          <button
            type="button"
            onClick={() => setEdit(true)}
            className="absolute right-4 top-24 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition-all hover:bg-black/80 hover:scale-105 shadow-md"
          >
            <Camera className="size-3.5" /> Cambiar portada
          </button>
        )}

        <motion.span
          style={{ y: kanjiY }}
          className="k-jp pointer-events-none absolute right-[4vw] top-24 select-none text-[clamp(6rem,18vw,14rem)] font-bold leading-none text-fg/10"
          lang="ja"
          aria-hidden
          initial={reduced ? false : { opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.1, delay: 0.2 }}
        >
          {THEMES[pTheme].jp.slice(0, 1)}
        </motion.span>

        <div className="container-k relative flex min-h-[min(48svh,420px)] flex-col justify-end pb-8 pt-[calc(var(--k-nav-h)+6rem)]">
          <div className="flex flex-wrap items-end gap-5">
            {/* Avatar interactivo */}
            <motion.div
              initial={reduced ? false : { scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.25 }}
              className="group relative rounded-full p-1 shadow-[var(--k-shadow-pop)] [background:linear-gradient(135deg,var(--k-primary),var(--k-accent))]"
            >
              <Avatar src={p.avatar_url} name={name} size={104} frame={p.avatar_frame} />
              {d.isMe && (
                <button
                  type="button"
                  onClick={() => setEdit(true)}
                  className="absolute inset-0 m-1 grid place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title="Cambiar avatar"
                >
                  <Camera className="size-6" />
                </button>
              )}
            </motion.div>

            <motion.div
              className="min-w-0 flex-1"
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
            >
              <h1 className="font-display text-title truncate">{name}</h1>
              <p className="mt-1 text-sm text-muted">
                @{p.username}
                {!d.guest && ` · universo desde ${new Date(p.created_at).getFullYear()}`} · {THEMES[pTheme].name}
              </p>
              {p.bio && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm text-fg/85">{p.bio}</p>}
            </motion.div>

            <motion.div
              className="flex flex-wrap items-center gap-2"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {d.isMe && (
                <Link href="/settings/profile" className="k-btn k-btn-outline k-btn-sm">
                  <Sparkles className="size-4 text-primary" aria-hidden /> Personalizar perfil
                </Link>
              )}
              {!d.isMe && <FriendButton target={{ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }} />}
              <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm" onClick={share} aria-label="Compartir perfil">
                <Share2 className="size-4" />
              </button>
              {!d.isMe && <ReportButton targetType="profile" targetId={p.id} />}
            </motion.div>
          </div>

          {(p.favorite_genres?.length ?? 0) > 0 && (
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Géneros favoritos">
              {p.favorite_genres?.map((g) => (
                <li key={g} className="k-chip text-xs">
                  {g}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <nav aria-label="Profile" className="container-k flex gap-1 border-b border-line">
        {(
          [
            ["overview", base, "Universo"],
            ["stats", `${base}/stats`, "ADN de Anime"],
            ["lists", `${base}/lists`, "Listas"],
          ] as const
        ).map(([k, href, label]) => (
          <Link
            key={k}
            href={href}
            aria-current={tab === k ? "page" : undefined}
            className={cn(
              "relative px-4 py-3 text-sm font-semibold text-muted hover:text-fg",
              tab === k && "text-fg after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-primary",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="container-k pb-16 pt-8">{children(d)}</div>
      {edit && <EditProfile profile={p} isGuest={d.guest} onClose={() => setEdit(false)} />}
    </div>
  );
}

/** Pestaña Principal del Perfil */
export function ProfileOverview({ d }: { d: ProfileData }) {
  const gamification = useSettings((s) => s.gamification);
  const activity = useUserActivity(d.guest || !isSupabaseConfigured ? undefined : d.profile?.id, 15);
  const { achievements } = useAchievements(d.entries, d.guest ? null : (d.profile?.id ?? null), d.isMe);
  const p = normalizeProfile(d.profile);
  const favorites = d.entries.filter((e) => e.favorite);
  const showcaseAnime = favorites[0] ?? null;
  const watching = d.entries.filter((e) => e.status === "CURRENT").slice(0, 8);
  const dna = useMemo(() => computeDna(d.entries), [d.entries]);
  const showAch = gamification || !d.isMe;

  if (d.listsHidden)
    return (
      <EmptyState
        icon={<Lock className="size-6" />}
        jp="秘"
        title="Este universo es privado"
        body="Las listas y actividad son visibles solo para personas elegidas por el usuario."
      />
    );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="space-y-12">
        {/* Estadísticas superiores */}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Títulos", dna.total],
            ["Completados", dna.completed],
            ["Episodios", formatNumber(dna.episodes)],
            ["Nota media", dna.meanScore ? `${dna.meanScore}%` : "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="k-card p-4">
              <dt className="k-label text-muted">{k}</dt>
              <dd className="font-display mt-1 text-3xl font-bold">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Vitrina de Obra Maestra (Showcase) */}
        {showcaseAnime && (
          <section aria-labelledby="showcase-h" className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-surface to-elevated p-6 shadow-xl">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="k-poster relative aspect-[2/3] w-36 shrink-0 shadow-lg rounded-xl overflow-hidden">
                <SafeImage src={showcaseAnime.media.cover ?? ""} alt={showcaseAnime.media.title} fill sizes="160px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="k-chip !bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="size-3 inline mr-1" /> Vitrina Destacada
                  </span>
                  {showcaseAnime.score && (
                    <span className="text-xs font-semibold text-accent">★ {showcaseAnime.score}/100</span>
                  )}
                </div>
                <h3 className="font-display text-2xl font-bold text-fg truncate">{showcaseAnime.media.title}</h3>
                <p className="line-clamp-2 text-sm text-muted">
                  {showcaseAnime.media.genres?.join(" · ") || "Anime favorito"}
                </p>
                <div className="pt-2">
                  <Link href={`/anime/${showcaseAnime.mediaId}`} className="k-btn k-btn-primary k-btn-sm gap-2">
                    <Play className="size-4" /> Ver anime
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Animes Favoritos */}
        <section aria-labelledby="fav-h">
          <h2 id="fav-h" className="font-display text-section mb-4">
            Animes favoritos ({favorites.length})
          </h2>
          {favorites.length ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {favorites.slice(0, 12).map((e, i) => (
                <li key={e.mediaId} style={{ rotate: `${((i % 3) - 1) * 1.5}deg` }} className="transition-transform hover:scale-105">
                  <Link href={`/anime/${e.mediaId}`} className="k-poster relative block aspect-[2/3] shadow-md rounded-lg overflow-hidden" title={e.media.title}>
                    <SafeImage src={e.media.cover ?? ""} alt={e.media.title} fill sizes="140px" className="object-cover" />
                  </Link>
                  <p className="mt-1 truncate text-xs text-center font-medium">{e.media.title}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="k-card p-6 text-center text-sm text-muted">
              Aún no tienes animes en favoritos. Marca con el corazón cualquier anime en el catálogo para agregarlo aquí.
            </div>
          )}
        </section>

        {/* Personajes Favoritos */}
        {(p.favorite_characters?.length ?? 0) > 0 && (
          <section aria-labelledby="chars-h">
            <h2 id="chars-h" className="font-display text-section mb-4">
              Personajes favoritos
            </h2>
            <ul className="flex flex-wrap gap-4">
              {p.favorite_characters?.slice(0, 12).map((c) => (
                <li key={c.id} className="w-20 text-center">
                  <div className="relative mx-auto size-20 overflow-hidden rounded-full bg-elevated ring-2 ring-line shadow-sm">
                    {c.image && <SafeImage src={c.image} alt="" fill sizes="80px" className="object-cover" />}
                  </div>
                  <p className="mt-1.5 truncate text-xs font-medium">{c.name}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Viendo ahora */}
        {watching.length > 0 && (
          <section aria-labelledby="watching-h">
            <h2 id="watching-h" className="font-display text-section mb-4">
              Viendo ahora
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {watching.map((e) => (
                <li key={e.mediaId}>
                  <Link href={`/anime/${e.mediaId}`} className="k-card flex items-center gap-3 p-2.5 transition-colors hover:border-primary">
                    <div className="k-poster relative aspect-[2/3] w-12 shrink-0 rounded overflow-hidden">
                      <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="48px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.media.title}</p>
                      <p className="text-xs text-muted">
                        Episodio {e.progress}/{e.media.episodes ?? "?"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Barra lateral */}
      <aside className="space-y-8">
        {showAch && (
          <section aria-labelledby="ach-h">
            <h2 id="ach-h" className="font-display text-lg mb-3">
              Insignias y Logros · {achievements.filter((a) => a.earned).length}/{achievements.length}
            </h2>
            <ul className="space-y-2">
              {[...achievements]
                .sort((a, b) => Number(b.earned) - Number(a.earned))
                .slice(0, 7)
                .map((a) => (
                  <Badge key={a.id} a={a} />
                ))}
            </ul>
          </section>
        )}

        {!d.guest && isSupabaseConfigured && (
          <section aria-labelledby="act-h">
            <h2 id="act-h" className="font-display text-lg mb-3">
              Actividad reciente
            </h2>
            <div className="k-card px-4">
              <ActivityList
                events={activity.data}
                isLoading={activity.isLoading}
                error={activity.error}
                empty={<p className="py-6 text-center text-sm text-muted">Sin actividad compartida aún.</p>}
              />
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

/** Modal de Edición de Perfil personalizado */
function EditProfile({
  profile,
  isGuest,
  onClose,
}: {
  profile: Profile;
  isGuest?: boolean;
  onClose: () => void;
}) {
  const [v, setV] = useState({
    display_name: profile.display_name || "",
    bio: profile.bio || "",
    profile_theme: profile.profile_theme || "midnight",
    favorite_genres: profile.favorite_genres ?? [],
    avatar_url: profile.avatar_url || "",
    banner_url: profile.banner_url || "",
  });
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");
  const [customBannerUrl, setCustomBannerUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const qc = useQueryClient();

  const handleFileUpload = async (kind: "avatar" | "banner", file: File) => {
    if (!["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"].includes(file.type)) {
      return toast.error("Usa una imagen PNG, JPEG, GIF o WebP");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("La imagen debe pesar 5 MB o menos");
    }

    setBusy(kind);

    // Si es modo invitado o local, convertimos a DataURL para persistencia directa
    if (isGuest) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setV((prev) => ({ ...prev, [kind === "avatar" ? "avatar_url" : "banner_url"]: dataUrl }));
        writeGuestProfile({ [kind === "avatar" ? "avatar_url" : "banner_url"]: dataUrl });
        setBusy(null);
        toast.success(kind === "avatar" ? "Avatar actualizado" : "Portada actualizada");
      };
      reader.onerror = () => {
        setBusy(null);
        toast.error("Error al leer la imagen");
      };
      reader.readAsDataURL(file);
      return;
    }

    // Si está autenticado, intentamos subir a Supabase Storage con fallback
    try {
      const db = getSupabaseBrowser();
      if (!db) throw new Error("No database");
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${profile.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await db.storage.from("profile-media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const url = db.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
      await db.from("profiles").update(kind === "avatar" ? { avatar_url: url } : { banner_url: url }).eq("id", profile.id);
      setV((prev) => ({ ...prev, [kind === "avatar" ? "avatar_url" : "banner_url"]: url }));
      await refreshProfile();
      setBusy(null);
      toast.success(kind === "avatar" ? "Avatar actualizado" : "Portada actualizada");
    } catch {
      // Fallback a DataURL
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setV((prev) => ({ ...prev, [kind === "avatar" ? "avatar_url" : "banner_url"]: dataUrl }));
        const db = getSupabaseBrowser();
        if (db) {
          try {
            await db.from("profiles").update(kind === "avatar" ? { avatar_url: dataUrl } : { banner_url: dataUrl }).eq("id", profile.id);
          } catch {}
        }
        await refreshProfile();
        setBusy(null);
        toast.success(kind === "avatar" ? "Avatar actualizado" : "Portada actualizada");
      };
      reader.readAsDataURL(file);
    }
  };

  const applyUrl = (kind: "avatar" | "banner", url: string) => {
    if (!url.trim()) return;
    const clean = url.trim();
    setV((prev) => ({ ...prev, [kind === "avatar" ? "avatar_url" : "banner_url"]: clean }));
    if (isGuest) {
      writeGuestProfile({ [kind === "avatar" ? "avatar_url" : "banner_url"]: clean });
    }
    toast.success(kind === "avatar" ? "URL de avatar aplicada" : "URL de portada aplicada");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("save");

    const patch = {
      display_name: v.display_name.trim().slice(0, 48),
      bio: v.bio.slice(0, 600),
      profile_theme: v.profile_theme,
      favorite_genres: (v.favorite_genres ?? []).slice(0, 10),
      avatar_url: v.avatar_url || null,
      banner_url: v.banner_url || null,
    };

    if (isGuest) {
      writeGuestProfile(patch);
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil personalizado guardado");
      onClose();
      router.refresh();
      return;
    }

    try {
      const db = getSupabaseBrowser();
      if (db) {
        const { error } = await db.from("profiles").update(patch).eq("id", profile.id);
        if (error) throw error;
      }
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil guardado con éxito");
      onClose();
      router.refresh();
    } catch (err: unknown) {
      setBusy(null);
      toast.error(friendlyDbError(err as { message?: string }));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Personalizar tu Universo de Orunei">
      <form onSubmit={save} className="space-y-6 px-6 pb-6 pt-3 max-h-[82vh] overflow-y-auto">
        {/* Previsualización rápida */}
        <div className="relative overflow-hidden rounded-xl border border-line p-4 bg-surface flex items-center gap-4">
          <Avatar src={v.avatar_url || profile.avatar_url} name={v.display_name || "U"} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{v.display_name || "Tu Nombre"}</p>
            <p className="truncate text-xs text-muted">@{profile.username} · {THEMES[v.profile_theme as ThemeId]?.name || "Tema"}</p>
          </div>
        </div>

        {/* Sección Avatar y Portada */}
        <div className="space-y-3">
          <label className="text-sm font-semibold block">Avatar y Portada</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="k-btn k-btn-outline k-btn-sm w-full cursor-pointer justify-center">
                <Camera className="size-4 mr-2" aria-hidden />
                {busy === "avatar" ? "Subiendo…" : "Subir Foto / GIF de Avatar"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload("avatar", e.target.files[0])}
                />
              </label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="O pega URL de imagen / GIF..."
                  className="k-input text-xs !py-1 flex-1"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                />
                <button
                  type="button"
                  className="k-btn k-btn-ghost k-btn-sm text-xs !px-2"
                  onClick={() => applyUrl("avatar", customAvatarUrl)}
                >
                  Ok
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="k-btn k-btn-outline k-btn-sm w-full cursor-pointer justify-center">
                <Camera className="size-4 mr-2" aria-hidden />
                {busy === "banner" ? "Subiendo…" : "Subir Portada / Banner GIF"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload("banner", e.target.files[0])}
                />
              </label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="O pega URL de portada..."
                  className="k-input text-xs !py-1 flex-1"
                  value={customBannerUrl}
                  onChange={(e) => setCustomBannerUrl(e.target.value)}
                />
                <button
                  type="button"
                  className="k-btn k-btn-ghost k-btn-sm text-xs !px-2"
                  onClick={() => applyUrl("banner", customBannerUrl)}
                >
                  Ok
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Nombre visible */}
        <div>
          <label htmlFor="pf-name" className="mb-1.5 block text-sm font-semibold">
            Nombre para mostrar
          </label>
          <input
            id="pf-name"
            className="k-input w-full"
            maxLength={48}
            value={v.display_name}
            onChange={(e) => setV({ ...v, display_name: e.target.value })}
            placeholder="Ej: Andreh, Senpai, etc."
          />
        </div>

        {/* Biografía */}
        <div>
          <label htmlFor="pf-bio" className="mb-1.5 block text-sm font-semibold">
            Biografía
          </label>
          <textarea
            id="pf-bio"
            rows={3}
            className="k-input w-full"
            maxLength={600}
            value={v.bio}
            onChange={(e) => setV({ ...v, bio: e.target.value })}
            placeholder="Escribe sobre ti o tus gustos de anime..."
          />
        </div>

        {/* Tema visual del perfil */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Tema visual de tu perfil</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {THEME_IDS.map((id) => (
              <button
                type="button"
                key={id}
                aria-pressed={v.profile_theme === id}
                onClick={() => setV({ ...v, profile_theme: id })}
                className={cn(
                  "k-card p-3 text-left transition-all",
                  v.profile_theme === id ? "ring-2 ring-primary border-primary bg-primary/10" : "hover:border-line",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{THEMES[id].name}</span>
                  <span className="k-jp text-xs opacity-60">{THEMES[id].jp}</span>
                </div>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Géneros Favoritos */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Géneros favoritos (hasta 10)</legend>
          <div className="flex flex-wrap gap-1.5">
            {FALLBACK_GENRES.map((g) => {
              const list = v.favorite_genres ?? [];
              const on = list.includes(g);
              return (
                <button
                  type="button"
                  key={g}
                  className={cn("k-chip text-xs transition-colors", on && "!bg-primary !text-white border-primary")}
                  aria-pressed={on}
                  onClick={() =>
                    setV({
                      ...v,
                      favorite_genres: on ? list.filter((x) => x !== g) : [...list, g].slice(0, 10),
                    })
                  }
                >
                  {g}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-2 pt-4 border-t border-line">
          <Link
            href="/settings/profile"
            onClick={onClose}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Sparkles className="size-3.5" /> Abrir panel completo de Orunei
          </Link>
          <div className="flex gap-2">
            <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={onClose}>
              Cancelar
            </button>
            <button className="k-btn k-btn-primary k-btn-sm" disabled={busy === "save"}>
              {busy === "save" ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
