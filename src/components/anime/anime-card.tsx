"use client";
import { genreLabel } from "@/lib/anilist/browse-params";

import Link from "next/link";
import { motion } from "motion/react";
import { Expand, Star } from "lucide-react";
import { useState } from "react";
import type { MediaCard } from "@/lib/anilist/types";
import { cn, formatLabel, statusLabel } from "@/lib/utils";
import { SafeImage } from "@/components/ui/primitives";
import { useLibrary } from "@/stores/library";
import { statusMeta } from "@/lib/library/types";
import { useKazeMotion } from "@/lib/motion";
import { FavoriteButton } from "./list-actions";
import { QuickView } from "./quick-view";

export function displayTitle(m: Pick<MediaCard, "title">) {
  return m.title.english || m.title.userPreferred || m.title.romaji || "Untitled";
}

export function altTitle(m: Pick<MediaCard, "title">) {
  const main = displayTitle(m);
  const alt = m.title.romaji && m.title.romaji !== main ? m.title.romaji : m.title.native;
  return alt ?? null;
}

export function ScorePill({ score, className }: { score: number | null; className?: string }) {
  if (!score) return null;
  return (
    <span className={cn("k-score text-xs", className)} aria-label={`Average score ${score} out of 100`}>
      <Star className="size-3 fill-current text-accent" aria-hidden />
      {score}%
    </span>
  );
}

export function AvailabilityDot({ media }: { media: MediaCard }) {
  const s = media.status;
  const color = s === "RELEASING" ? "var(--k-success)" : s === "NOT_YET_RELEASED" ? "var(--k-accent)" : "var(--k-muted)";
  let text = statusLabel(s);
  if (s === "RELEASING" && media.nextAiringEpisode) {
    const d = Math.round(media.nextAiringEpisode.timeUntilAiring / 86400);
    text = `Ep ${media.nextAiringEpisode.episode} ${d <= 0 ? "today" : `in ${d}d`}`;
  }
  if (!text) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-muted">
      <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {text}
    </span>
  );
}

const preloaded = new Set<number>();

type Props = {
  media: MediaCard;
  rank?: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Extra line under the title (e.g. "Ep 7 aired 3h ago"). */
  caption?: string;
  layoutScope?: string;
};

/**
 * Premium poster card. Hover/focus reveals a quick panel *inside* the poster,
 * so it never covers neighbouring cards or blocks the main link.
 */
export function AnimeCard({ media, rank, priority, sizes = "(max-width: 640px) 40vw, (max-width: 1024px) 22vw, 180px", className, caption, layoutScope = "card" }: Props) {
  const entry = useLibrary((s) => s.entries[media.id]);
  const [quick, setQuick] = useState(false);
  const { m, reduced, theme } = useKazeMotion();
  const title = displayTitle(media);
  const alt = altTitle(media);
  const year = media.seasonYear ?? media.startDate?.year;
  const href = `/anime/${media.id}`;
  const layoutId = `${layoutScope}-poster-${media.id}`;

  return (
    <motion.article
      className={cn("k-hoverable group relative", className)}
      whileHover={reduced ? undefined : { y: -m.lift }}
      transition={m.spring}
      onMouseEnter={() => {
        // Hover preloading: warm the banner the detail page opens with.
        if (media.bannerImage && !preloaded.has(media.id)) {
          preloaded.add(media.id);
          new window.Image().src = media.bannerImage;
        }
      }}
    >
      <Link href={href} prefetch={true} className="block rounded-[var(--k-radius-card)] outline-none">
        <span className="sr-only">{`${title}${year ? `, ${year}` : ""}`}</span>
        <motion.div layoutId={reduced ? undefined : layoutId} className="k-poster aspect-[2/3] w-full" style={{ backgroundColor: media.coverImage.color ?? undefined }}>
          <SafeImage
            src={media.coverImage.extraLarge || media.coverImage.large || ""}
            alt=""
            fill
            sizes={sizes}
            loading={priority ? "eager" : "lazy"}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            fallbackLabel={title}
            tint={media.coverImage.color}
          />
          {/* bottom scrim for metadata legibility */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
          {entry && (
            <span
              className={cn(
                "absolute left-2 top-2 z-[3] rounded-[var(--k-radius-chip)] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider",
                theme === "zen" ? "bg-[#1d1d1d] text-[#f5f2ea]" : "bg-black/65 text-white backdrop-blur",
              )}
            >
              {statusMeta(entry.status).short}
              {entry.status === "CURRENT" && media.episodes ? ` · ${entry.progress}/${media.episodes}` : ""}
            </span>
          )}
          {media.averageScore ? (
            <span className="absolute right-2 top-2 z-[3] rounded-[var(--k-radius-chip)] bg-black/65 px-1.5 py-0.5 text-white backdrop-blur">
              <ScorePill score={media.averageScore} className="text-[0.6875rem]" />
            </span>
          ) : null}
          <div aria-hidden className="absolute inset-x-0 bottom-0 z-[2] translate-y-2 p-2.5 text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <p className="clamp-2 text-[0.6875rem] leading-snug text-white/85">{media.genres.slice(0, 3).join(" · ")}</p>
            <p className="mt-1 text-[0.6875rem] font-semibold text-white">
              {[formatLabel(media.format), media.episodes ? `${media.episodes} ep` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          {entry?.status === "CURRENT" && media.episodes ? (
            <div className="absolute inset-x-0 bottom-0 z-[3] h-1 bg-black/40" aria-hidden>
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (entry.progress / media.episodes) * 100)}%` }} />
            </div>
          ) : null}
        </motion.div>
      </Link>

      {/* Quick actions live outside the link so they never hijack navigation. */}
      <div className="absolute right-1.5 top-[calc(100%*0.66-2.75rem)] z-[4] flex flex-col gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 max-md:hidden">
        <FavoriteButton media={media} size="sm" className="!bg-black/60 !text-white backdrop-blur" />
        <button
          type="button"
          className="k-btn k-btn-ghost k-btn-icon k-btn-sm !bg-black/60 !text-white backdrop-blur"
          aria-label={`Quick view: ${title}`}
          onClick={() => setQuick(true)}
        >
          <Expand className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-2.5 flex gap-2.5 px-0.5">
        {rank != null && (
          <span className="k-outline-num -mt-0.5 text-[2.6rem]" aria-label={`Rank ${rank}`}>
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link href={href} className="clamp-2 text-sm font-semibold leading-snug hover:text-primary-ink" title={title} tabIndex={-1}>
            {title}
          </Link>
          {alt && (
            <p className="mt-0.5 truncate text-xs text-muted" title={alt}>
              {alt}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {caption ? <span className="text-[0.6875rem] font-medium text-primary-ink">{caption}</span> : <AvailabilityDot media={media} />}
            {year && <span className="text-[0.6875rem] text-muted">{year}</span>}
          </div>
        </div>
      </div>
      {quick && <QuickView media={media} open={quick} onOpenChange={setQuick} layoutId={reduced ? undefined : layoutId} />}
    </motion.article>
  );
}

export function AnimeCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="k-skeleton aspect-[2/3] w-full" />
      <div className="k-skeleton mt-3 h-3.5 w-4/5" />
      <div className="k-skeleton mt-2 h-3 w-1/2" />
    </div>
  );
}
