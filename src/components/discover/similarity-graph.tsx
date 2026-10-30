"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { useLibrary } from "@/stores/library";
import { pickSeed } from "@/lib/recommend";
import { useDebounced } from "@/lib/hooks";
import { useKazeMotion } from "@/lib/motion";
import { SafeImage } from "@/components/ui/primitives";
import { displayTitle } from "@/components/anime/anime-card";
import type { MediaCard } from "@/lib/anilist/types";
import { titleCase } from "@/lib/utils";

const DEFAULT_SEED = 1535; // Death Note — a well-connected starting point when the library is empty.

type Node = { media: MediaCard; kind: "rec" | "rel"; weight: number; label: string; x: number; y: number };

export function SimilarityGraph() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const entries = useLibrary((s) => s.entries);
  const seed = pickSeed(Object.values(entries));
  const id = Number(sp.get("id")) || seed?.mediaId || DEFAULT_SEED;
  const { reduced, m } = useKazeMotion();
  const [hover, setHover] = useState<Node | null>(null);
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 250);

  const { data, isLoading, isError } = useQuery({ queryKey: ["recommendations", id], queryFn: ({ signal }) => api.recommendations(id, signal) });
  const suggest = useQuery({ queryKey: ["suggest", dq], queryFn: ({ signal }) => api.suggest(dq, signal), enabled: dq.length >= 2 });

  const nodes = useMemo<Node[]>(() => {
    if (!data) return [];
    const recs = data.items.slice(0, 12);
    const rels = (data as unknown as { relations?: { relationType: string; node: MediaCard }[] }).relations?.slice(0, 6) ?? [];
    const maxR = Math.max(1, ...recs.map((r) => r.rating));
    const out: Node[] = [];
    recs.forEach((r, i) => {
      const a = (i / recs.length) * Math.PI * 2 - Math.PI / 2;
      const dist = 0.42 - (r.rating / maxR) * 0.12; // stronger links sit closer
      out.push({ media: r.media, kind: "rec", weight: r.rating / maxR, label: `${r.rating} fan votes`, x: 0.5 + Math.cos(a) * dist, y: 0.5 + Math.sin(a) * dist * 0.92 });
    });
    rels.forEach((r, i) => {
      const a = (i / Math.max(1, rels.length)) * Math.PI * 2 - Math.PI / 4;
      out.push({ media: r.node, kind: "rel", weight: 0.5, label: titleCase(r.relationType), x: 0.5 + Math.cos(a) * 0.18, y: 0.5 + Math.sin(a) * 0.17 });
    });
    return out;
  }, [data]);

  const go = (next: number) => router.push(`${pathname}?id=${next}`, { scroll: false });
  const center = data?.source;

  return (
    <div className="container-k pt-8">
      <p className="k-label text-primary-ink">AniList fan recommendations & relations</p>
      <h1 className="font-display text-title mt-2">Similarity Explorer</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Every link is real: outer nodes are titles AniList members recommend to fans of the centre (closer and thicker = more votes); inner nodes are sequels, prequels and other relations. Select a
        node to travel there.
      </p>

      <div className="relative mt-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="sim-q" className="sr-only">Choose a starting anime</label>
        <input id="sim-q" className="k-input !pl-9" placeholder="Start from any anime…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        {suggest.data && dq.length >= 2 && q && (
          <ul className="k-panel absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto !bg-surface p-1.5">
            {suggest.data.results.map((r) => (
              <li key={r.id}>
                <button className="flex w-full items-center gap-2 rounded-[min(var(--k-radius-btn),10px)] px-2.5 py-2 text-left text-sm hover:bg-[var(--k-btn-ghost)]" onClick={() => (go(r.id), setQ(""))}>
                  {r.title.english || r.title.userPreferred || r.title.romaji}
                  <span className="ml-auto text-xs text-muted">{r.seasonYear}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="k-card relative mt-6 aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10]" role="group" aria-label={center ? `Similarity graph for ${displayTitle(center)}` : "Similarity graph"}>
        {isLoading && <div className="absolute inset-0 grid place-items-center text-muted">Mapping connections…</div>}
        {isError && <div className="absolute inset-0 grid place-items-center text-danger">Couldn&apos;t load connections for this title.</div>}
        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <AnimatePresence>
            {nodes.map((n) => (
              <motion.line
                key={`${id}-${n.media.id}-${n.kind}`}
                x1={50}
                y1={50}
                x2={n.x * 100}
                y2={n.y * 100}
                stroke={n.kind === "rec" ? "var(--k-primary)" : "var(--k-accent)"}
                strokeWidth={n.kind === "rec" ? 0.15 + n.weight * 0.55 : 0.3}
                strokeDasharray={n.kind === "rel" ? "1 1" : undefined}
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: hover && hover.media.id !== n.media.id ? 0.15 : 0.7 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.7 }}
                style={{ strokeWidth: n.kind === "rec" ? 1 + n.weight * 4 : 1.5 }}
              />
            ))}
          </AnimatePresence>
        </svg>
        {center && (
          <motion.div key={`c-${id}`} className="absolute left-1/2 top-1/2 z-[2] w-[22%] max-w-[150px] -translate-x-1/2 -translate-y-1/2" initial={reduced ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={m.spring}>
            <Link href={`/anime/${center.id}`} className="k-poster relative block aspect-[2/3] shadow-[var(--k-shadow-pop)] ring-2 ring-primary">
              <SafeImage src={(center as { coverImage?: { large: string | null } }).coverImage?.large ?? ""} alt="" fill sizes="150px" className="object-cover" />
            </Link>
            <p className="mt-2 text-center text-xs font-semibold leading-tight">{displayTitle(center)}</p>
          </motion.div>
        )}
        <AnimatePresence>
          {nodes.map((n, i) => (
            <motion.button
              key={`${id}-${n.media.id}-${n.kind}-node`}
              type="button"
              className="absolute z-[3] w-[11%] max-w-[78px] -translate-x-1/2 -translate-y-1/2 focus-visible:z-[4]"
              style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, left: "50%", top: "50%" }}
              animate={{ opacity: 1, scale: hover?.media.id === n.media.id ? 1.12 : 1, left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={reduced ? { duration: 0.15 } : { ...m.spring, delay: i * 0.025 }}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              onClick={() => go(n.media.id)}
              aria-label={`${displayTitle(n.media)} — ${n.label}. Recentre graph`}
            >
              <span className={`k-poster relative block aspect-[2/3] ${n.kind === "rel" ? "ring-1 ring-accent" : ""}`}>
                <SafeImage src={n.media.coverImage.large ?? ""} alt="" fill sizes="78px" className="object-cover" />
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
        {hover && (
          <div className="k-panel pointer-events-none absolute bottom-3 left-3 right-3 z-[5] !bg-surface p-3 sm:right-auto sm:max-w-sm">
            <p className="text-sm font-semibold">{displayTitle(hover.media)}</p>
            <p className="text-xs text-muted">
              {hover.kind === "rec" ? "Recommended" : "Related"} · {hover.label} · {hover.media.genres.slice(0, 3).join(", ")}
            </p>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-6 bg-primary" /> Fan recommendation</span>
        <span className="inline-flex items-center gap-2"><span className="h-0 w-6 border-t border-dashed border-accent" /> Franchise relation</span>
        {center && (
          <Link href={`/anime/${center.id}`} className="ml-auto inline-flex items-center gap-1 font-semibold text-primary-ink">
            Open {displayTitle(center)} <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
