"use client";

import { useMemo, useState } from "react";
import type { MediaDetail } from "@/lib/anilist/types";
import { buildEpisodes } from "@/lib/episodes";
import { useLibrary } from "@/stores/library";
import { useNow } from "@/lib/hooks";
import { EpisodeGrid } from "./detail";
import { Skeleton } from "@/components/ui/primitives";

const PAGE = 24;

export function EpisodeBrowser({ media }: { media: MediaDetail }) {
  const now = useNow();
  const progress = useLibrary((s) => s.entries[media.id]?.progress ?? 0);
  const [filter, setFilter] = useState<"all" | "unwatched" | "watched">("all");
  const [range, setRange] = useState(0);
  const episodes = useMemo(() => (now ? buildEpisodes(media, Math.floor(now / 1000)) : []), [media, now]);
  if (!now) return <Skeleton className="mt-8 h-64" />;
  if (!episodes.length) return <p className="mt-8 text-muted">AniList doesn&apos;t list episodes for this title yet.</p>;
  const filtered = episodes.filter((e) => (filter === "all" ? true : filter === "watched" ? e.number <= progress : e.number > progress));
  const pages = Math.ceil(filtered.length / PAGE);
  const page = Math.min(range, Math.max(0, pages - 1));
  const resume = episodes.find((e) => e.number === progress + 1);

  return (
    <div className="mt-8">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["all", "unwatched", "watched"] as const).map((f) => (
          <button key={f} className="k-chip capitalize" aria-pressed={filter === f} onClick={() => (setFilter(f), setRange(0))}>
            {f}
          </button>
        ))}
        {resume && progress > 0 && (
          <button className="k-btn k-btn-outline k-btn-sm ml-auto" onClick={() => (setFilter("all"), setRange(Math.floor((resume.number - 1) / PAGE)))}>
            Jump to episode {resume.number}
          </button>
        )}
      </div>
      {pages > 1 && (
        <div className="scrollbar-none mb-5 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Episode ranges">
          {Array.from({ length: pages }, (_, i) => {
            const a = filtered[i * PAGE]?.number;
            const b = filtered[Math.min(filtered.length, (i + 1) * PAGE) - 1]?.number;
            return (
              <button key={i} role="tab" aria-selected={i === page} className="k-chip shrink-0 tabular-nums" data-active={i === page} onClick={() => setRange(i)}>
                {a}–{b}
              </button>
            );
          })}
        </div>
      )}
      <EpisodeGrid media={media} episodes={filtered.slice(page * PAGE, page * PAGE + PAGE)} progress={progress} />
    </div>
  );
}
