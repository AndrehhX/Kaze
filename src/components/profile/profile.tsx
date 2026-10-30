"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "motion/react";
import { Award, Calendar, Camera, Footprints, Flag, Medal, Crown, Gauge, Compass, Map as MapIcon, Hourglass, PenLine, Popcorn, Lock, Share2, Edit3 } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { rowToEntry } from "@/lib/data/remote";
import { useAuth, type Profile } from "@/stores/auth";
import { useLibrary } from "@/stores/library";
import { useSettings } from "@/stores/settings";
import { computeAchievements, computeDna, type Achievement } from "@/lib/dna";
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

export type ProfileData = {
  profile: Profile | null;
  isMe: boolean;
  guest: boolean;
  entries: LibraryEntry[];
  listsHidden: boolean;
  loading: boolean;
  notFound: boolean;
};

const GUEST: Profile = {
  id: "guest",
  username: "guest",
  display_name: "Guest on this device",
  bio: "This universe lives in this browser. Create an account to share it.",
  avatar_url: null,
  banner_url: null,
  profile_theme: "midnight",
  favorite_genres: [],
  favorite_anime: [],
  favorite_characters: [],
  visibility: "private",
  show_watch_history: false,
  show_favorites: false,
  show_activity: false,
  show_lists: false,
  show_online_status: false,
  created_at: new Date(0).toISOString(),
};

export function useProfileData(username: string): ProfileData {
  const me = useAuth((s) => s.profile);
  const status = useAuth((s) => s.status);
  const localEntries = useLibrary((s) => s.entries);
  const hydrated = useLibrary((s) => s.hydrated);
  const isMe = Boolean(me && me.username.toLowerCase() === username.toLowerCase());
  const guest = username === "guest";
  const theme = useSettings((s) => s.theme);
  const remote = useQuery({
    queryKey: ["profile", username],
    enabled: isSupabaseConfigured && !isMe && !guest && status !== "loading",
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

  if (guest) return { profile: { ...GUEST, profile_theme: theme }, isMe: true, guest: true, entries: localList, listsHidden: false, loading: !hydrated, notFound: false };
  if (isMe) return { profile: me, isMe: true, guest: false, entries: localList, listsHidden: false, loading: !hydrated, notFound: false };
  if (!isSupabaseConfigured) return { profile: null, isMe: false, guest: false, entries: [], listsHidden: false, loading: false, notFound: true };
  const p = remote.data?.profile ?? null;
  return {
    profile: p,
    isMe: false,
    guest: false,
    entries: remote.data?.entries ?? [],
    listsHidden: Boolean(p && (!p.show_lists || (remote.data?.entries.length === 0 && p.visibility !== "public"))),
    loading: remote.isLoading || status === "loading",
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
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", a.earned ? "bg-gradient-to-br from-primary to-accent text-white" : "bg-[var(--k-btn-ghost)] text-muted")}>{ICONS[a.icon] ?? <Award className="size-5" />}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{a.name}</span>
        <span className="block text-xs text-muted">{a.earned ? a.description : `${a.progress}/${a.target} · ${a.description}`}</span>
      </span>
    </li>
  );
}

/** "Profile Universe Reveal": layered banner, kanji and avatar arrive in sequence with gentle parallax. */
export function ProfileShell({ username, tab, children }: { username: string; tab: "overview" | "stats" | "lists"; children: (d: ProfileData) => ReactNode }) {
  const d = useProfileData(username);
  const { reduced } = useKazeMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bannerY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 120]);
  const kanjiY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -60]);
  const [edit, setEdit] = useState(false);

  if (d.loading) return <Skeleton className="container-k mt-8 h-80" />;
  if (d.notFound || !d.profile)
    return (
      <div className="container-k pt-10">
        <EmptyState jp="無" title="No universe by that name" body={isSupabaseConfigured ? "This profile doesn't exist, is private, or has blocked you." : "Profiles need accounts, which aren't configured on this deployment. Your device profile lives at /profile/guest."} action={<Link href="/profile/guest" className="k-btn k-btn-outline k-btn-sm">Open my device profile</Link>} />
      </div>
    );
  const p = d.profile;
  const pTheme: ThemeId = isThemeId(p.profile_theme) ? p.profile_theme : "midnight";
  const favorites = d.entries.filter((e) => e.favorite);
  const name = p.display_name || p.username;
  const base = `/profile/${p.username}`;
  const share = async () => {
    const url = `${location.origin}${base}`;
    try {
      if (navigator.share) await navigator.share({ title: `${name} on KAZE`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch {}
  };

  return (
    <div data-theme={pTheme} className="bg-bg text-fg" style={{ colorScheme: THEMES[pTheme].scheme }}>
      <div ref={ref} className="relative -mt-[var(--k-nav-h)] overflow-hidden">
        <motion.div style={{ y: bannerY }} className="absolute inset-0 h-[min(48svh,420px)]" aria-hidden>
          {p.banner_url ? (
            <Image src={p.banner_url} alt="" fill sizes="100vw" className="object-cover" loading="eager" />
          ) : favorites[0]?.media.banner ? (
            <Image src={favorites[0].media.banner} alt="" fill sizes="100vw" className="object-cover opacity-70" loading="eager" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,var(--k-primary),transparent_55%),radial-gradient(ellipse_at_90%_60%,var(--k-accent),transparent_50%)] opacity-60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
        </motion.div>
        <motion.span style={{ y: kanjiY }} className="k-jp pointer-events-none absolute right-[4vw] top-24 select-none text-[clamp(6rem,18vw,14rem)] font-bold leading-none text-fg/10" lang="ja" aria-hidden initial={reduced ? false : { opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.1, delay: 0.2 }}>
          {THEMES[pTheme].jp.slice(0, 1)}
        </motion.span>
        <div className="container-k relative flex min-h-[min(48svh,420px)] flex-col justify-end pb-8 pt-[calc(var(--k-nav-h)+6rem)]">
          <div className="flex flex-wrap items-end gap-5">
            <motion.div initial={reduced ? false : { scale: 0.6, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.25 }} className="rounded-full p-1 shadow-[var(--k-shadow-pop)] [background:linear-gradient(135deg,var(--k-primary),var(--k-accent))]">
              <Avatar src={p.avatar_url} name={name} size={104} />
            </motion.div>
            <motion.div className="min-w-0 flex-1" initial={reduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }}>
              <h1 className="font-display text-title truncate">{name}</h1>
              <p className="mt-1 text-sm text-muted">
                @{p.username}
                {!d.guest && ` · universe since ${new Date(p.created_at).getFullYear()}`} · {THEMES[pTheme].name}
              </p>
              {p.bio && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm text-fg/85">{p.bio}</p>}
            </motion.div>
            <motion.div className="flex flex-wrap items-center gap-2" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              {d.isMe && !d.guest && (
                <button className="k-btn k-btn-outline k-btn-sm" onClick={() => setEdit(true)}>
                  <Edit3 className="size-4" aria-hidden /> Edit profile
                </button>
              )}
              {!d.isMe && <FriendButton target={{ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }} />}
              {!d.guest && (
                <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm" onClick={share} aria-label="Share profile">
                  <Share2 className="size-4" />
                </button>
              )}
              {!d.isMe && <ReportButton targetType="profile" targetId={p.id} />}
            </motion.div>
          </div>
          {p.favorite_genres.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Favorite genres">
              {p.favorite_genres.map((g) => (
                <li key={g} className="k-chip">{g}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <nav aria-label="Profile" className="container-k flex gap-1 border-b border-line">
        {(
          [
            ["overview", base, "Universe"],
            ["stats", `${base}/stats`, "Anime DNA"],
            ["lists", `${base}/lists`, "Lists"],
          ] as const
        ).map(([k, href, label]) => (
          <Link key={k} href={href} aria-current={tab === k ? "page" : undefined} className={cn("relative px-4 py-3 text-sm font-semibold text-muted hover:text-fg", tab === k && "text-fg after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-primary")}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="container-k pb-10 pt-8">{children(d)}</div>
      {edit && <EditProfile profile={p} onClose={() => setEdit(false)} />}
    </div>
  );
}

export function ProfileOverview({ d }: { d: ProfileData }) {
  const gamification = useSettings((s) => s.gamification);
  const activity = useUserActivity(d.guest || !isSupabaseConfigured ? undefined : d.profile?.id, 15);
  const achievements = useMemo(() => computeAchievements(d.entries), [d.entries]);
  const p = d.profile!;
  const favorites = d.entries.filter((e) => e.favorite).slice(0, 12);
  const watching = d.entries.filter((e) => e.status === "CURRENT").slice(0, 8);
  const dna = useMemo(() => computeDna(d.entries), [d.entries]);
  const showAch = gamification || !d.isMe;

  if (d.listsHidden)
    return <EmptyState icon={<Lock className="size-6" />} jp="秘" title="This universe is private" body="Their lists and activity are visible only to people they've chosen." />;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="space-y-12">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Titles", dna.total],
            ["Completed", dna.completed],
            ["Episodes", formatNumber(dna.episodes)],
            ["Mean score", dna.meanScore ?? "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="k-card p-4">
              <dt className="k-label text-muted">{k}</dt>
              <dd className="font-display mt-1 text-3xl">{v}</dd>
            </div>
          ))}
        </dl>
        <section aria-labelledby="fav-h">
          <h2 id="fav-h" className="font-display text-section mb-4">Favorite anime</h2>
          {favorites.length ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {favorites.map((e, i) => (
                <li key={e.mediaId} style={{ rotate: `${((i % 3) - 1) * 1.5}deg` }}>
                  <Link href={`/anime/${e.mediaId}`} className="k-poster relative block aspect-[2/3]" title={e.media.title}>
                    <SafeImage src={e.media.cover ?? ""} alt={e.media.title} fill sizes="140px" className="object-cover" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No favorites yet.</p>
          )}
        </section>
        {p.favorite_characters.length > 0 && (
          <section aria-labelledby="chars-h">
            <h2 id="chars-h" className="font-display text-section mb-4">Favorite characters</h2>
            <ul className="flex flex-wrap gap-3">
              {p.favorite_characters.slice(0, 12).map((c) => (
                <li key={c.id} className="w-20 text-center">
                  <div className="relative mx-auto size-20 overflow-hidden rounded-full bg-elevated">{c.image && <SafeImage src={c.image} alt="" fill sizes="80px" className="object-cover" />}</div>
                  <p className="mt-1 truncate text-xs">{c.name}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {watching.length > 0 && (
          <section aria-labelledby="watching-h">
            <h2 id="watching-h" className="font-display text-section mb-4">Watching now</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {watching.map((e) => (
                <li key={e.mediaId}>
                  <Link href={`/anime/${e.mediaId}`} className="k-card flex items-center gap-3 p-2.5">
                    <div className="k-poster relative aspect-[2/3] w-12 shrink-0">
                      <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="48px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.media.title}</p>
                      <p className="text-xs text-muted">
                        Episode {e.progress}/{e.media.episodes ?? "?"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <aside className="space-y-8">
        {showAch && (
          <section aria-labelledby="ach-h">
            <h2 id="ach-h" className="font-display text-lg mb-3">Achievements · {achievements.filter((a) => a.earned).length}/{achievements.length}</h2>
            <ul className="space-y-2">
              {achievements
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
            <h2 id="act-h" className="font-display text-lg mb-3">Recent activity</h2>
            <div className="k-card px-4">
              <ActivityList events={activity.data} isLoading={activity.isLoading} error={activity.error} empty={<p className="py-6 text-center text-sm text-muted">No shared activity.</p>} />
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

function EditProfile({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [v, setV] = useState({ display_name: profile.display_name, bio: profile.bio, profile_theme: profile.profile_theme, favorite_genres: profile.favorite_genres });
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const db = getSupabaseBrowser()!;

  const upload = async (kind: "avatar" | "banner", file: File) => {
    if (!["image/png", "image/jpeg", "image/webp", "image/avif"].includes(file.type)) return toast.error("Use a PNG, JPEG, WebP or AVIF image");
    if (file.size > 3 * 1024 * 1024) return toast.error("Images must be 3 MB or smaller");
    setBusy(kind);
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${profile.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await db.storage.from("profile-media").upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setBusy(null);
      return toast.error(error.message);
    }
    const url = db.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
    const { error: e2 } = await db.from("profiles").update(kind === "avatar" ? { avatar_url: url } : { banner_url: url }).eq("id", profile.id);
    setBusy(null);
    if (e2) return toast.error(friendlyDbError(e2));
    await refreshProfile();
    toast.success(kind === "avatar" ? "Avatar updated" : "Banner updated");
  };

  const importChars = async () => {
    setBusy("chars");
    const res = await fetch("/api/integrations/anilist/viewer");
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? "Connect AniList in Settings → Integrations first");
    const chars = (body.favourites?.characters?.nodes ?? []).slice(0, 24).map((c: { id: number; name: { full: string }; image: { large: string | null } }) => ({ id: c.id, name: c.name.full, image: c.image.large }));
    const { error } = await db.from("profiles").update({ favorite_characters: chars }).eq("id", profile.id);
    if (error) return toast.error(friendlyDbError(error));
    await refreshProfile();
    toast.success(`Imported ${chars.length} favorite characters from AniList`);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("save");
    const { error } = await db.from("profiles").update({ display_name: v.display_name.trim().slice(0, 48), bio: v.bio.slice(0, 600), profile_theme: v.profile_theme, favorite_genres: v.favorite_genres.slice(0, 10) }).eq("id", profile.id);
    setBusy(null);
    if (error) return toast.error(friendlyDbError(error));
    await refreshProfile();
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profile saved");
    onClose();
    router.refresh();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Edit your universe">
      <form onSubmit={save} className="space-y-5 px-5 pb-6 pt-2">
        <div className="flex flex-wrap gap-2">
          <label className="k-btn k-btn-outline k-btn-sm cursor-pointer">
            <Camera className="size-4" aria-hidden /> {busy === "avatar" ? "Uploading…" : "Change avatar"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" onChange={(e) => e.target.files?.[0] && upload("avatar", e.target.files[0])} />
          </label>
          <label className="k-btn k-btn-outline k-btn-sm cursor-pointer">
            <Camera className="size-4" aria-hidden /> {busy === "banner" ? "Uploading…" : "Change banner"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" onChange={(e) => e.target.files?.[0] && upload("banner", e.target.files[0])} />
          </label>
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={importChars} disabled={busy === "chars"}>
            {busy === "chars" ? "Importing…" : "Import favorite characters from AniList"}
          </button>
        </div>
        <div>
          <label htmlFor="pf-name" className="mb-1.5 block text-sm font-semibold">Display name</label>
          <input id="pf-name" className="k-input" maxLength={48} value={v.display_name} onChange={(e) => setV({ ...v, display_name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="pf-bio" className="mb-1.5 block text-sm font-semibold">Bio</label>
          <textarea id="pf-bio" className="k-input" maxLength={600} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Profile theme (what visitors see)</legend>
          <div className="grid grid-cols-2 gap-2">
            {THEME_IDS.map((id) => (
              <button type="button" key={id} aria-pressed={v.profile_theme === id} onClick={() => setV({ ...v, profile_theme: id })} className={cn("k-card p-2.5 text-left text-xs font-semibold", v.profile_theme === id && "ring-2 ring-primary")}>
                {THEMES[id].name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Favorite genres (up to 10)</legend>
          <div className="flex flex-wrap gap-1.5">
            {FALLBACK_GENRES.map((g) => {
              const on = v.favorite_genres.includes(g);
              return (
                <button type="button" key={g} className="k-chip" aria-pressed={on} onClick={() => setV({ ...v, favorite_genres: on ? v.favorite_genres.filter((x) => x !== g) : [...v.favorite_genres, g].slice(0, 10) })}>
                  {g}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={onClose}>Cancel</button>
          <button className="k-btn k-btn-primary k-btn-sm" disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Dialog>
  );
}
