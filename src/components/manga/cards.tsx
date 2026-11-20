"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { creditsOf, mangaTitle, originLabel, type MangaCard } from "@/lib/anilist/manga-types";
import { cn, statusLabel } from "@/lib/utils";
import { genreLabel } from "@/lib/anilist/browse-params";
import { SafeImage, SectionHeader } from "@/components/ui/primitives";
import { Rail } from "@/components/ui/rail";
import { useKazeMotion } from "@/lib/motion";
import { useMangaLibrary } from "@/stores/manga";
import { mangaHref, mangaStatusMeta } from "@/lib/manga/types";

export function mangaStatusLabel(status: string | null | undefined) {
  if (status === "RELEASING") return "En publicación";
  return statusLabel(status);
}

/** Chapter/volume counts exactly as AniList knows them — unknown stays unknown. */
export function lengthLabel(m: { chapters: number | null; volumes: number | null; status?: string | null }) {
  const parts = [m.chapters ? `${m.chapters} cap.` : null, m.volumes ? `${m.volumes} vol.` : null].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return m.status === "RELEASING" ? "En curso" : "Extensión desconocida";
}

export function InkScore({ score, className }: { score: number | null; className?: string }) {
  if (!score) return null;
  return (
    <span className={cn("k-score text-xs", className)} aria-label={`Puntuación media ${score} de 100`}>
      <Star className="size-3 fill-current text-accent" aria-hidden />
      {score}%
    </span>
  );
}

/** A printed volume: cover with spine shading and a page-block edge. Purely visual. */
export function MangaCover({ src, color, title, sizes = "180px", priority, className, children }: { src: string | null; color?: string | null; title: string; sizes?: string; priority?: boolean; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("km-book", className)}>
      <div className="k-poster aspect-[2/3] w-full" style={{ backgroundColor: color ?? undefined }}>
        <SafeImage src={src ?? ""} alt="" fill sizes={sizes} loading={priority ? "eager" : "lazy"} className="object-cover" fallbackLabel={title} tint={color} />
        {children}
      </div>
    </div>
  );
}

export function MangaCardView({ media, rank, priority, className, caption, sizes }: { media: MangaCard; rank?: number; priority?: boolean; className?: string; caption?: string; sizes?: string }) {
  const entry = useMangaLibrary((s) => s.entries[media.id]);
  const { m, reduced, theme } = useKazeMotion();
  const title = mangaTitle(media);
  const credit = creditsOf(media).author;
  const href = mangaHref(media.id);
  return (
    <motion.article className={cn("k-hoverable group relative", className)} whileHover={reduced ? undefined : { y: -m.lift }} transition={m.spring}>
      <Link href={href} prefetch={false} className="block rounded-[var(--k-radius-card)] outline-none">
        <span className="sr-only">{`${title}${credit ? `, de ${credit}` : ""}`}</span>
        <MangaCover src={media.coverImage.extraLarge || media.coverImage.large} color={media.coverImage.color} title={title} priority={priority} sizes={sizes ?? "(max-width: 640px) 40vw, (max-width: 1024px) 22vw, 180px"}>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
          <span className="absolute left-2 top-2 z-[4] rounded-[var(--k-radius-chip)] bg-black/65 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-white backdrop-blur">{originLabel(media.countryOfOrigin, media.format)}</span>
          {entry && (
            <span className={cn("absolute bottom-2 left-2 z-[4] rounded-[var(--k-radius-chip)] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider", theme === "zen" ? "bg-[#1d1d1d] text-[#f5f2ea]" : "bg-primary text-white")}>
              {mangaStatusMeta(entry.status).label}
              {entry.progress ? ` · cap. ${entry.progress}` : ""}
            </span>
          )}
          {media.averageScore ? (
            <span className="absolute right-2 top-2 z-[4] rounded-[var(--k-radius-chip)] bg-black/65 px-1.5 py-0.5 text-white backdrop-blur">
              <InkScore score={media.averageScore} className="text-[0.6875rem]" />
            </span>
          ) : null}
          <div aria-hidden className="absolute inset-x-0 bottom-0 z-[2] translate-y-2 p-2.5 text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <p className="clamp-2 text-[0.6875rem] leading-snug text-white/85">{media.genres.slice(0, 3).map(genreLabel).join(" · ")}</p>
            <p className="mt-1 text-[0.6875rem] font-semibold">{lengthLabel(media)}</p>
          </div>
        </MangaCover>
      </Link>
      <div className="mt-2.5 flex gap-2.5 px-0.5">
        {rank != null && (
          <span className="k-outline-num -mt-0.5 text-[2.6rem]" aria-label={`Puesto ${rank}`}>
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link href={href} className="clamp-2 text-sm font-semibold leading-snug hover:text-primary-ink" title={title} tabIndex={-1}>
            {title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">{caption ?? credit ?? media.title.native ?? ""}</p>
          <p className="mt-1 text-[0.6875rem] text-muted">{[mangaStatusLabel(media.status), media.startDate?.year].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
    </motion.article>
  );
}

export function MangaCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="k-skeleton aspect-[2/3] w-full" />
      <div className="k-skeleton mt-3 h-3.5 w-4/5" />
      <div className="k-skeleton mt-2 h-3 w-1/2" />
    </div>
  );
}

/** Compact list row for search results and accessible alternatives to the Vault. */
export function MangaRow({ media, action, index }: { media: MangaCard; action?: ReactNode; index?: number }) {
  const title = mangaTitle(media);
  const credit = creditsOf(media).author;
  return (
    <div className="flex items-center gap-4 border-b border-line py-3">
      {index != null && <span className="km-number w-8 shrink-0 text-right text-2xl text-muted">{index}</span>}
      <Link href={mangaHref(media.id)} className="w-14 shrink-0" tabIndex={-1} aria-hidden>
        <MangaCover src={media.coverImage.large} color={media.coverImage.color} title={title} sizes="56px" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={mangaHref(media.id)} className="font-semibold hover:text-primary-ink">
          {title}
        </Link>
        <p className="truncate text-xs text-muted">{[credit, originLabel(media.countryOfOrigin, media.format), media.startDate?.year].filter(Boolean).join(" · ")}</p>
        <p className="mt-0.5 text-xs text-muted">
          {mangaStatusLabel(media.status)} · {lengthLabel(media)} {media.genres.length ? `· ${media.genres.slice(0, 3).map(genreLabel).join(", ")}` : ""}
        </p>
      </div>
      <InkScore score={media.averageScore} className="shrink-0" />
      {action}
    </div>
  );
}

export function MangaRailSection({ id, title, jp, kicker, media, ranked, href, note }: { id: string; title: string; jp?: string; kicker?: string; media: MangaCard[]; ranked?: boolean; href?: string; note?: string }) {
  if (!media.length) return null;
  return (
    <section aria-labelledby={id} className="container-k k-offscreen-section mt-14">
      <SectionHeader
        id={id}
        title={title}
        jp={jp}
        kicker={kicker}
        action={
          href ? (
            <Link href={href} className="k-btn k-btn-ghost k-btn-sm">
              Ver todo
            </Link>
          ) : undefined
        }
      />
      {note && <p className="-mt-3 mb-4 max-w-2xl text-xs text-muted">{note}</p>}
      <Rail label={title}>
        {media.map((m, i) => (
          <MangaCardView key={m.id} media={m} rank={ranked ? i + 1 : undefined} />
        ))}
      </Rail>
    </section>
  );
}
