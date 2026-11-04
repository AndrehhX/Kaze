"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Film, Heart, PlayCircle, Sparkles, Users, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLocal } from "@/stores/local";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { LibraryEntry } from "@/lib/library/types";
import type { MediaCard } from "@/lib/anilist/types";
import { useLibrary } from "@/stores/library";
import { recentProgress, useProgress } from "@/stores/progress";
import { useAuth } from "@/stores/auth";
import { buildGenreProfile, pickSeed, recommend } from "@/lib/recommend";
import { api } from "@/lib/api-client";
import { DEMO_SERIES } from "@/lib/media/demo-catalog";
import { AnimeCard, AnimeCardSkeleton } from "@/components/anime/anime-card";
import { Rail } from "@/components/ui/rail";
import { EmptyState, SafeImage, SectionHeader } from "@/components/ui/primitives";
import { formatDuration } from "@/lib/utils";
import { FALLBACK_GENRES } from "@/lib/anilist/browse-params";
import { FriendsActivityRail } from "@/components/social/friends-activity";

function useLibraryList() {
  const entries = useLibrary((s) => s.entries);
  const hydrated = useLibrary((s) => s.hydrated);
  return { list: useMemo(() => Object.values(entries), [entries]), hydrated };
}

/** 1 · Continue Watching: real playback progress + series marked Watching. */
export function ContinueWatching() {
  const items = useProgress((s) => s.items);
  const hydrated = useProgress((s) => s.hydrated);
  const { list } = useLibraryList();

  // Filtrar exclusivamente animes reales con AniList ID numérico positivo, omitiendo demos
  const isRealAnime = (p: { seriesId: string; isDemo?: boolean; seriesTitle?: string | null; title?: string | null }) => {
    if (p.isDemo) return false;
    const num = Number(p.seriesId);
    if (!Number.isInteger(num) || num <= 0) return false;
    const sTitle = (p.seriesTitle || "").toLowerCase();
    const epTitle = (p.title || "").toLowerCase();
    if (sTitle.includes("demo") || sTitle.includes("open cinema")) return false;
    if (epTitle.includes("big buck bunny") || epTitle.includes("sintel") || epTitle.includes("elephants dream")) return false;
    return true;
  };
  const playable = recentProgress(items, 12).filter(isRealAnime);
  const watching = list.filter((e) => e.status === "CURRENT" || e.status === "REPEATING").sort((a, b) => b.updatedAt - a.updatedAt);

  // Obtener metadatos de AniList para las series en progreso de reproducción
  const aniIds = useMemo(
    () => Array.from(new Set(playable.map((p) => Number(p.seriesId)).filter((id) => Number.isInteger(id) && id > 0))),
    [playable]
  );
  const { data: batchData } = useQuery({
    queryKey: ["continue-batch", aniIds],
    queryFn: ({ signal }) => api.batch(aniIds, signal),
    enabled: aniIds.length > 0,
    staleTime: 30 * 60_000,
  });
  const mediaMap = useMemo(() => {
    const map = new Map<number, MediaCard>();
    for (const m of batchData?.media ?? []) map.set(m.id, m);
    return map;
  }, [batchData]);

  const airing = useAiringStatus(watching);

  if (!hydrated || (!playable.length && !watching.length)) return null;
  return (
    <section aria-labelledby="continue-h" className="container-k relative z-[1] mt-12 sm:mt-16 pb-6">
      <SectionHeader id="continue-h" title="Continuar viendo" jp="続きから" />
      <Rail label="Continuar viendo" itemClassName="w-[78vw] xs:w-[56vw] sm:w-[40vw] md:w-[30vw] lg:w-[23vw] xl:w-[19vw] 3xl:w-[320px]">
        {[
          ...playable.map((p) => {
            const media = mediaMap.get(Number(p.seriesId));
            const seriesTitle = p.seriesTitle || media?.title.english || media?.title.romaji || "Anime";
            const epNum = p.episodeNumber || parseInt(p.episodeId, 10) || 1;
            const epTitle = p.title && !p.title.startsWith("Episodio") && p.title !== `Episode ${epNum}` ? p.title : `Episodio ${epNum}`;
            const thumb = p.thumbnail || media?.bannerImage || media?.coverImage.extraLarge || media?.coverImage.large || null;
            const pct = p.duration ? Math.min(100, Math.max(0, (p.position / p.duration) * 100)) : 0;

            return (
              <Link key={`p-${p.seriesId}-${p.episodeId}`} href={`/watch/${p.seriesId}/${p.episodeId}`} prefetch={true} className="k-card group block overflow-hidden">
                <div className="relative aspect-video bg-elevated overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={seriesTitle}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/30 to-accent/20">
                      <span className="k-outline-num text-4xl">{String(epNum).padStart(2, "0")}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="grid size-11 place-items-center rounded-full bg-primary text-black shadow-lg">
                      <PlayCircle className="size-6 text-black fill-current ml-0.5" aria-hidden />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary-ink truncate">
                    {seriesTitle} · Ep {epNum}
                  </p>
                  <p className="truncate text-sm font-semibold mt-0.5">{epTitle}</p>
                  <p className="text-xs text-muted mt-0.5">
                    Reanudar en {formatDuration(p.position)} de {formatDuration(p.duration)}
                  </p>
                </div>
              </Link>
            );
          }),
          ...watching.slice(0, 10).map((e) => (
            <Link key={`l-${e.mediaId}`} href={`/anime/${e.mediaId}#availability`} prefetch={true} className="k-card group flex h-full gap-3 overflow-hidden p-2.5">
              <div className="k-poster relative aspect-[2/3] w-16 shrink-0">
                <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="64px" className="object-cover" fallbackLabel={e.media.title} />
              </div>
              <div className="min-w-0 py-1">
                <p className="text-[0.6875rem] font-semibold text-primary-ink">
                  Siguiente: episodio {e.progress + 1}
                  {e.media.episodes ? ` de ${e.media.episodes}` : ""}
                </p>
                <p className="clamp-2 text-sm font-semibold leading-snug">{e.media.title}</p>
                <AiringLine status={airing.get(e.mediaId)} />
              </div>
            </Link>
          )),
        ]}
      </Rail>
    </section>
  );
}

type Airing = { unwatched: number; nextEpisode: number | null; inDays: number | null };

/**
 * New-episode awareness from AniList's real airing data: how many aired
 * episodes are ahead de your progress, and when the next one airs.
 */
function useAiringStatus(watching: LibraryEntry[]) {
  const ids = watching.map((e) => e.mediaId).slice(0, 50).sort((a, b) => a - b);
  const { data } = useQuery({ queryKey: ["airing", ids], queryFn: ({ signal }) => api.batch(ids, signal), enabled: ids.length > 0, staleTime: 30 * 60_000 });
  return useMemo(() => {
    const map = new Map<number, Airing>();
    for (const m of data?.media ?? []) {
      const e = watching.find((w) => w.mediaId === m.id);
      if (!e) continue;
      const aired = m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : m.status === "FINISHED" ? (m.episodes ?? e.progress) : e.progress;
      map.set(m.id, {
        unwatched: Math.max(0, aired - e.progress),
        nextEpisode: m.nextAiringEpisode?.episode ?? null,
        inDays: m.nextAiringEpisode ? Math.max(0, Math.round(m.nextAiringEpisode.timeUntilAiring / 86400)) : null,
      });
    }
    return map;
  }, [data, watching]);
}

function AiringLine({ status }: { status?: Airing }) {
  if (!status) return <p className="mt-1 text-xs text-muted">Guardado en tu biblioteca</p>;
  if (status.unwatched > 0)
    return (
      <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
        <span className="size-1.5 rounded-full bg-accent" aria-hidden />
        {status.unwatched} new episode{status.unwatched > 1 ? "s" : ""} aired
      </p>
    );
  if (status.nextEpisode) return <p className="mt-1 text-xs text-muted">Episode {status.nextEpisode} airs {status.inDays === 0 ? "today" : `in ${status.inDays}d`}</p>;
  return <p className="mt-1 text-xs text-muted">Al día con todos los episodios emitidos</p>;
}

/** "Not interested" list: device copy, mirrored to recommendation_preferences for signed-in users. */
function useHiddenRecs() {
  const hidden = useLocal((s) => s.hiddenRecs);
  const me = useAuth((s) => s.user?.id);
  const remote = useQuery({
    queryKey: ["rec-prefs", me],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data } = await getSupabaseBrowser()!.from("recommendation_preferences").select("excluded_media").eq("user_id", me!).maybeSingle();
      return (data?.excluded_media as number[] | undefined) ?? [];
    },
  });
  useEffect(() => {
    if (remote.data?.length) useLocal.getState().setHiddenRecs([...useLocal.getState().hiddenRecs, ...remote.data]);
  }, [remote.data]);
  const persist = (ids: number[]) => {
    if (!me) return;
    getSupabaseBrowser()!
      .from("recommendation_preferences")
      .upsert({ user_id: me, excluded_media: ids.slice(-500), updated_at: new Date().toISOString() })
      .then(({ error }) => error && console.warn("[kaze] rec prefs sync failed", error.message));
  };
  const hide = (id: number, title: string) => {
    useLocal.getState().hideRec(id);
    persist(useLocal.getState().hiddenRecs);
    toast(`Got it: we won't recommend ${title} again`, {
      action: {
        label: "Undo",
        onClick: () => {
          useLocal.getState().unhideRec(id);
          persist(useLocal.getState().hiddenRecs);
        },
      },
    });
  };
  return { hidden, hide };
}

/** 4 · Recommended For You: explainable rule-based engine over a real candidate pool. */
export function RecommendedForYou({ pool }: { pool: MediaCard[] }) {
  const { list, hydrated } = useLibraryList();
  const { hidden, hide } = useHiddenRecs();
  const profile = useMemo(() => buildGenreProfile(list), [list]);
  const seeds = useMemo(
    () =>
      list
        .filter((e) => (e.score ?? 0) >= 75 || e.favorite)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 2),
    [list],
  );
  const recQueries = useQuery({
    queryKey: ["rec-seeds", seeds.map((s) => s.mediaId)],
    queryFn: async ({ signal }) => Promise.all(seeds.map((s) => api.recommendations(s.mediaId, signal).then((r) => ({ seed: s, r })))),
    enabled: hydrated && seeds.length > 0,
  });

  const recs = useMemo(() => {
    const peer = new Map<number, { seedTitle: string; rating: number }[]>();
    const extra: MediaCard[] = [];
    for (const { seed, r } of recQueries.data ?? []) {
      for (const it of r.items) {
        extra.push(it.media);
        peer.set(it.media.id, [...(peer.get(it.media.id) ?? []), { seedTitle: seed.media.title, rating: it.rating }]);
      }
    }
    return recommend([...extra, ...pool], { profile, exclude: new Set([...list.map((e) => e.mediaId), ...hidden]), peerSignals: peer }, 16);
  }, [recQueries.data, pool, profile, list, hidden]);
  const discovery = useMemo(() => {
    const seen = new Set<number>();
    return [...pool]
      .filter((m) => !seen.has(m.id) && seen.add(m.id) && !hidden.includes(m.id))
      .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0))
      .slice(0, 14);
  }, [pool, hidden]);

  if (!hydrated) return null;
  const enough = profile.sampleSize >= 2;
  return (
    <section aria-labelledby="rec-h" className="container-k mt-20">
      <SectionHeader
        id="rec-h"
        title={enough ? "Recomendado para ti" : "Comienza tu perfil de gustos"}
        jp="あなたへ"
        kicker={enough ? `Basado en ${profile.top.slice(0, 3).join(", ") || "tu biblioteca"}` : "Descubrimiento"}
      />
      {!enough ? (
        <>
          <EmptyState
          icon={<Sparkles className="size-6" />}
          jp="好"
          title="Personal picks unlock after a couple de titles"
          body={
            <>
              KAZE recommends from what you actually watch — genres you finish, scores you give, and AniList fan recommendations. Add or rate at least two titles and this row becomes
              yours. Until then, here are the community&apos;s highest-scored picks.
            </>
          }
          action={
            <Link href="/discover/moods" className="k-btn k-btn-primary k-btn-sm">
              Find something by mood
            </Link>
          }
        />
          <div className="mt-6">
            <Rail label="Discovery picks">
              {discovery.map((m) => (
                <AnimeCard key={m.id} media={m} caption="Highly rated on AniList" layoutScope="disc" />
              ))}
            </Rail>
          </div>
        </>
      ) : recs.length ? (
        <Rail label="Recomendado para ti">
          {recs.map((r) => (
            <div key={r.media.id} className="group/rec relative" title={r.factors.map((f) => `${f.label}: +${f.value}`).join("\n")}>
              <AnimeCard media={r.media} caption={r.reason} layoutScope="rec" />
              <button
                type="button"
                className="k-btn k-btn-icon k-btn-sm absolute left-1.5 top-1.5 z-[5] !size-7 !min-h-7 bg-black/65 text-white opacity-0 backdrop-blur transition-opacity focus-visible:opacity-100 group-hover/rec:opacity-100 max-md:opacity-100"
                aria-label={`Not interested in ${r.media.title.english || r.media.title.romaji}`}
                title="Not interested"
                onClick={() => hide(r.media.id, r.media.title.english || r.media.title.romaji || "this")}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </Rail>
      ) : (
        <Rail label="Loading recommendations">{Array.from({ length: 6 }, (_, i) => <AnimeCardSkeleton key={i} />)}</Rail>
      )}
      {enough && <p className="mt-1 text-[0.6875rem] text-muted">Rule-based and explainable: hover a card to see what contributed to its score.</p>}
    </section>
  );
}

/** 9 · Your Favorite Genres. */
export function FavoriteGenres() {
  const { list, hydrated } = useLibraryList();
  const profile = useMemo(() => buildGenreProfile(list), [list]);
  if (!hydrated) return null;
  const counts: Record<string, number> = {};
  for (const e of list) for (const g of e.media.genres) counts[g] = (counts[g] ?? 0) + 1;
  const personal = profile.top.slice(0, 6);
  const genres = personal.length >= 3 ? personal : FALLBACK_GENRES.slice(0, 12);
  return (
    <section aria-labelledby="genres-h" className="container-k mt-20">
      <SectionHeader id="genres-h" title={personal.length >= 3 ? "Tus géneros favoritos" : "Explorar por género"} jp="ジャンル" kicker={personal.length >= 3 ? "From your library" : undefined} />
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {genres.map((g, i) => (
          <li key={g}>
            <Link
              href={`/discover?genres=${encodeURIComponent(g)}&sort=POPULARITY_DESC`}
              className="k-card group relative flex aspect-[16/9] flex-col justify-end overflow-hidden p-3.5 transition-shadow hover:shadow-[var(--k-hover-glow)]"
              style={{ background: `linear-gradient(135deg, var(--k-chart-${(i % 5) + 1}) -40%, var(--k-surface) 70%)` }}
            >
              <span className="font-display text-lg leading-none">{g}</span>
              {counts[g] ? <span className="mt-1 text-xs text-muted">{counts[g]} en tu biblioteca</span> : <span className="mt-1 text-xs text-muted">Explore</span>}
              <ArrowUpRight className="absolute right-3 top-3 size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 11 · Because You Loved… — AniList fan recommendations for the user's top title. */
export function BecauseYouLoved() {
  const { list, hydrated } = useLibraryList();
  const seed = useMemo(() => pickSeed(list), [list]);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["recommendations", seed?.mediaId],
    queryFn: ({ signal }) => api.recommendations(seed!.mediaId, signal),
    enabled: hydrated && Boolean(seed),
  });
  if (!hydrated || !seed) return null;
  const inLib = new Set(list.map((e) => e.mediaId));
  const items = (data?.items ?? []).filter((i) => !inLib.has(i.media.id));
  if (isError || (!isLoading && !items.length)) return null;
  return (
    <section aria-labelledby="byl-h" className="container-k mt-20">
      <SectionHeader id="byl-h" kicker="Recomendaciones de la comunidad" title={`Porque te gustó ${seed.media.title}`} jp="おすすめ" />
      <Rail label={`Porque te gustó ${seed.media.title}`}>
        {isLoading
          ? Array.from({ length: 6 }, (_, i) => <AnimeCardSkeleton key={i} />)
          : items.map((i) => <AnimeCard key={i.media.id} media={i.media} caption={`${i.rating} fans agree`} layoutScope="byl" />)}
      </Rail>
    </section>
  );
}

/** 10 · Friends Are Watching — only real friend activity, gated by privacy rules (RLS). */
export function FriendsAreWatching() {
  const status = useAuth((s) => s.status);
  return (
    <section aria-labelledby="friends-h" className="container-k mt-20">
      <SectionHeader id="friends-h" title="Tus amigos están viendo" jp="友達" />
      {status === "signed-in" ? (
        <FriendsActivityRail />
      ) : (
        <EmptyState
          icon={<Users className="size-6" />}
          jp="友"
          title={status === "unconfigured" ? "Las funciones sociales requieren una cuenta" : "El anime se disfruta mejor juntos"}
          body={
            status === "unconfigured"
              ? "This deployment has no Supabase project configured, so there are no accounts or friends yet. See the README to enable them."
              : "Inicia sesión y añade amigos para ver lo que empiezan, terminan y califican en tiempo real."
          }
          action={
            status !== "unconfigured" ? (
              <Link href="/register" className="k-btn k-btn-primary k-btn-sm">
                Crear una cuenta
              </Link>
            ) : undefined
          }
        />
      )}
    </section>
  );
}

export function LibraryNudge() {
  const { list, hydrated } = useLibraryList();
  if (!hydrated || list.length) return null;
  return (
    <div className="container-k mt-10">
      <div className="k-card flex flex-wrap items-center gap-4 p-4 text-sm">
        <Heart className="size-5 text-accent" aria-hidden />
        <p className="flex-1 text-muted">
          Pulsa <strong className="text-fg">Añadir a mi lista</strong> en cualquier anime — tu biblioteca impulsa Continuar viendo, las recomendaciones y tu ADN de Anime.
        </p>
        <Link href="/discover" className="k-btn k-btn-ghost k-btn-sm">
          <Film className="size-4" aria-hidden /> Explorar catálogo
        </Link>
      </div>
    </div>
  );
}
