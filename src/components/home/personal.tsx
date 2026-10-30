"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Film, Heart, PlayCircle, Sparkles, Users } from "lucide-react";
import { useMemo } from "react";
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
  const playable = recentProgress(items, 8);
  const watching = list.filter((e) => e.status === "CURRENT" || e.status === "REPEATING").sort((a, b) => b.updatedAt - a.updatedAt);

  if (!hydrated || (!playable.length && !watching.length)) return null;
  return (
    <section aria-labelledby="continue-h" className="container-k relative z-[1] -mt-6 pt-0">
      <SectionHeader id="continue-h" title="Continue Watching" jp="続きから" />
      <Rail label="Continue watching" itemClassName="w-[78vw] xs:w-[56vw] sm:w-[40vw] md:w-[30vw] lg:w-[23vw] xl:w-[19vw] 3xl:w-[320px]">
        {[
          ...playable.map((p) => {
            const series = DEMO_SERIES.find((s) => s.id === p.seriesId);
            const ep = series?.episodes.find((e) => e.id === p.episodeId);
            const pct = p.duration ? Math.min(100, (p.position / p.duration) * 100) : 0;
            return (
              <Link key={`p-${p.seriesId}-${p.episodeId}`} href={`/watch/${p.seriesId}/${p.episodeId}`} className="k-card group block overflow-hidden">
                <div className="relative aspect-video bg-gradient-to-br from-primary/40 via-secondary/30 to-accent/30">
                  <span className="k-jp absolute right-3 top-2 text-4xl font-bold text-white/20" lang="ja" aria-hidden>
                    映
                  </span>
                  <PlayCircle className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-lg transition-transform group-hover:scale-110" aria-hidden />
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary-ink">
                    {series?.title ?? "Demo"} · Ep {ep?.number ?? p.episodeId}
                  </p>
                  <p className="truncate text-sm font-semibold">{ep?.title ?? p.title ?? "Episode"}</p>
                  <p className="text-xs text-muted">
                    Resume at {formatDuration(p.position)} of {formatDuration(p.duration)}
                  </p>
                </div>
              </Link>
            );
          }),
          ...watching.slice(0, 10).map((e) => (
            <Link key={`l-${e.mediaId}`} href={`/anime/${e.mediaId}#availability`} className="k-card group flex h-full gap-3 overflow-hidden p-2.5">
              <div className="k-poster relative aspect-[2/3] w-16 shrink-0">
                <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="64px" className="object-cover" fallbackLabel={e.media.title} />
              </div>
              <div className="min-w-0 py-1">
                <p className="text-[0.6875rem] font-semibold text-primary-ink">
                  Next: episode {e.progress + 1}
                  {e.media.episodes ? ` of ${e.media.episodes}` : ""}
                </p>
                <p className="clamp-2 text-sm font-semibold leading-snug">{e.media.title}</p>
                <p className="mt-1 text-xs text-muted">Tracked in your library</p>
              </div>
            </Link>
          )),
        ]}
      </Rail>
    </section>
  );
}

/** 4 · Recommended For You: explainable rule-based engine over a real candidate pool. */
export function RecommendedForYou({ pool }: { pool: MediaCard[] }) {
  const { list, hydrated } = useLibraryList();
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
    return recommend([...extra, ...pool], { profile, exclude: new Set(list.map((e) => e.mediaId)), peerSignals: peer }, 16);
  }, [recQueries.data, pool, profile, list]);

  if (!hydrated) return null;
  const enough = profile.sampleSize >= 2;
  return (
    <section aria-labelledby="rec-h" className="container-k mt-20">
      <SectionHeader
        id="rec-h"
        title={enough ? "Recommended For You" : "Start Your Taste Profile"}
        jp="あなたへ"
        kicker={enough ? `Based on ${profile.top.slice(0, 3).join(", ") || "your library"}` : "Discovery picks"}
      />
      {!enough ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          jp="好"
          title="Personal picks unlock after a couple of titles"
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
      ) : recs.length ? (
        <Rail label="Recommended for you">
          {recs.map((r) => (
            <div key={r.media.id} title={r.factors.map((f) => `${f.label}: +${f.value}`).join("\n")}>
              <AnimeCard media={r.media} caption={r.reason} layoutScope="rec" />
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
      <SectionHeader id="genres-h" title={personal.length >= 3 ? "Your Favorite Genres" : "Browse by Genre"} jp="ジャンル" kicker={personal.length >= 3 ? "From your library" : undefined} />
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {genres.map((g, i) => (
          <li key={g}>
            <Link
              href={`/discover?genres=${encodeURIComponent(g)}&sort=POPULARITY_DESC`}
              className="k-card group relative flex aspect-[16/9] flex-col justify-end overflow-hidden p-3.5 transition-shadow hover:shadow-[var(--k-hover-glow)]"
              style={{ background: `linear-gradient(135deg, var(--k-chart-${(i % 5) + 1}) -40%, var(--k-surface) 70%)` }}
            >
              <span className="font-display text-lg leading-none">{g}</span>
              {counts[g] ? <span className="mt-1 text-xs text-muted">{counts[g]} in your library</span> : <span className="mt-1 text-xs text-muted">Explore</span>}
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
      <SectionHeader id="byl-h" kicker="AniList fan recommendations" title={`Because You Loved ${seed.media.title}`} jp="おすすめ" />
      <Rail label={`Because you loved ${seed.media.title}`}>
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
      <SectionHeader id="friends-h" title="Friends Are Watching" jp="友達" />
      {status === "signed-in" ? (
        <FriendsActivityRail />
      ) : (
        <EmptyState
          icon={<Users className="size-6" />}
          jp="友"
          title={status === "unconfigured" ? "Social features need an account backend" : "Anime is better together"}
          body={
            status === "unconfigured"
              ? "This deployment has no Supabase project configured, so there are no accounts or friends yet. See the README to enable them."
              : "Sign in and add friends to see what they start, finish and rate — only what they choose to share."
          }
          action={
            status !== "unconfigured" ? (
              <Link href="/register" className="k-btn k-btn-primary k-btn-sm">
                Create an account
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
          Tap <strong className="text-fg">Add to list</strong> on anything that catches your eye — your library powers Continue Watching, recommendations and your Anime DNA.
        </p>
        <Link href="/watch/open-cinema/1" className="k-btn k-btn-ghost k-btn-sm">
          <Film className="size-4" aria-hidden /> Try the player
        </Link>
      </div>
    </div>
  );
}
