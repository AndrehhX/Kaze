"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, ChevronLeft, ChevronRight, LayoutList, Rotate3d } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cn, hashString } from "@/lib/utils";
import { genreLabel } from "@/lib/anilist/browse-params";
import { useKazeMotion } from "@/lib/motion";
import { MangaFavoriteButton, MangaListMenu, type MangaRef } from "../library-actions";
import { InkScore } from "../cards";

/**
 * THE MANGA VAULT — a collector's shelf rendered with CSS 3D transforms (no WebGL needed):
 * every title is a physical volume whose spine faces the viewer; the selected one slides forward,
 * turns its cover toward you and the room takes on the colour of its artwork.
 * Only a window of volumes around the selection is mounted, and only nearby covers load full size.
 */

export type VaultItem = {
  key: string;
  id: number;
  title: string;
  titleNative: string | null;
  author: string | null;
  cover: string | null;
  coverSmall: string | null;
  color: string | null;
  href: string;
  readHref?: string | null;
  genres: string[];
  score: number | null;
  meta: string;
  volumes: number | null;
  ref: MangaRef;
};

const WINDOW = 13;
const COVER_W = { desktop: 190, mobile: 150 };

function thicknessFor(item: VaultItem, base: number) {
  // Thickness follows the real number of volumes when AniList knows it; otherwise a neutral width.
  const v = item.volumes ?? 6;
  return Math.round(Math.min(base * 1.55, Math.max(base * 0.8, base * 0.8 + v * 0.55)));
}

function readable(hex: string | null) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return { bg: "#2a2a35", fg: "#ffffff" };
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { bg: hex, fg: lum > 0.62 ? "#141414" : "#ffffff" };
}

function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 640px)");
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return compact;
}

/** Lite mode for low-power devices: fewer faces, no blur. Decided once on mount. */
function useLite() {
  const [lite, setLite] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    setLite((nav.hardwareConcurrency ?? 8) <= 4 && (nav.deviceMemory ?? 8) <= 4);
  }, []);
  return lite;
}

type VaultProps = {
  items: VaultItem[];
  label: string;
  selected: number;
  onSelect: (index: number) => void;
  /** While true (randomizer), user input is ignored and the info panel waits. */
  spinning?: boolean;
  /** Extra actions in the info panel (randomizer accept/spin again). */
  actions?: (item: VaultItem) => ReactNode;
  emptyState?: ReactNode;
  className?: string;
  showListToggle?: boolean;
};

export function MangaVault({ items, label, selected, onSelect, spinning, actions, emptyState, className, showListToggle = true }: VaultProps) {
  const { reduced, theme } = useKazeMotion();
  const compact = useCompact();
  const lite = useLite();
  const [inspect, setInspect] = useState(false);
  const [view, setView] = useState<"shelf" | "list">("shelf");
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; t: number; acc: number; moved: boolean; vx: number } | null>(null);
  const wheelAt = useRef(0);
  const justDragged = useRef(false);
  const listId = useId();
  const W = compact ? COVER_W.mobile : COVER_W.desktop;
  const H = Math.round(W * 1.5);
  const sel = Math.max(0, Math.min(items.length - 1, selected));
  const current = items[sel];
  const tone = readable(current?.color ?? null);

  const go = useCallback(
    (delta: number) => {
      if (spinning || !items.length) return;
      setInspect(false);
      onSelect(Math.max(0, Math.min(items.length - 1, sel + delta)));
    },
    [items.length, onSelect, sel, spinning],
  );

  useEffect(() => setInspect(false), [sel]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (spinning) return;
    const map: Record<string, () => void> = {
      ArrowRight: () => go(1),
      ArrowLeft: () => go(-1),
      Home: () => onSelect(0),
      End: () => onSelect(items.length - 1),
      PageDown: () => go(5),
      PageUp: () => go(-5),
      " ": () => setInspect((v) => !v),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    } else if (e.key === "Enter" && current) {
      window.location.assign(current.href);
    }
  };

  // Drag/swipe: every ~42px of travel flips one volume; release velocity adds momentum.
  const onPointerDown = (e: React.PointerEvent) => {
    if (spinning) return;
    justDragged.current = false;
    drag.current = { x: e.clientX, t: performance.now(), acc: 0, moved: false, vx: 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const dx = e.clientX - d.x;
    d.vx = dx / Math.max(1, now - d.t);
    d.x = e.clientX;
    d.t = now;
    d.acc += dx;
    if (Math.abs(d.acc) > 6) d.moved = true;
    const step = compact ? 34 : 42;
    while (Math.abs(d.acc) >= step) {
      go(d.acc > 0 ? -1 : 1);
      d.acc += d.acc > 0 ? -step : step;
    }
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    justDragged.current = Boolean(d?.moved);
    if (!d || !d.moved || reduced) return;
    const extra = Math.round(Math.min(6, Math.abs(d.vx) * 4));
    if (extra > 0) go(d.vx > 0 ? -extra : extra);
  };
  const onWheel = (e: React.WheelEvent) => {
    // Only horizontal intent (trackpad swipe or Shift+wheel) — never hijack normal page scrolling.
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (!dx || spinning) return;
    const now = performance.now();
    if (now - wheelAt.current < 70) return;
    wheelAt.current = now;
    go(dx > 0 ? 1 : -1);
  };

  const positions = useMemo(() => {
    const out: { i: number; d: number; x: number; z: number; rotateY: number; scale: number; T: number; h: number }[] = [];
    const gap = compact ? 4 : 6;
    for (let i = Math.max(0, sel - WINDOW); i <= Math.min(items.length - 1, sel + WINDOW); i++) {
      const d = i - sel;
      const it = items[i];
      const T = thicknessFor(it, compact ? 26 : 32);
      const h = H * (0.93 + ((hashString(it.key) % 7) / 100)); // printed volumes vary slightly in height
      let x = 0;
      if (d !== 0) {
        const sign = Math.sign(d);
        let acc = W / 2 + (compact ? 22 : 46);
        for (let k = 1; k < Math.abs(d); k++) acc += thicknessFor(items[sel + sign * k], compact ? 26 : 32) + gap;
        x = sign * (acc + T / 2);
      }
      const selectedRot = inspect ? 26 : 0; // turn the volume to show its spine
      const rotateY = d === 0 ? selectedRot : d > 0 ? 90 - Math.min(10, d * 1.6) : 90 + Math.min(10, -d * 1.6);
      out.push({ i, d, x, z: d === 0 ? (compact ? 70 : 150) : -Math.min(40, Math.abs(d) * 3), rotateY, scale: d === 0 ? 1 : 0.96, T, h });
    }
    return out;
  }, [H, W, compact, inspect, items, sel]);

  const spring = reduced ? { duration: 0 } : spinning ? { type: "spring" as const, stiffness: 520, damping: 42 } : { type: "spring" as const, stiffness: 190, damping: 26, mass: 0.9 };

  if (!items.length) return <>{emptyState}</>;

  return (
    <div className={cn("relative", className)}>
      {showListToggle && (
        <div className="mb-3 flex justify-end gap-2">
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" aria-pressed={view === "list"} onClick={() => setView((v) => (v === "shelf" ? "list" : "shelf"))}>
            {view === "shelf" ? <LayoutList className="size-4" aria-hidden /> : <Rotate3d className="size-4" aria-hidden />}
            {view === "shelf" ? "Vista de lista" : "Vista de estantería"}
          </button>
        </div>
      )}

      {view === "list" ? (
        <ol className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3" aria-label={label}>
          {items.map((it, i) => (
            <li key={it.key} className={cn("flex items-center gap-3 border-b border-line py-2.5", i === sel && "bg-[var(--k-btn-ghost)]")}>
              <span className="km-number w-7 text-right text-lg text-muted">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.coverSmall ? <img src={it.coverSmall} alt="" className="h-16 w-11 shrink-0 object-cover" loading="lazy" /> : <span className="h-16 w-11 shrink-0 bg-elevated" />}
              <div className="min-w-0 flex-1">
                <Link href={it.href} className="block truncate font-semibold hover:text-primary-ink" onFocus={() => onSelect(i)}>
                  {it.title}
                </Link>
                <p className="truncate text-xs text-muted">{[it.author, it.meta].filter(Boolean).join(" · ")}</p>
              </div>
              <InkScore score={it.score} />
            </li>
          ))}
        </ol>
      ) : (
        <>
          {/* Room light picks up the selected cover's colour */}
          <motion.div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-[115%]" animate={{ backgroundColor: tone.bg }} transition={{ duration: reduced ? 0 : 0.9 }} style={{ opacity: theme === "zen" ? 0.12 : 0.2, filter: lite ? undefined : "blur(70px)", borderRadius: "50%" }} />
          <div
            ref={stage}
            role="listbox"
            aria-label={`${label}. Usa las flechas para recorrer la estantería, Intro para abrir y Espacio para examinar.`}
            aria-activedescendant={current ? `${listId}-${sel}` : undefined}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
            className="km-stage relative mx-auto touch-pan-y select-none overflow-hidden outline-none"
            style={{ height: H + (compact ? 120 : 150), perspective: compact ? 1100 : 1500, perspectiveOrigin: "50% 38%", cursor: spinning ? "progress" : "grab" }}
          >
            <div className="km-3d absolute left-1/2 top-[44px]" style={{ height: H }}>
              {positions.map(({ i, d, x, z, rotateY, scale, T, h }) => {
                const it = items[i];
                const near = Math.abs(d) <= 2;
                const sp = readable(it.color);
                return (
                  <motion.div
                    key={it.key}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={d === 0}
                    aria-label={`${it.title}${it.author ? `, de ${it.author}` : ""}`}
                    className="km-3d absolute bottom-0"
                    style={{ width: W, height: h, left: -W / 2, zIndex: 100 - Math.abs(d) }}
                    initial={false}
                    animate={{ x, z, rotateY, scale }}
                    transition={spring}
                    onClick={() => {
                      if (justDragged.current || spinning) {
                        justDragged.current = false;
                        return;
                      }
                      if (d === 0) setInspect((v) => !v);
                      else onSelect(i);
                    }}
                  >
                    {/* cover */}
                    <div className="km-face inset-0 overflow-hidden" style={{ transform: `translateZ(${T / 2}px)`, background: sp.bg, boxShadow: d === 0 ? "0 40px 60px -24px rgb(0 0 0 / 0.75)" : undefined, borderRadius: theme === "sakura" ? 6 : theme === "midnight" ? 3 : 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {(near ? it.cover : it.coverSmall) && <img src={(near ? it.cover : it.coverSmall)!} alt="" draggable={false} loading={near ? "eager" : "lazy"} decoding="async" className="size-full object-cover" />}
                      <span aria-hidden className="absolute inset-y-0 left-0 w-[8%]" style={{ background: "var(--km-spine-shade)" }} />
                    </div>
                    {/* spine (faces the viewer on the shelf) */}
                    <div
                      className="km-face top-0 flex flex-col items-center justify-between overflow-hidden py-3"
                      style={{ width: T, height: h, left: W / 2 - T / 2, transform: `rotateY(-90deg) translateZ(${W / 2}px)`, background: `linear-gradient(90deg, rgb(0 0 0 / 0.28), transparent 30%, transparent 70%, rgb(0 0 0 / 0.32)), ${sp.bg}`, color: sp.fg }}
                    >
                      {!lite && it.coverSmall && <span aria-hidden className="absolute inset-0 opacity-25 mix-blend-luminosity" style={{ backgroundImage: `url(${it.coverSmall})`, backgroundSize: "cover", backgroundPosition: "20% center" }} />}
                      <span className="relative text-[0.55rem] font-bold tracking-widest opacity-80">{it.volumes ? `${it.volumes}` : "·"}</span>
                      <span className="km-vertical relative line-clamp-1 max-h-[78%] overflow-hidden text-ellipsis whitespace-nowrap font-display text-[0.8rem] font-bold leading-none" style={{ letterSpacing: "0.04em" }}>
                        {it.titleNative && theme === "zen" ? it.titleNative : it.title}
                      </span>
                      <span className="relative text-[0.55rem] font-black tracking-[0.2em] opacity-70">風</span>
                    </div>
                    {!lite && (
                      <>
                        {/* page block */}
                        <div className="km-face top-[3px]" style={{ width: T - 4, height: h - 6, left: W / 2 - (T - 4) / 2, transform: `rotateY(90deg) translateZ(${W / 2 - 2}px)`, background: "var(--km-page-edge)" }} />
                        {/* top edge */}
                        <div className="km-face left-0" style={{ width: W, height: T, top: -T / 2, transform: `rotateX(90deg)`, background: "var(--km-page-edge)", opacity: 0.85 }} />
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>
            {/* the shelf plank */}
            <div aria-hidden className="km-shelf absolute inset-x-0" style={{ top: 44 + H, height: compact ? 70 : 90 }}>
              <div className="km-shelf-edge h-[2px] w-full" />
            </div>
            <div aria-hidden className={cn("absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg to-transparent", theme === "zen" && "w-10")} />
            <div aria-hidden className={cn("absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg to-transparent", theme === "zen" && "w-10")} />
            <button type="button" aria-label="Volumen anterior" onClick={() => go(-1)} disabled={sel === 0 || spinning} className="k-btn k-btn-icon k-panel absolute left-3 top-[42%] z-[120] -translate-y-1/2 disabled:opacity-0">
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" aria-label="Volumen siguiente" onClick={() => go(1)} disabled={sel === items.length - 1 || spinning} className="k-btn k-btn-icon k-panel absolute right-3 top-[42%] z-[120] -translate-y-1/2 disabled:opacity-0">
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <p className="absolute bottom-3 left-1/2 z-[120] -translate-x-1/2 font-mono text-[0.6875rem] tabular-nums text-muted" aria-hidden>
              {String(sel + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
            </p>
          </div>

          <VaultInfo item={current} hidden={Boolean(spinning)} actions={actions} inspect={inspect} />
        </>
      )}
    </div>
  );
}

function VaultInfo({ item, hidden, actions, inspect }: { item: VaultItem | undefined; hidden: boolean; actions?: (item: VaultItem) => ReactNode; inspect: boolean }) {
  const { reduced, m } = useKazeMotion();
  return (
    <div className="relative mx-auto mt-6 min-h-48 max-w-3xl text-center" aria-live="polite">
      <AnimatePresence mode="wait">
        {item && !hidden && (
          <motion.div key={item.key} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.15 } }} variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.06 } } }}>
            {item.titleNative && (
              <motion.p variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} className="k-jp text-sm text-primary-ink" lang="ja">
                {item.titleNative}
              </motion.p>
            )}
            <motion.h3
              variants={{ hidden: reduced ? { opacity: 0 } : { clipPath: "inset(0 100% 0 0)", opacity: 1 }, show: { clipPath: "inset(0 0% 0 0)", opacity: 1, transition: { duration: reduced ? 0.2 : 0.7, ease: m.ease } } }}
              className="km-title mt-1 text-[clamp(1.6rem,1.1rem+2vw,2.8rem)]"
            >
              {item.title}
            </motion.h3>
            <motion.p variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="mt-2 text-sm text-muted">
              {[item.author, item.meta].filter(Boolean).join(" · ")}
              {item.score ? (
                <>
                  {" · "}
                  <InkScore score={item.score} />
                </>
              ) : null}
            </motion.p>
            {inspect && item.genres.length > 0 && (
              <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex flex-wrap justify-center gap-1.5">
                {item.genres.slice(0, 5).map((g) => (
                  <li key={g} className="k-chip">
                    {genreLabel(g)}
                  </li>
                ))}
              </motion.ul>
            )}
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {actions?.(item)}
              {item.readHref && (
                <Link href={item.readHref} className="k-btn k-btn-primary">
                  <BookOpen className="size-4" aria-hidden /> Leer
                </Link>
              )}
              <Link href={item.href} className={cn("k-btn", item.readHref || actions ? "k-btn-outline" : "k-btn-primary")}>
                Ver ficha
              </Link>
              <MangaListMenu manga={item.ref} />
              <MangaFavoriteButton manga={item.ref} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
