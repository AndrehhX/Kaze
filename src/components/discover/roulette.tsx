"use client";

import Link from "next/link";
import { animate, motion, useMotionValue } from "motion/react";
import { Dices, Loader2, RotateCw } from "lucide-react";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BrowseParams, MediaCard } from "@/lib/anilist/types";
import { api } from "@/lib/api-client";
import { FALLBACK_GENRES, FORMATS } from "@/lib/anilist/browse-params";
import { useLibrary } from "@/stores/library";
import { useKazeMotion } from "@/lib/motion";
import { SafeImage } from "@/components/ui/primitives";
import { ListMenu } from "@/components/anime/list-actions";
import { displayTitle, ScorePill } from "@/components/anime/anime-card";
import { cleanDescription, formatLabel } from "@/lib/utils";

const ITEM_H = 168;

/** Uniform pick: random page across the eligible result set, then a random item on it. */
export async function pickRandom(params: BrowseParams, exclude: Set<number>, rand = Math.random): Promise<{ winner: MediaCard | null; reel: MediaCard[]; total: number }> {
  const first = await api.browse({ ...params, page: 1 });
  const total = first.pageInfo.total;
  if (!total) return { winner: null, reel: [], total: 0 };
  // AniList caps deep pagination; sample from the first 5000 results.
  const lastPage = Math.max(1, Math.min(first.pageInfo.lastPage, Math.floor(5000 / first.pageInfo.perPage)));
  const page = 1 + Math.floor(rand() * lastPage);
  const data = page === 1 ? first : await api.browse({ ...params, page });
  const pool = data.media.filter((m) => !exclude.has(m.id));
  const candidates = pool.length ? pool : first.media.filter((m) => !exclude.has(m.id));
  if (!candidates.length) return { winner: null, reel: data.media, total };
  const winner = candidates[Math.floor(rand() * candidates.length)];
  return { winner, reel: [...data.media, ...first.media].filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i), total };
}

export function Roulette() {
  const [genre, setGenre] = useState("");
  const [format, setFormat] = useState("");
  const [minScore, setMinScore] = useState(65);
  const [skipLibrary, setSkipLibrary] = useState(true);
  const [state, setState] = useState<"idle" | "loading" | "spinning" | "done" | "empty" | "error">("idle");
  const [reel, setReel] = useState<MediaCard[]>([]);
  const [winner, setWinner] = useState<MediaCard | null>(null);
  const [total, setTotal] = useState(0);
  const y = useMotionValue(0);
  const { reduced } = useKazeMotion();
  const entries = useLibrary((s) => s.entries);
  const busy = useRef(false);

  const spin = async () => {
    if (busy.current) return;
    busy.current = true;
    setState("loading");
    try {
      const params: BrowseParams = { genres: genre ? [genre] : undefined, formats: format ? [format as never] : undefined, minScore: minScore || undefined, sort: "POPULARITY_DESC", perPage: 30 };
      const { winner, reel, total } = await pickRandom(params, skipLibrary ? new Set(Object.keys(entries).map(Number)) : new Set());
      setTotal(total);
      if (!winner) {
        setState("empty");
        return;
      }
      // Build a strip that ends on the winner, then decelerate onto it.
      const filler = reel.filter((m) => m.id !== winner.id);
      const strip = Array.from({ length: 28 }, (_, i) => filler[i % Math.max(1, filler.length)] ?? winner);
      strip.push(winner);
      setReel(strip);
      setWinner(winner);
      setState("spinning");
      y.set(0);
      const target = -(strip.length - 1) * ITEM_H;
      if (reduced) y.set(target);
      else await animate(y, target, { duration: 3.2, ease: [0.12, 0.8, 0.18, 1] });
      setState("done");
    } catch {
      setState("error");
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="container-k pt-8">
      <p className="k-label text-primary-ink">Leave it to fate</p>
      <h1 className="font-display text-title mt-2">Anime Roulette</h1>
      <p className="mt-3 max-w-2xl text-muted">Set a few limits, then spin. The pick is genuinely random across every AniList title that matches — no hidden promotion.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
        <form
          className="k-card space-y-4 self-start p-5"
          onSubmit={(e) => {
            e.preventDefault();
            spin();
          }}
        >
          <div>
            <label htmlFor="r-genre" className="text-sm font-semibold">Genre</label>
            <select id="r-genre" className="k-input mt-1.5" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">Any genre</option>
              {FALLBACK_GENRES.filter((g) => g !== "Ecchi").map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="r-format" className="text-sm font-semibold">Format</label>
            <select id="r-format" className="k-input mt-1.5" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Any format</option>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="r-score" className="text-sm font-semibold">Minimum score · {minScore}%</label>
            <input id="r-score" type="range" min={0} max={90} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="mt-2 w-full accent-[var(--k-primary)]" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skipLibrary} onChange={(e) => setSkipLibrary(e.target.checked)} className="accent-[var(--k-primary)]" /> Skip titles already in my library
          </label>
          <button className="k-btn k-btn-primary w-full !min-h-12 text-base" disabled={state === "loading" || state === "spinning"}>
            {state === "loading" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Dices className="size-5" aria-hidden />}
            {state === "done" ? "Spin again" : "Spin"}
          </button>
          {total > 0 && <p className="text-center text-xs text-muted">{total.toLocaleString()} eligible titles</p>}
        </form>

        <div className="grid items-center gap-8 md:grid-cols-[220px_1fr]">
          <div className="k-card relative mx-auto h-[504px] w-[200px] overflow-hidden" aria-hidden>
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[2] h-[168px] -translate-y-1/2 border-y-2 border-primary shadow-[0_0_40px_-10px_var(--k-primary)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-1/3 bg-gradient-to-b from-surface to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1/3 bg-gradient-to-t from-surface to-transparent" />
            <motion.div style={{ y }} className="absolute inset-x-0 top-[168px]">
              {(reel.length ? reel : Array.from({ length: 3 })).map((m, i) => (
                <div key={i} className="flex h-[168px] items-center justify-center p-2">
                  <div className="k-poster relative h-full aspect-[2/3]">
                    {m ? <SafeImage src={(m as MediaCard).coverImage.large ?? ""} alt="" fill sizes="110px" className="object-cover" /> : <div className="grid size-full place-items-center text-3xl text-muted">?</div>}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          <div aria-live="polite" className="min-h-48">
            {state === "idle" && <p className="text-muted">Your next obsession is one spin away.</p>}
            {state === "empty" && <p className="text-muted">Nothing matches those limits. Loosen them and spin again.</p>}
            {state === "error" && <p className="text-danger">The catalog didn&apos;t answer. Try again in a moment.</p>}
            {state === "spinning" && <p className="k-label animate-pulse text-primary-ink">Spinning…</p>}
            {state === "done" && winner && (
              <motion.div initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <p className="k-label text-primary-ink">Fate chose</p>
                <h2 className="font-display text-title mt-2">{displayTitle(winner)}</h2>
                <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                  <ScorePill score={winner.averageScore} className="text-fg" />
                  <span>{formatLabel(winner.format)}</span>
                  {winner.episodes && <span>{winner.episodes} episodes</span>}
                  {winner.seasonYear && <span>{winner.seasonYear}</span>}
                  <span>{winner.genres.slice(0, 3).join(", ")}</span>
                </p>
                <RouletteBlurb id={winner.id} />
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/anime/${winner.id}`} className="k-btn k-btn-primary">Open title</Link>
                  <ListMenu media={winner} />
                  <button className="k-btn k-btn-ghost" onClick={spin}>
                    <RotateCw className="size-4" aria-hidden /> Spin again
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RouletteBlurb({ id }: { id: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["media", id], queryFn: ({ signal }) => api.media(id, signal) });
  if (isLoading) return <div className="k-skeleton mt-4 h-16 max-w-xl" />;
  const text = cleanDescription(data?.media.description);
  return text ? <p className="clamp-3 mt-4 max-w-xl text-sm leading-relaxed text-fg/85">{text}</p> : null;
}
