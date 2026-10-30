"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Check, ChevronDown, Clapperboard, ExternalLink, Eye, Minus, Play, Plus, Share2, ShieldAlert, Star, Tv } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { CharacterEdge, MediaDetail } from "@/lib/anilist/types";
import { cleanDescription, cn, formatLabel, formatNumber, statusLabel, titleCase } from "@/lib/utils";
import { useLibrary } from "@/stores/library";
import { useLocal } from "@/stores/local";
import { LIBRARY_STATUSES, statusMeta } from "@/lib/library/types";
import { api } from "@/lib/api-client";
import { buildEpisodes } from "@/lib/episodes";
import { useNow } from "@/lib/hooks";
import { useKazeMotion } from "@/lib/motion";
import { AnimeCard, displayTitle, ScorePill } from "./anime-card";
import { FavoriteButton, ListMenu } from "./list-actions";
import { TrailerDialog } from "./trailer-dialog";
import { Rail } from "@/components/ui/rail";
import { Dialog } from "@/components/ui/dialog";
import { SafeImage, SectionHeader, Skeleton } from "@/components/ui/primitives";

function fuzzy(d: { year: number | null; month: number | null; day: number | null }) {
  if (!d?.year) return null;
  if (!d.month) return String(d.year);
  return new Date(Date.UTC(d.year, d.month - 1, d.day ?? 1)).toLocaleDateString("en", { year: "numeric", month: "short", ...(d.day ? { day: "numeric" } : {}), timeZone: "UTC" });
}

export function DetailHero({ media }: { media: MediaDetail }) {
  const [expanded, setExpanded] = useState(false);
  const [trailer, setTrailer] = useState(false);
  const pushViewed = useLocal((s) => s.pushViewed);
  const { reduced, m } = useKazeMotion();
  const title = displayTitle(media);
  const desc = cleanDescription(media.description);
  const studio = media.allStudios.edges.find((e) => e.isMain)?.node;
  const rankTop = media.rankings.find((r) => r.allTime && r.type === "RATED") ?? media.rankings[0];

  useEffect(() => {
    pushViewed({ id: media.id, title, cover: media.coverImage.large, color: media.coverImage.color });
  }, [media.id, title, media.coverImage.large, media.coverImage.color, pushViewed]);

  const share = async () => {
    const url = `${location.origin}/anime/${media.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: url });
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Couldn't share this link");
    }
  };

  return (
    <section className="relative -mt-[var(--k-nav-h)]">
      <div className="absolute inset-x-0 top-0 h-[min(62svh,560px)] overflow-hidden" aria-hidden>
        {media.bannerImage ? (
          <Image src={media.bannerImage} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 70% 20%, ${media.coverImage.color ?? "var(--k-primary)"}, transparent 70%)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/80 to-transparent" />
      </div>

      <div className="container-k relative grid gap-8 pt-[calc(var(--k-nav-h)+min(30svh,260px))] md:grid-cols-[minmax(200px,280px)_1fr] lg:gap-12">
        <motion.div
          className="k-poster relative mx-auto aspect-[2/3] w-[min(56vw,240px)] shadow-[var(--k-shadow-pop)] md:mx-0 md:w-full"
          initial={reduced ? false : { opacity: 0, y: 30, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={m.spring}
        >
          <SafeImage src={media.coverImage.extraLarge ?? ""} alt={`${title} poster`} fill loading="eager" sizes="280px" className="object-cover" fallbackLabel={title} />
        </motion.div>

        <div className="min-w-0 md:pt-16">
          <div className="flex flex-wrap items-center gap-2">
            {rankTop && (
              <span className="k-chip !bg-primary/15 font-semibold text-primary-ink">
                #{rankTop.rank} {rankTop.context.replace(/^highest rated /, "rated ").replace(/^most popular /, "popular ")}
              </span>
            )}
            <span className="k-chip">{formatLabel(media.format)}</span>
            <span className="k-chip">{statusLabel(media.status)}</span>
          </div>
          <h1 className="font-display text-title mt-4 max-w-[22ch] text-balance-k">{title}</h1>
          {media.title.native && (
            <p className="k-jp mt-2 text-lg text-muted" lang="ja">
              {media.title.native}
            </p>
          )}
          {media.title.romaji && media.title.romaji !== title && <p className="mt-1 text-sm text-muted">{media.title.romaji}</p>}

          <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <div>
              <dt className="k-label text-muted">Score</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-xl font-bold">
                <Star className="size-4 fill-accent text-accent" aria-hidden />
                {media.averageScore ? `${media.averageScore}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="k-label text-muted">Members</dt>
              <dd className="mt-1 text-xl font-bold">{formatNumber(media.popularity)}</dd>
            </div>
            <div>
              <dt className="k-label text-muted">Episodes</dt>
              <dd className="mt-1 text-xl font-bold">
                {media.episodes ?? (media.nextAiringEpisode ? `${media.nextAiringEpisode.episode - 1}+` : "—")}
                {media.duration ? <span className="ml-1 text-xs font-normal text-muted">× {media.duration}m</span> : null}
              </dd>
            </div>
            <div>
              <dt className="k-label text-muted">Studio</dt>
              <dd className="mt-1 truncate text-sm font-semibold">
                {studio ? (
                  <Link href={`/discover?studio=${encodeURIComponent(studio.name)}`} className="hover:text-primary-ink">
                    {studio.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>

          <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Genres">
            {media.genres.map((g) => (
              <li key={g}>
                <Link className="k-chip" href={`/discover?genres=${encodeURIComponent(g)}`}>
                  {g}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <a href="#availability" className="k-btn k-btn-primary">
              <Tv className="size-4" aria-hidden /> Watch options
            </a>
            <ListMenu media={media} />
            <FavoriteButton media={media} />
            {media.trailer?.site === "youtube" && (
              <button className="k-btn k-btn-ghost" onClick={() => setTrailer(true)}>
                <Clapperboard className="size-4" aria-hidden /> Trailer
              </button>
            )}
            <button className="k-btn k-btn-ghost k-btn-icon" onClick={share} aria-label="Share">
              <Share2 className="size-4" aria-hidden />
            </button>
          </div>

          {desc && (
            <div className="mt-6 max-w-3xl">
              <p className={cn("whitespace-pre-line text-[0.9375rem] leading-relaxed text-fg/85", !expanded && "clamp-3")}>{desc}</p>
              {desc.length > 280 && (
                <button className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-ink" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
                  {expanded ? "Show less" : "Read more"} <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {trailer && media.trailer && <TrailerDialog open onOpenChange={setTrailer} youtubeId={media.trailer.id} title={title} />}
    </section>
  );
}

const SECTIONS = [
  ["overview", "Overview"],
  ["episodes", "Episodes"],
  ["characters", "Characters"],
  ["staff", "Staff"],
  ["related", "Related"],
  ["recommendations", "Recommended"],
  ["trailer", "Trailer"],
  ["reviews", "Reviews"],
  ["discussions", "Discussions"],
  ["friends", "Friends"],
  ["availability", "Availability"],
] as const;

export function SectionNav() {
  const [active, setActive] = useState<string>("overview");
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <nav aria-label="Sections" className="k-nav sticky top-[var(--k-nav-h)] z-40 mt-10">
      <ul className="container-k scrollbar-none flex gap-1 overflow-x-auto py-1.5">
        {SECTIONS.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} className="k-nav-item !h-9 text-[0.8125rem]" data-active={active === id} aria-current={active === id ? "location" : undefined}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Your entry: inline progress, score, status, notes. */
export function YourEntry({ media }: { media: MediaDetail }) {
  const entry = useLibrary((s) => s.entries[media.id]);
  const hydrated = useLibrary((s) => s.hydrated);
  const upsert = useLibrary((s) => s.upsert);
  if (!hydrated) return <Skeleton className="h-48" />;
  const total = media.episodes;
  if (!entry)
    return (
      <div className="k-card p-5">
        <p className="k-label text-muted">Your entry</p>
        <p className="mt-2 text-sm text-muted">Not in your library yet.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="k-btn k-btn-primary k-btn-sm" onClick={() => upsert(media, { status: "CURRENT", progress: 0 })}>
            <Play className="size-4" aria-hidden /> Watching
          </button>
          <button className="k-btn k-btn-outline k-btn-sm" onClick={() => upsert(media, { status: "PLANNING" })}>
            <Plus className="size-4" aria-hidden /> Plan
          </button>
        </div>
      </div>
    );
  return (
    <div className="k-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <p className="k-label text-muted">Your entry</p>
        <span className="k-chip !bg-primary/15 text-primary-ink">{statusMeta(entry.status).label}</span>
      </div>
      <div>
        <label htmlFor="ep-progress" className="text-xs text-muted">
          Episode progress
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm" aria-label="One episode back" onClick={() => upsert(media, { progress: entry.progress - 1 })} disabled={entry.progress <= 0}>
            <Minus className="size-4" />
          </button>
          <input
            id="ep-progress"
            type="number"
            inputMode="numeric"
            min={0}
            max={total ?? undefined}
            value={entry.progress}
            onChange={(e) => upsert(media, { progress: Number(e.target.value) || 0, ...(entry.status === "PLANNING" ? { status: "CURRENT" } : {}) })}
            className="k-input !min-h-9 w-20 text-center tabular-nums"
          />
          <span className="text-sm text-muted">/ {total ?? "?"}</span>
          <button
            className="k-btn k-btn-primary k-btn-icon k-btn-sm ml-auto"
            aria-label="Mark next episode watched"
            onClick={() => upsert(media, { progress: entry.progress + 1, ...(entry.status === "PLANNING" || entry.status === "PAUSED" ? { status: "CURRENT" } : {}) })}
            disabled={total != null && entry.progress >= total}
          >
            <Plus className="size-4" />
          </button>
        </div>
        {total ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={entry.progress} aria-valuemin={0} aria-valuemax={total} aria-label="Progress">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width]" style={{ width: `${(entry.progress / total) * 100}%` }} />
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="entry-status" className="text-xs text-muted">
            Status
          </label>
          <select id="entry-status" className="k-input mt-1.5 !min-h-9 text-sm" value={entry.status} onChange={(e) => upsert(media, { status: e.target.value as typeof entry.status })}>
            {LIBRARY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="entry-score" className="text-xs text-muted">
            Your score (0–100)
          </label>
          <input
            id="entry-score"
            type="number"
            min={0}
            max={100}
            step={5}
            inputMode="numeric"
            className="k-input mt-1.5 !min-h-9 text-sm tabular-nums"
            value={entry.score ?? ""}
            placeholder="—"
            onChange={(e) => upsert(media, { score: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
      </div>
      <div>
        <label htmlFor="entry-notes" className="text-xs text-muted">
          Private notes <span className="opacity-70">(only you can see these)</span>
        </label>
        <textarea
          id="entry-notes"
          key={entry.notes}
          className="k-input mt-1.5 !min-h-20 text-sm"
          maxLength={4000}
          defaultValue={entry.notes}
          onBlur={(e) => e.target.value !== entry.notes && upsert(media, { notes: e.target.value })}
          placeholder="Favourite arc, where you left off, who recommended it…"
        />
      </div>
    </div>
  );
}

export function InfoList({ media }: { media: MediaDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["Format", formatLabel(media.format)],
    ["Episodes", media.episodes ?? "—"],
    ["Duration", media.duration ? `${media.duration} min` : "—"],
    ["Status", statusLabel(media.status)],
    ["Start", fuzzy(media.startDate) ?? "—"],
    ["End", fuzzy(media.endDate) ?? "—"],
    ["Season", media.season && media.seasonYear ? <Link className="hover:text-primary-ink" href={`/seasonal?season=${media.season}&year=${media.seasonYear}`}>{titleCase(media.season)} {media.seasonYear}</Link> : "—"],
    ["Source", media.source ? titleCase(media.source) : "—"],
    ["Studios", media.allStudios.edges.filter((e) => e.node.isAnimationStudio).map((e) => e.node.name).join(", ") || "—"],
    ["Producers", media.allStudios.edges.filter((e) => !e.node.isAnimationStudio).slice(0, 4).map((e) => e.node.name).join(", ") || "—"],
    ["Country", media.countryOfOrigin ?? "—"],
    ["Favourites", formatNumber(media.favourites)],
  ];
  if (media.hashtag) rows.push(["Hashtag", media.hashtag]);
  if (media.synonyms.length) rows.push(["Also known as", media.synonyms.slice(0, 3).join(" · ")]);
  return (
    <dl className="k-card divide-y divide-line px-5 py-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-muted">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TagCloud({ media }: { media: MediaDetail }) {
  const [reveal, setReveal] = useState(false);
  const tags = [...media.tags].sort((a, b) => b.rank - a.rank);
  const spoilers = tags.filter((t) => t.isMediaSpoiler || t.isGeneralSpoiler).length;
  if (!tags.length) return null;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg">Tags</h3>
        {spoilers > 0 && (
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setReveal((r) => !r)} aria-pressed={reveal}>
            <ShieldAlert className="size-4" aria-hidden /> {reveal ? "Hide" : "Show"} {spoilers} spoiler tag{spoilers > 1 ? "s" : ""}
          </button>
        )}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {tags
          .filter((t) => reveal || !(t.isMediaSpoiler || t.isGeneralSpoiler))
          .map((t) => (
            <li key={t.id}>
              <Link href={`/discover?tags=${encodeURIComponent(t.name)}`} className={cn("k-chip", (t.isMediaSpoiler || t.isGeneralSpoiler) && "border-danger/50 text-danger")}>
                {t.name}
                <span className="text-[0.625rem] text-muted">{t.rank}%</span>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Theme-aware score distribution from AniList's real stats. */
export function ScoreDistribution({ media }: { media: MediaDetail }) {
  const dist = media.stats?.scoreDistribution ?? [];
  const statuses = media.stats?.statusDistribution ?? [];
  const max = Math.max(1, ...dist.map((d) => d.amount));
  const totalStatus = statuses.reduce((s, x) => s + x.amount, 0) || 1;
  if (!dist.length) return null;
  const statusColor: Record<string, string> = {
    CURRENT: "var(--k-chart-1)",
    PLANNING: "var(--k-chart-3)",
    COMPLETED: "var(--k-chart-2)",
    DROPPED: "var(--k-chart-4)",
    PAUSED: "var(--k-chart-5)",
  };
  return (
    <div className="k-card p-5">
      <h3 className="font-display text-lg">Community scores</h3>
      <p className="text-xs text-muted">AniList member ratings</p>
      <div className="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label={`Score distribution: ${dist.map((d) => `${d.score}: ${d.amount}`).join(", ")}`}>
        {dist.map((d) => (
          <div key={d.score} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-[3px] transition-[height] duration-700"
              style={{ height: `${(d.amount / max) * 100}%`, background: `color-mix(in oklab, var(--k-chart-1) ${30 + d.score * 0.7}%, var(--k-chart-2))` }}
            />
            <span className="text-[0.625rem] tabular-nums text-muted">{d.score}</span>
          </div>
        ))}
      </div>
      {statuses.length > 0 && (
        <>
          <div className="mt-5 flex h-2.5 overflow-hidden rounded-full" role="img" aria-label="Status distribution">
            {statuses.map((s) => (
              <div key={s.status} style={{ width: `${(s.amount / totalStatus) * 100}%`, background: statusColor[s.status] }} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {statuses.map((s) => (
              <li key={s.status} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: statusColor[s.status] }} aria-hidden />
                <span className="text-muted">{statusMeta(s.status).label}</span>
                <span className="ml-auto tabular-nums">{formatNumber(s.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function EpisodesPreview({ media }: { media: MediaDetail }) {
  const now = useNow();
  const entry = useLibrary((s) => s.entries[media.id]);
  const episodes = useMemo(() => buildEpisodes(media, Math.floor((now ?? 0) / 1000) || Math.floor(Date.UTC(2000, 0) / 1000)), [media, now]);
  if (!now) return <Skeleton className="h-40" />;
  if (!episodes.length) return <p className="text-sm text-muted">Episode information isn&apos;t available yet.</p>;
  return (
    <>
      <EpisodeGrid media={media} episodes={episodes.slice(0, 8)} progress={entry?.progress ?? 0} />
      {episodes.length > 8 && (
        <Link href={`/anime/${media.id}/episodes`} className="k-btn k-btn-outline k-btn-sm mt-4">
          All {episodes.length} episodes
        </Link>
      )}
    </>
  );
}

export function EpisodeGrid({ media, episodes, progress }: { media: MediaDetail; episodes: ReturnType<typeof buildEpisodes>; progress: number }) {
  const upsert = useLibrary((s) => s.upsert);
  const now = useNow();
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {episodes.map((ep) => {
        const watched = ep.number <= progress;
        return (
          <li key={ep.number} className={cn("k-card group overflow-hidden", !ep.aired && "opacity-70")}>
            <div className="relative aspect-video bg-elevated">
              {ep.thumbnail ? (
                // Official thumbnails supplied by AniList's licensed streaming metadata.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ep.thumbnail} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="k-outline-num text-5xl">{String(ep.number).padStart(2, "0")}</span>
                </div>
              )}
              {watched && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-[var(--k-radius-chip)] bg-black/70 px-2 py-0.5 text-[0.625rem] font-bold uppercase text-white">
                  <Check className="size-3" aria-hidden /> Watched
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary-ink">Episode {ep.number}</p>
              <p className="clamp-2 mt-0.5 min-h-[2.5em] text-sm font-semibold leading-snug">{ep.title ?? `Episode ${ep.number}`}</p>
              <p className="mt-1 text-xs text-muted">
                {[ep.durationMin ? `${ep.durationMin} min` : null, ep.airingAt ? `${ep.aired ? "Aired" : "Airs"} ${new Date(ep.airingAt * 1000).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}` : null, !ep.aired && !ep.airingAt ? "Not aired" : null]
                  .filter(Boolean)
                  .join(" · ") || (now ? "" : "")}
              </p>
              <div className="mt-3 flex items-center gap-2">
                {ep.officialUrl ? (
                  <a href={ep.officialUrl} target="_blank" rel="noopener noreferrer" className="k-btn k-btn-ghost k-btn-sm flex-1">
                    <ExternalLink className="size-3.5" aria-hidden /> {ep.officialSite ?? "Official"}
                  </a>
                ) : (
                  <span className="flex-1 text-[0.6875rem] text-muted">Not streamable on KAZE</span>
                )}
                {ep.aired && (
                  <button
                    className={cn("k-btn k-btn-sm k-btn-icon", watched ? "k-btn-primary" : "k-btn-ghost")}
                    aria-label={watched ? `Mark episode ${ep.number} unwatched` : `Mark watched up to episode ${ep.number}`}
                    aria-pressed={watched}
                    onClick={() => upsert(media, { progress: watched ? ep.number - 1 : ep.number, status: "CURRENT" })}
                  >
                    <Eye className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CharacterGrid({ characters }: { characters: CharacterEdge[] }) {
  const [open, setOpen] = useState<CharacterEdge | null>(null);
  if (!characters.length) return <p className="text-sm text-muted">No characters listed on AniList.</p>;
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((c) => {
          const va = c.voiceActors[0];
          return (
            <li key={c.node.id}>
              <button onClick={() => setOpen(c)} className="k-card group flex w-full overflow-hidden text-left transition-shadow hover:shadow-[var(--k-hover-glow)]">
                <div className="relative h-24 w-16 shrink-0 bg-elevated">
                  <SafeImage src={c.node.image.large ?? ""} alt="" fill sizes="64px" className="object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
                  <div>
                    <p className="truncate text-sm font-semibold group-hover:text-primary-ink">{c.node.name.full}</p>
                    <p className="text-[0.6875rem] uppercase tracking-wider text-muted">{titleCase(c.role)}</p>
                  </div>
                  {va && (
                    <p className="truncate text-xs text-muted">
                      CV: <span className="text-fg/80">{va.name.full}</span>
                    </p>
                  )}
                </div>
                {va && (
                  <div className="relative h-24 w-16 shrink-0 bg-elevated">
                    <SafeImage src={va.image.large ?? ""} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {open && <CharacterDialog edge={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function CharacterDialog({ edge, onClose }: { edge: CharacterEdge; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ["character", edge.node.id], queryFn: ({ signal }) => api.character(edge.node.id, signal) });
  const [spoil, setSpoil] = useState(false);
  const c = data?.character;
  const raw = c?.description ?? "";
  const hasSpoiler = /~!/.test(raw);
  const text = cleanDescription(spoil ? raw.replace(/~!|!~/g, "") : raw);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={edge.node.name.full} description={edge.node.name.native ?? undefined}>
      <div className="grid gap-5 px-5 pb-6 pt-3 sm:grid-cols-[140px_1fr]">
        <div className="k-poster relative aspect-[2/3] w-32 sm:w-full">
          <SafeImage src={edge.node.image.large ?? ""} alt="" fill sizes="140px" className="object-cover" />
        </div>
        <div className="min-w-0 text-sm">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted">Role</dt>
              <dd className="font-semibold">{titleCase(edge.role)}</dd>
            </div>
            {c?.gender && (
              <div>
                <dt className="text-muted">Gender</dt>
                <dd className="font-semibold">{c.gender}</dd>
              </div>
            )}
            {c?.age && (
              <div>
                <dt className="text-muted">Age</dt>
                <dd className="font-semibold">{c.age}</dd>
              </div>
            )}
            {c?.favourites != null && (
              <div>
                <dt className="text-muted">Favourites</dt>
                <dd className="font-semibold">{formatNumber(c.favourites)}</dd>
              </div>
            )}
          </dl>
          {edge.voiceActors[0] && (
            <p className="mt-3 text-xs text-muted">
              Japanese voice: <span className="font-semibold text-fg">{edge.voiceActors[0].name.full}</span>
              {edge.voiceActors[0].name.native && <span className="k-jp ml-1">({edge.voiceActors[0].name.native})</span>}
            </p>
          )}
          <div className="mt-4 max-h-64 overflow-y-auto whitespace-pre-line leading-relaxed text-fg/85">
            {isLoading && <Skeleton className="h-24" />}
            {isError && <p className="text-muted">Couldn&apos;t load character details.</p>}
            {c && (text || "No description on AniList.")}
          </div>
          {hasSpoiler && (
            <button className="k-btn k-btn-ghost k-btn-sm mt-3" onClick={() => setSpoil((s) => !s)} aria-pressed={spoil}>
              <ShieldAlert className="size-4" aria-hidden /> {spoil ? "Hide spoilers" : "Reveal spoilers"}
            </button>
          )}
          {c && (
            <a href={c.siteUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-ink">
              View on AniList <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function StaffList({ media }: { media: MediaDetail }) {
  if (!media.staff.edges.length) return <p className="text-sm text-muted">No staff listed.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {media.staff.edges.map((s, i) => (
        <li key={`${s.node.id}-${i}`} className="k-card flex items-center gap-3 p-2.5">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-elevated">
            <SafeImage src={s.node.image.large ?? ""} alt="" fill sizes="48px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{s.node.name.full}</p>
            <p className="truncate text-xs text-muted">{s.role}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RelatedRail({ media }: { media: MediaDetail }) {
  const rel = media.relations.edges.filter((e) => e.node.type === "ANIME" && !e.node.isAdult);
  if (!rel.length) return <p className="text-sm text-muted">No related anime.</p>;
  return (
    <Rail label="Related anime">
      {rel.map((e) => (
        <AnimeCard key={e.node.id} media={e.node} caption={titleCase(e.relationType)} layoutScope="related" />
      ))}
    </Rail>
  );
}

export function RecommendationRail({ media }: { media: MediaDetail }) {
  const recs = media.recommendations.nodes.filter((n) => n.mediaRecommendation && !n.mediaRecommendation.isAdult && n.rating > 0);
  if (!recs.length) return <p className="text-sm text-muted">No fan recommendations yet.</p>;
  return (
    <Rail label="Recommendations">
      {recs.map((n) => (
        <AnimeCard key={n.mediaRecommendation!.id} media={n.mediaRecommendation!} caption={`${n.rating} fans recommend`} layoutScope="recs" />
      ))}
    </Rail>
  );
}

export function TrailerBlock({ media }: { media: MediaDetail }) {
  const [play, setPlay] = useState(false);
  const t = media.trailer;
  if (!t || t.site !== "youtube") return <p className="text-sm text-muted">No trailer listed on AniList.</p>;
  return (
    <div className="k-card relative aspect-video max-w-4xl overflow-hidden bg-black">
      {play ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.id)}?autoplay=1&rel=0`}
          title={`${displayTitle(media)} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button className="group absolute inset-0" onClick={() => setPlay(true)} aria-label={`Play trailer for ${displayTitle(media)}`}>
          {t.thumbnail && <SafeImage src={t.thumbnail.replace("hqdefault", "maxresdefault")} alt="" fill sizes="900px" className="object-cover opacity-80" />}
          <span className="k-btn-primary absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-transform group-hover:scale-110">
            <Play className="size-6 fill-current" aria-hidden />
          </span>
        </button>
      )}
      {!play && (
        <span className="pointer-events-none absolute bottom-3 left-3 text-xs text-white/80">Plays from YouTube (privacy-enhanced mode) when clicked</span>
      )}
    </div>
  );
}

export function AniListReviews({ media }: { media: MediaDetail }) {
  const reviews = media.reviews.nodes;
  if (!reviews.length) return null;
  return (
    <div className="mt-8">
      <h3 className="font-display text-lg">From AniList reviewers</h3>
      <p className="text-xs text-muted">Summaries of public AniList reviews — read the full text on AniList.</p>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {reviews.map((r) => (
          <li key={r.id} className="k-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              {r.user.avatar.medium && <Image src={r.user.avatar.medium} alt="" width={24} height={24} className="rounded-full" unoptimized />}
              <span className="font-semibold text-fg">{r.user.name}</span>
              {r.score != null && <ScorePill score={r.score} className="ml-auto text-fg" />}
            </div>
            <p className="mt-2 text-sm leading-relaxed">“{r.summary}”</p>
            <a href={r.siteUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-ink">
              Read on AniList · {r.rating ?? 0}/{r.ratingAmount ?? 0} found helpful <ExternalLink className="size-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Availability({ media, playable }: { media: MediaDetail; playable: { seriesId: string; title: string } | null }) {
  const links = media.externalLinks.filter((l) => l.type === "STREAMING" && !l.isDisabled);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="k-card p-5">
        <p className="k-label text-muted">On KAZE</p>
        {playable ? (
          <>
            <p className="font-display mt-2 text-lg">Streaming on KAZE</p>
            <Link href={`/watch/${playable.seriesId}/1`} className="k-btn k-btn-primary mt-4">
              <Play className="size-4" aria-hidden /> Watch now
            </Link>
          </>
        ) : (
          <>
            <p className="font-display mt-2 text-lg">Not licensed for streaming here</p>
            <p className="mt-2 text-sm text-muted">
              AniList lists this title&apos;s metadata, but that doesn&apos;t give KAZE the right to stream it. You can still track it, review it and plan watch nights with friends. To try the
              player, use the open-licensed demo.
            </p>
            <Link href="/watch/open-cinema/1" className="k-btn k-btn-outline k-btn-sm mt-4">
              Open the demo player
            </Link>
          </>
        )}
      </div>
      <div className="k-card p-5">
        <p className="k-label text-muted">Official streams (via AniList)</p>
        {links.length ? (
          <ul className="mt-3 space-y-2">
            {links.map((l) => (
              <li key={l.id}>
                <a href={l.url.replace(/^http:/, "https:")} target="_blank" rel="noopener noreferrer" className="k-btn k-btn-ghost w-full justify-start">
                  {l.icon ? (
                    <span className="grid size-6 place-items-center rounded" style={{ background: l.color ?? "transparent" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.icon} alt="" className="size-4" />
                    </span>
                  ) : (
                    <Tv className="size-4" aria-hidden />
                  )}
                  <span className="flex-1 text-left">{l.site}</span>
                  {l.language && <span className="text-xs text-muted">{l.language}</span>}
                  <ExternalLink className="size-3.5 opacity-60" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">AniList doesn&apos;t list an official streaming service for this title (availability also varies by region).</p>
        )}
      </div>
    </div>
  );
}

export function DetailSection({ id, title, jp, children, className }: { id: string; title: string; jp?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("container-k mt-16 scroll-mt-[calc(var(--k-nav-h)+64px)]", className)}>
      <SectionHeader id={`${id}-h`} title={title} jp={jp} />
      {children}
    </section>
  );
}
