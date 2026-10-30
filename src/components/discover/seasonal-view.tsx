"use client";

import { useMemo, useState } from "react";
import type { MediaCard } from "@/lib/anilist/types";
import { AnimeCard, displayTitle } from "@/components/anime/anime-card";
import { EmptyState } from "@/components/ui/primitives";
import { formatLabel } from "@/lib/utils";
import { useMounted } from "@/lib/hooks";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Sort = "popularity" | "score" | "title" | "day";

export function SeasonalView({ media, total }: { media: MediaCard[]; total: number }) {
  const [sort, setSort] = useState<Sort>("popularity");
  const [format, setFormat] = useState<string>("ALL");
  const mounted = useMounted();
  const formats = useMemo(() => ["ALL", ...new Set(media.map((m) => m.format).filter(Boolean) as string[])], [media]);
  const list = useMemo(() => {
    const l = media.filter((m) => format === "ALL" || m.format === format);
    if (sort === "score") l.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));
    else if (sort === "title") l.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)));
    else if (sort === "popularity") l.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    return l;
  }, [media, sort, format]);

  // Air day uses the viewer's local time zone, so it's computed only after mount.
  const byDay = useMemo(() => {
    if (sort !== "day" || !mounted) return null;
    const groups: Record<string, MediaCard[]> = {};
    for (const m of list) {
      const key = m.nextAiringEpisode ? DAYS[new Date(m.nextAiringEpisode.airingAt * 1000).getDay()] : "Not currently airing";
      (groups[key] ??= []).push(m);
    }
    const today = new Date().getDay();
    const order = [...DAYS.slice(today), ...DAYS.slice(0, today), "Not currently airing"];
    return order.filter((d) => groups[d]).map((d) => ({ day: d, items: groups[d].sort((a, b) => (a.nextAiringEpisode?.airingAt ?? 0) - (b.nextAiringEpisode?.airingAt ?? 0)) }));
  }, [list, sort, mounted]);

  if (!media.length) return <EmptyState className="mt-10" title="No titles announced for this season yet" body="AniList hasn't listed anything here. Check back closer to the season." />;

  const grid = (items: MediaCard[]) => (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((m) => (
        <li key={m.id}>
          <AnimeCard media={m} layoutScope="seasonal" />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Format">
          {formats.map((f) => (
            <button key={f} className="k-chip" aria-pressed={format === f} onClick={() => setFormat(f)}>
              {f === "ALL" ? "All formats" : formatLabel(f)}
            </button>
          ))}
        </div>
        <label htmlFor="season-sort" className="sr-only">Sort</label>
        <select id="season-sort" className="k-input ml-auto !min-h-9 w-auto text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="popularity">Popularity</option>
          <option value="score">Score</option>
          <option value="title">Title</option>
          <option value="day">Air day</option>
        </select>
        <span className="text-sm text-muted">{total} titles</span>
      </div>
      {byDay
        ? byDay.map((g) => (
            <section key={g.day} aria-labelledby={`day-${g.day}`} className="mb-12">
              <h2 id={`day-${g.day}`} className="font-display mb-4 flex items-center gap-3 text-xl">
                {g.day} <span className="k-rule flex-1" aria-hidden />
              </h2>
              {grid(g.items)}
            </section>
          ))
        : grid(list)}
    </div>
  );
}
