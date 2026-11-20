"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Layers, Tv } from "lucide-react";
import { useEffect, useState } from "react";
import { animeAdaptations, creditsOf, mangaTitle, originLabel, type MangaHero } from "@/lib/anilist/manga-types";
import { cleanDescription, cn } from "@/lib/utils";
import { genreLabel } from "@/lib/anilist/browse-params";
import { useKazeMotion } from "@/lib/motion";
import { mangaHref, snapshotFromManga } from "@/lib/manga/types";
import { InkScore, lengthLabel, mangaStatusLabel } from "../cards";
import { MangaListMenu } from "../library-actions";

/**
 * Editorial "issue cover": a numbered feature, oversized type, the printed volume held at an angle
 * over a screentone halo. Not a banner carousel — the composition changes with each featured work.
 */
export function MangaHeroFeature({ items }: { items: MangaHero[] }) {
  const { reduced, m, theme } = useKazeMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const item = items[i];

  useEffect(() => {
    if (reduced || paused || items.length < 2) return;
    const t = setTimeout(() => setI((v) => (v + 1) % items.length), 9000);
    return () => clearTimeout(t);
  }, [i, items.length, paused, reduced]);

  if (!item) return null;
  const title = mangaTitle(item);
  const { author, artist } = creditsOf(item);
  const anime = animeAdaptations(item)[0];
  const synopsis = cleanDescription(item.description);
  const color = item.coverImage.color ?? "var(--k-primary)";

  return (
    <section aria-roledescription="carrusel" aria-label="Manga destacado" className="relative isolate overflow-hidden pb-8 pt-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <motion.div aria-hidden className="absolute inset-0 -z-10" animate={{ background: `radial-gradient(60% 70% at 72% 40%, ${color}40, transparent 70%)` }} transition={{ duration: reduced ? 0 : 1 }} />
      <div aria-hidden className="km-tone km-tone-fade absolute right-0 top-0 -z-10 h-full w-[60%] opacity-60" />
      <div className="container-k grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <AnimatePresence mode="wait">
          <motion.div key={item.id} initial="hidden" animate="show" exit={{ opacity: 0, x: reduced ? 0 : -16, transition: { duration: 0.2 } }} variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.07 } } }} className="relative min-w-0">
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex items-baseline gap-4">
              <span className="km-number text-6xl text-primary-ink sm:text-7xl" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="k-label text-muted">
                Tendencia ahora en AniList · {originLabel(item.countryOfOrigin, item.format)}
              </p>
            </motion.div>
            <motion.h1 variants={{ hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 24, clipPath: "inset(0 0 100% 0)" }, show: { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", transition: { duration: reduced ? 0.2 : 0.8, ease: m.ease } } }} className="km-title text-balance-k mt-4 text-[clamp(2.4rem,1rem+4.6vw,5.6rem)]">
              {title}
            </motion.h1>
            <motion.p variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="mt-4 text-sm text-muted">
              {author && <span className="font-semibold text-fg">{author}</span>}
              {artist && artist !== author && <span> · arte de {artist}</span>}
              {item.startDate?.year && <span> · desde {item.startDate.year}</span>}
            </motion.p>
            <motion.ul variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="mt-4 flex flex-wrap gap-1.5">
              {item.genres.slice(0, 4).map((g) => (
                <li key={g}>
                  <Link href={`/manga/discover?genres=${encodeURIComponent(g)}`} className="k-chip">
                    {genreLabel(g)}
                  </Link>
                </li>
              ))}
            </motion.ul>
            <motion.dl variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="mt-6 grid max-w-lg grid-cols-3 border-y border-line py-3 text-sm">
              <div>
                <dt className="k-label text-muted">Valoración</dt>
                <dd className="mt-1 font-semibold">{item.averageScore ? <InkScore score={item.averageScore} className="text-sm" /> : "Sin datos"}</dd>
              </div>
              <div>
                <dt className="k-label text-muted">Estado</dt>
                <dd className="mt-1 font-semibold">{mangaStatusLabel(item.status)}</dd>
              </div>
              <div>
                <dt className="k-label text-muted">Extensión</dt>
                <dd className="mt-1 font-semibold">{lengthLabel(item)}</dd>
              </div>
            </motion.dl>
            {synopsis && (
              <motion.p variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="clamp-3 mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-muted">
                {synopsis}
              </motion.p>
            )}
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="mt-7 flex flex-wrap gap-2">
              <Link href={mangaHref(item.id)} className="k-btn k-btn-primary">
                Abrir ficha <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href={`/manga/${item.id}/volumes`} className="k-btn k-btn-outline">
                <Layers className="size-4" aria-hidden /> Explorar volúmenes
              </Link>
              {anime && (
                <Link href={`/manga/continue/${anime.id}`} className="k-btn k-btn-ghost">
                  <Tv className="size-4" aria-hidden /> Continuar desde el anime
                </Link>
              )}
              <MangaListMenu manga={{ id: item.id, snapshot: snapshotFromManga(item) }} />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        <div className="relative mx-auto w-full max-w-[420px] [perspective:1400px]">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={item.id}
              initial={reduced ? { opacity: 0 } : { opacity: 0, rotateY: -38, x: 60, z: -120 }}
              animate={{ opacity: 1, rotateY: reduced ? 0 : -14, x: 0, z: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, rotateY: 30, x: -80, z: -100, transition: { duration: 0.35 } }}
              transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 120, damping: 20 }}
              className="km-book relative [transform-style:preserve-3d]"
            >
              {item.title.native && (
                <span aria-hidden className="k-jp km-vertical absolute -left-14 top-2 hidden text-2xl text-muted lg:block" lang="ja">
                  {item.title.native.slice(0, 14)}
                </span>
              )}
              <Link href={mangaHref(item.id)} className={cn("k-poster block aspect-[2/3] w-full", theme === "zen" ? "" : "shadow-[0_50px_90px_-30px_rgb(0_0_0_/_0.8)]")} style={{ backgroundColor: item.coverImage.color ?? undefined }} aria-label={`Abrir ${title}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.coverImage.extraLarge || item.coverImage.large || ""} alt="" className="size-full object-cover" fetchPriority={i === 0 ? "high" : "auto"} />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="container-k mt-10">
        <ol className="scrollbar-none flex gap-3 overflow-x-auto pb-2" aria-label="Elegir manga destacado">
          {items.map((it, idx) => (
            <li key={it.id} className="shrink-0">
              <button type="button" onClick={() => setI(idx)} aria-current={idx === i} aria-label={`Destacado ${idx + 1}: ${mangaTitle(it)}`} className={cn("group flex w-56 items-center gap-3 border-t-2 pt-3 text-left transition-colors", idx === i ? "border-primary" : "border-line hover:border-muted")}>
                <span className="km-number text-2xl text-muted">{String(idx + 1).padStart(2, "0")}</span>
                <span className={cn("clamp-2 text-sm font-semibold leading-snug", idx === i ? "text-fg" : "text-muted group-hover:text-fg")}>{mangaTitle(it)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
