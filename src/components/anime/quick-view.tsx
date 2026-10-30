"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, Clapperboard } from "lucide-react";
import type { MediaCard } from "@/lib/anilist/types";
import { api } from "@/lib/api-client";
import { cleanDescription, formatLabel, statusLabel } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { SafeImage, Skeleton } from "@/components/ui/primitives";
import { FavoriteButton, ListMenu } from "./list-actions";
import { displayTitle, ScorePill } from "./anime-card";

/** "Anime Card Expansion" — the poster flies from the card into this preview (shared layoutId). */
export function QuickView({ media, open, onOpenChange, layoutId }: { media: MediaCard; open: boolean; onOpenChange: (o: boolean) => void; layoutId?: string }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ["media", media.id], queryFn: ({ signal }) => api.media(media.id, signal), enabled: open });
  const d = data?.media;
  const title = displayTitle(media);
  const studio = d?.allStudios.edges.find((e) => e.isMain)?.node.name ?? media.studios.nodes[0]?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} hideTitle className="w-[min(94vw,760px)]">
      <div className="relative h-36 overflow-hidden sm:h-44" style={{ background: media.coverImage.color ?? "var(--k-elevated)" }}>
        {(d?.bannerImage ?? media.bannerImage) && <SafeImage src={(d?.bannerImage ?? media.bannerImage)!} alt="" fill sizes="760px" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
      </div>
      <div className="relative -mt-20 grid gap-5 px-5 pb-6 sm:grid-cols-[150px_1fr]">
        <motion.div layoutId={layoutId} className="k-poster relative aspect-[2/3] w-28 sm:w-full">
          <SafeImage src={media.coverImage.extraLarge || media.coverImage.large || ""} alt="" fill sizes="150px" className="object-cover" fallbackLabel={title} />
        </motion.div>
        <div className="min-w-0 pt-2 sm:pt-16">
          <h2 className="font-display text-2xl leading-tight">{title}</h2>
          {media.title.native && (
            <p className="k-jp mt-1 text-sm text-muted" lang="ja">
              {media.title.native}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <ScorePill score={media.averageScore} className="text-fg" />
            {[formatLabel(media.format), media.episodes ? `${media.episodes} episodes` : null, statusLabel(media.status), media.seasonYear, studio]
              .filter(Boolean)
              .map((x) => (
                <span key={String(x)} className="before:mr-2 before:content-['·'] first:before:hidden">
                  {x}
                </span>
              ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {media.genres.map((g) => (
              <Link key={g} href={`/discover?genres=${encodeURIComponent(g)}`} className="k-chip" onClick={() => onOpenChange(false)}>
                {g}
              </Link>
            ))}
          </div>
          <div className="mt-4 text-sm leading-relaxed text-fg/85">
            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            )}
            {isError && <p className="text-muted">Couldn&apos;t load the synopsis right now.</p>}
            {d && <p className="clamp-3 whitespace-pre-line sm:[-webkit-line-clamp:5]">{cleanDescription(d.description) || "No synopsis on AniList yet."}</p>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href={`/anime/${media.id}`} className="k-btn k-btn-primary" onClick={() => onOpenChange(false)}>
              Open title <ArrowRight className="size-4" aria-hidden />
            </Link>
            <ListMenu media={media} />
            <FavoriteButton media={media} />
            {d?.trailer?.site === "youtube" && (
              <Link href={`/anime/${media.id}#trailer`} className="k-btn k-btn-ghost" onClick={() => onOpenChange(false)}>
                <Clapperboard className="size-4" aria-hidden /> Trailer
              </Link>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
