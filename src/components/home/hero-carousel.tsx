"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Clapperboard, Pause, Play, Tv } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaHero } from "@/lib/anilist/types";
import { cleanDescription, cn, formatLabel, statusLabel, genreLabel } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";
import { ListMenu } from "@/components/anime/list-actions";
import { displayTitle, ScorePill } from "@/components/anime/anime-card";
import { TrailerDialog } from "@/components/anime/trailer-dialog";

const SLIDE_MS = 8000;

export function HeroCarousel({ items, kickerPrefix, trendingIds }: { items: MediaHero[]; kickerPrefix: string; trendingIds: number[] }) {
  const kicker = (i: number) => {
    const rank = trendingIds.indexOf(items[i]?.id);
    return rank >= 0 ? `Tendencia #${rank + 1} · ${kickerPrefix}` : `Popular · ${kickerPrefix}`;
  };
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [trailer, setTrailer] = useState<MediaHero | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  const { reduced, theme, m } = useKazeMotion();
  const regionRef = useRef<HTMLElement>(null);
  const count = items.length;
  const item = items[index];
  const stopped = paused || userPaused || Boolean(trailer) || reduced;

  const go = useCallback(
    (i: number) => {
      setIndex(((i % count) + count) % count);
      setProgressKey((k) => k + 1);
    },
    [count],
  );

  useEffect(() => {
    if (stopped || count < 2) return;
    const t = setTimeout(() => go(index + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, stopped, count, go, progressKey]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!item) return null;
  const title = displayTitle(item);
  const desc = cleanDescription(item.description);
  const studio = item.studios.nodes[0]?.name;
  const words = title.split(" ");
  const tint = item.coverImage.color ?? "var(--k-primary)";

  const titleLen = title.length;
  const titleSizeClass =
    titleLen > 40
      ? "text-2xl sm:text-3xl md:text-4xl xl:text-[2.75rem] leading-[1.08]"
      : titleLen > 24
        ? "text-3xl sm:text-4xl md:text-5xl xl:text-6xl leading-[1.02]"
        : "text-4xl sm:text-5xl md:text-6xl xl:text-hero leading-[0.95]";

  const titleVariants = {
    hidden: reduced ? { opacity: 0 } : theme === "cyber" ? { opacity: 0, x: -20, clipPath: "inset(0 100% 0 0)" } : theme === "zen" ? { opacity: 0 } : { opacity: 0, y: "70%" },
    show: (i: number) => ({
      opacity: 1,
      x: 0,
      y: 0,
      clipPath: "inset(0 0% 0 0)",
      transition: { delay: reduced ? 0 : 0.15 + i * (theme === "zen" ? 0.09 : 0.05), duration: reduced ? 0.2 : m.duration, ease: m.ease },
    }),
  };

  return (
    <section
      ref={regionRef}
      aria-roledescription="carrusel"
      aria-label="Anime destacado"
      translate="no"
      suppressHydrationWarning
      className="relative -mt-[var(--k-nav-h)] h-[min(90svh,800px)] min-h-[640px] max-h-[820px] overflow-hidden notranslate flex flex-col justify-between"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !regionRef.current?.contains(e.relatedTarget as Node) && setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      {/* Background layers */}
      <div className="absolute inset-0" aria-hidden>
        <AnimatePresence initial={false}>
          <motion.div
            key={item.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: reduced ? 1 : 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.2 : 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {item.bannerImage ? (
              <Image src={item.bannerImage} alt="" fill priority={index === 0} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} sizes="100vw" className={cn("object-cover object-[50%_30%]", theme === "zen" && "saturate-[0.85]")} unoptimized />
            ) : (
              <Image src={item.coverImage.extraLarge ?? ""} alt="" fill priority={index === 0} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} sizes="100vw" className="scale-125 object-cover blur-2xl" unoptimized />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 transition-colors duration-1000" style={{ background: `radial-gradient(ellipse at 75% 40%, ${tint}33, transparent 60%)` }} />
        <div className="absolute inset-0" style={{ background: "var(--k-hero-overlay)" }} />
        {/* Narrow screens stack text over the art: extend the scrim so copy stays readable. */}
        <div className="absolute inset-x-0 bottom-0 h-[78%] bg-gradient-to-t from-bg via-bg/85 to-transparent md:hidden" />
        {theme === "cyber" && <div className="k-scanlines opacity-70" />}
        {theme === "zen" && <div className="absolute bottom-0 left-0 top-0 w-[46%] border-r border-[#1d1d1d]/15 max-md:hidden" />}
      </div>

      <div className="container-k relative grid h-full grid-cols-12 items-center gap-6 pb-28 sm:pb-32 pt-[calc(var(--k-nav-h)+1.5rem)]">
        <div className="col-span-12 md:col-span-7 xl:col-span-7 min-h-[360px] max-h-[540px] flex flex-col justify-center" aria-live={stopped ? "polite" : "off"}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={item.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${index + 1} de ${count}: ${title}`}
              translate="no"
              suppressHydrationWarning
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.2 } }}
            >
              <motion.p variants={titleVariants} custom={0} className="k-label mb-2 flex items-center gap-3 text-primary-ink" suppressHydrationWarning>
                <span className="h-px w-8 bg-current" aria-hidden />
                {kicker(index)}
              </motion.p>
              <h1
                className={cn(
                  "font-display text-balance-k max-w-2xl xl:max-w-3xl line-clamp-2 overflow-hidden break-words",
                  titleSizeClass,
                )}
                title={title}
                suppressHydrationWarning
              >
                {words.map((w, i) => (
                  <span key={i} className="-mb-[0.1em] inline-block overflow-hidden pb-[0.18em] align-bottom">
                    <motion.span className="inline-block" variants={titleVariants} custom={i + 1}>
                      {w}&nbsp;
                    </motion.span>
                  </span>
                ))}
              </h1>
              {item.title.native && (
                <motion.p
                  variants={titleVariants}
                  custom={words.length + 1}
                  className="k-jp mt-1.5 line-clamp-1 max-w-xl text-xs sm:text-sm text-fg/60"
                  lang="ja"
                  title={item.title.native}
                >
                  {item.title.native}
                </motion.p>
              )}
              <motion.div variants={titleVariants} custom={words.length + 2} className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs sm:text-sm text-fg/80">
                <ScorePill score={item.averageScore} className="text-xs sm:text-sm text-fg" />
                {item.episodes && <span suppressHydrationWarning>{item.episodes} episodios</span>}
                {item.status && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", item.status === "RELEASING" ? "bg-success" : "bg-muted")} aria-hidden />
                    {statusLabel(item.status)}
                  </span>
                )}
                {item.format && <span>{formatLabel(item.format)}</span>}
                {studio && <span className="text-fg/60">{studio}</span>}
              </motion.div>
              <motion.ul variants={titleVariants} custom={words.length + 3} className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Géneros">
                {item.genres.slice(0, 4).map((g) => (
                  <li key={g}>
                    <Link href={`/discover?genres=${encodeURIComponent(g)}`} className="k-chip !py-0.5 !px-2.5 text-xs backdrop-blur">
                      {genreLabel(g)}
                    </Link>
                  </li>
                ))}
              </motion.ul>
              {desc && (
                <motion.p variants={titleVariants} custom={words.length + 4} className="line-clamp-2 mt-2.5 max-w-xl text-xs sm:text-sm leading-relaxed text-fg/75 max-sm:hidden">
                  {desc}
                </motion.p>
              )}
              <motion.div variants={titleVariants} custom={words.length + 5} className="mt-4 sm:mt-5 flex flex-wrap items-center gap-2.5">
                <Link href={`/anime/${item.id}#availability`} prefetch={true} className="k-btn k-btn-primary">
                  <Tv className="size-4" aria-hidden /> Ver opciones
                </Link>
                <ListMenu media={item} className="!bg-surface/70 backdrop-blur" />
                {item.trailer?.site === "youtube" && (
                  <button type="button" className="k-btn k-btn-ghost backdrop-blur" onClick={() => setTrailer(item)}>
                    <Clapperboard className="size-4" aria-hidden /> Tráiler
                  </button>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Layered poster composition */}
        <div className="relative col-span-5 hidden h-full items-center justify-end md:flex xl:col-span-5" aria-hidden>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={item.id}
              className="k-poster relative aspect-[2/3] w-[clamp(200px,20vw,300px)] shadow-[var(--k-shadow-pop)]"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 80, rotate: theme === "zen" ? 0 : 6, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, rotate: theme === "zen" || theme === "cyber" ? 0 : -3, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -60, rotate: -8, scale: 0.9 }}
              transition={reduced ? { duration: 0.2 } : m.spring}
            >
              <Image src={item.coverImage.extraLarge ?? ""} alt="" fill sizes="300px" className="object-cover" unoptimized />
            </motion.div>
          </AnimatePresence>
          {item.title.native && (
            <span
              className="vertical-jp k-jp pointer-events-none absolute -right-6 top-1/2 max-h-[55%] -translate-y-1/2 overflow-hidden text-xs tracking-[0.35em] text-fg/20 xl:-right-10 select-none hidden lg:block"
              lang="ja"
              aria-hidden
            >
              {item.title.native.slice(0, 14)}
            </span>
          )}
        </div>
      </div>

      {/* Slide navigation */}
      <div className="container-k absolute inset-x-0 bottom-6 flex items-center gap-3">
        <span className="k-outline-num text-3xl max-sm:hidden" aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex flex-1 gap-1.5" role="tablist" aria-label="Elegir título destacado">
          {items.map((it, i) => (
            <button
              key={it.id}
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${displayTitle(it)}`}
              onClick={() => go(i)}
              className="group relative h-8 flex-1 max-w-24"
            >
              <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-fg/20">
                {i === index && (
                  <span
                    key={progressKey}
                    className="block h-full origin-left rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ animation: stopped ? "none" : `k-hero-progress ${SLIDE_MS}ms linear forwards`, transform: stopped ? "scaleX(1)" : undefined }}
                  />
                )}
                {i < index && <span className="block h-full bg-fg/50" />}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm backdrop-blur" onClick={() => go(index - 1)} aria-label="Título anterior">
            <ChevronLeft className="size-4" />
          </button>
          <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm backdrop-blur" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? "Reanudar rotación automática" : "Pausar rotación automática"} aria-pressed={userPaused}>
            {userPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
          <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm backdrop-blur" onClick={() => go(index + 1)} aria-label="Siguiente título">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <style>{`@keyframes k-hero-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
      {trailer?.trailer && <TrailerDialog open onOpenChange={(o) => !o && setTrailer(null)} youtubeId={trailer.trailer.id} title={displayTitle(trailer)} />}
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative -mt-[var(--k-nav-h)] min-h-[min(92svh,860px)] overflow-hidden">
      <div className="k-skeleton absolute inset-0 !rounded-none opacity-60" />
      <div className="container-k relative flex min-h-[min(92svh,860px)] flex-col justify-end gap-4 pb-28">
        <div className="k-skeleton h-3 w-40" />
        <div className="k-skeleton h-16 w-[min(90%,560px)]" />
        <div className="k-skeleton h-4 w-72" />
        <div className="flex gap-2">
          <div className="k-skeleton h-11 w-36" />
          <div className="k-skeleton h-11 w-32" />
        </div>
      </div>
    </div>
  );
}
