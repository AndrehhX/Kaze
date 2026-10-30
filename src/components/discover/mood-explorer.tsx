"use client";

import { useQueries } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Info } from "lucide-react";
import { useState } from "react";
import { MOODS, mergeMoodResults, moodById } from "@/lib/moods";
import { api } from "@/lib/api-client";
import { AnimeCard } from "@/components/anime/anime-card";
import { GridSkeleton } from "@/components/anime/skeletons";
import { EmptyState, ErrorPanel } from "@/components/ui/primitives";
import { useKazeMotion } from "@/lib/motion";
import { useLibrary } from "@/stores/library";
import { cn } from "@/lib/utils";

export function MoodExplorer() {
  const [selected, setSelected] = useState<string[]>([]);
  const [hideLibrary, setHideLibrary] = useState(true);
  const { reduced, m } = useKazeMotion();
  const entries = useLibrary((s) => s.entries);

  const results = useQueries({
    queries: selected.map((id) => ({
      queryKey: ["mood", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.browse({ ...moodById(id)!.query, perPage: 30 }, signal),
      staleTime: 30 * 60_000,
    })),
  });
  const loading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.isError)?.error as Error | undefined;
  const merged = mergeMoodResults(results.map((r, i) => ({ moodId: selected[i], items: r.data?.media ?? [] }))).filter((x) => !hideLibrary || !entries[x.item.id]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? [...s.slice(1), id] : [...s, id]));

  return (
    <div className="container-k pt-8">
      <p className="k-label text-primary-ink">Discover by feeling</p>
      <h1 className="font-display text-title mt-2">Mood Explorer</h1>
      <p className="mt-3 max-w-2xl text-muted">Pick up to three moods. Each one maps to specific AniList genres and tags — shown on every card — so you always know why something appeared.</p>

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Moods">
        {MOODS.map((mood, i) => {
          const on = selected.includes(mood.id);
          return (
            <li key={mood.id}>
              <motion.button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(mood.id)}
                whileHover={reduced ? undefined : { y: -4 }}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                transition={m.spring}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0, transition: { delay: reduced ? 0 : i * 0.04 } }}
                className={cn("k-card relative flex aspect-[4/3] w-full flex-col justify-end overflow-hidden p-4 text-left transition-shadow", on && "shadow-[var(--k-hover-glow)]")}
                style={{ background: `linear-gradient(150deg, hsl(${mood.hue} 80% 60% / ${on ? 0.55 : 0.22}), var(--k-surface) 75%)` }}
              >
                <span className="k-jp pointer-events-none absolute -right-1 -top-3 text-6xl font-bold opacity-15" lang="ja" aria-hidden>
                  {mood.jp}
                </span>
                <span className="font-display text-xl">{mood.label}</span>
                <span className="mt-1 text-xs text-muted">{mood.blurb}</span>
                {on && <span className="absolute left-3 top-3 rounded-[var(--k-radius-chip)] bg-fg px-2 py-0.5 text-[0.625rem] font-bold uppercase text-bg">Selected</span>}
              </motion.button>
            </li>
          );
        })}
      </ul>

      {selected.length > 0 && (
        <div className="mt-6 flex flex-wrap items-start gap-3 rounded-[var(--k-radius-card)] border border-line p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
          <div className="flex-1 space-y-1">
            {selected.map((id) => (
              <p key={id}>
                <strong>{moodById(id)!.label}</strong> <span className="text-muted">→ {moodById(id)!.rule}</span>
              </p>
            ))}
            <p className="text-xs text-muted">Titles matching more of your moods rank first.</p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={hideLibrary} onChange={(e) => setHideLibrary(e.target.checked)} className="accent-[var(--k-primary)]" /> Hide titles in my library
          </label>
        </div>
      )}

      <div className="mt-8" aria-live="polite">
        {!selected.length && <EmptyState jp="気" title="How do you want to feel tonight?" body="Choose a mood above to start." />}
        {loading && <GridSkeleton count={12} />}
        {error && <ErrorPanel title="Couldn't load mood picks" message={error.message} />}
        {!loading && !error && selected.length > 0 && (
          merged.length ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {merged.slice(0, 48).map(({ item, moods }) => (
                <li key={item.id}>
                  <AnimeCard media={item} layoutScope="mood" caption={moods.map((x) => moodById(x)!.label).join(" + ")} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="You've seen everything here" body="Every match is already in your library. Untick “Hide titles in my library” or try another mood." />
          )
        )}
      </div>
    </div>
  );
}
