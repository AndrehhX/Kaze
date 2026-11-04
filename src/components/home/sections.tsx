"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import type { AiringItem, MediaCard, MediaHero } from "@/lib/anilist/types";
import { AnimeCard, displayTitle, ScorePill } from "@/components/anime/anime-card";
import { Rail } from "@/components/ui/rail";
import { Reveal, RevealItem, SafeImage, SectionHeader } from "@/components/ui/primitives";
import { cleanDescription, cn, formatLabel, formatNumber, relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import { useKazeMotion } from "@/lib/motion";
import { SEASONS } from "@/lib/anilist/browse-params";

export function RailSection({
  title,
  jp,
  kicker,
  media,
  href,
  ranked,
  captions,
  id,
}: {
  title: string;
  jp?: string;
  kicker?: string;
  media: MediaCard[];
  href?: string;
  ranked?: boolean;
  captions?: (m: MediaCard) => string | undefined;
  id: string;
}) {
  if (!media.length) return null;
  return (
    <section aria-labelledby={id} className="container-k mt-16 first:mt-10 k-offscreen-section">
      <SectionHeader
        id={id}
        title={title}
        jp={jp}
        kicker={kicker}
        action={
          href && (
            <Link href={href} className="k-btn k-btn-ghost k-btn-sm">
              See all <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )
        }
      />
      <Rail label={title}>
        {media.map((m, i) => (
          <AnimeCard key={m.id} media={m} rank={ranked ? i + 1 : undefined} caption={captions?.(m)} layoutScope={id} />
        ))}
      </Rail>
    </section>
  );
}

/** Popular This Season — an editorial bento: one feature + supporting posters. */
export function SeasonBento({ media, season, year }: { media: MediaHero[]; season: string; year: number }) {
  const { m: motionP, reduced } = useKazeMotion();
  if (media.length < 5) return null;
  const [lead, ...rest] = media.filter((x) => x.bannerImage).concat(media.filter((x) => !x.bannerImage));
  const s = SEASONS.find((x) => x.value === season);
  return (
    <section aria-labelledby="season-h" className="container-k mt-20 k-offscreen-section">
      <SectionHeader
        id="season-h"
        kicker={`${s?.label ?? season} ${year}`}
        title="Popular esta temporada"
        jp={`${s?.jp ?? ""}アニメ`}
        action={
          <Link href="/seasonal" className="k-btn k-btn-ghost k-btn-sm">
            Gráfico de temporada <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
        <motion.div
          className="k-card group relative col-span-2 row-span-2 min-h-[320px] overflow-hidden md:col-span-4 lg:col-span-3"
          whileHover={reduced ? undefined : { scale: 1.005 }}
          transition={motionP.spring}
        >
          <Link href={`/anime/${lead.id}`} className="absolute inset-0 z-[2]" aria-label={displayTitle(lead)} />
          <SafeImage src={lead.bannerImage ?? lead.coverImage.extraLarge ?? ""} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
            <p className="k-label text-white/70">Nº 1 de esta temporada</p>
            <h3 className="font-display mt-2 text-title max-w-[18ch]">{displayTitle(lead)}</h3>
            <p className="clamp-2 mt-3 max-w-lg text-sm text-white/80">{cleanDescription(lead.description)}</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-white/80">
              <ScorePill score={lead.averageScore} className="text-white" />
              <span>{lead.genres.slice(0, 3).join(" · ")}</span>
            </div>
          </div>
        </motion.div>
        {rest.slice(0, 6).map((m) => (
          <AnimeCard key={m.id} media={m} layoutScope="season" />
        ))}
      </div>
    </section>
  );
}

/** Recently Released — real airing schedule from AniList for the last 72h. */
export function RecentlyReleased({ items }: { items: AiringItem[] }) {
  const now = useNow();
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent-h" className="container-k mt-20 k-offscreen-section">
      <SectionHeader id="recent-h" kicker="Últimas 72 horas" title="Episodios recientes" jp="最新話" />
      <Rail label="Recently released episodes" itemClassName="w-[78vw] xs:w-[60vw] sm:w-[44vw] md:w-[32vw] lg:w-[25vw] xl:w-[21vw] 3xl:w-[340px]">
        {items.map((a) => (
          <Link key={a.id} href={`/anime/${a.media.id}/episodes`} className="k-card group flex h-full gap-3 overflow-hidden p-2.5 transition-shadow hover:shadow-[var(--k-hover-glow)]">
            <div className="k-poster relative aspect-[2/3] w-16 shrink-0">
              <SafeImage src={a.media.coverImage.large ?? ""} alt="" fill sizes="64px" className="object-cover" />
            </div>
            <div className="min-w-0 py-1">
              <p className="text-[0.6875rem] font-semibold text-primary-ink">
                Episodio {a.episode}
                {a.media.episodes ? ` / ${a.media.episodes}` : ""}
              </p>
              <p className="clamp-2 mt-0.5 text-sm font-semibold leading-snug group-hover:text-primary-ink">{displayTitle(a.media)}</p>
              <p className="mt-1 text-xs text-muted" suppressHydrationWarning>
                {now ? `Aired ${relativeTime(a.airingAt * 1000, now)}` : "Emitido recientemente"}
              </p>
            </div>
          </Link>
        ))}
      </Rail>
    </section>
  );
}

/** Highest Rated — an editorial numbered column instead of yet another rail. */
export function TopRatedEditorial({ media }: { media: MediaCard[] }) {
  if (!media.length) return null;
  return (
    <section aria-labelledby="top-h" className="container-k mt-20 k-offscreen-section">
      <SectionHeader
        id="top-h"
        kicker="Histórico"
        title="Mejor valorados"
        jp="殿堂"
        action={
          <Link href="/discover?sort=SCORE_DESC" className="k-btn k-btn-ghost k-btn-sm">
            Ranking completo <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <Reveal as="div" className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        {media.slice(0, 10).map((m, i) => (
          <RevealItem key={m.id} className="min-w-0">
            <Link href={`/anime/${m.id}`} className="group flex items-center gap-4 border-b border-line py-3">
              <span className="k-outline-num w-12 shrink-0 text-right text-4xl">{String(i + 1).padStart(2, "0")}</span>
              <div className="k-poster relative aspect-[2/3] w-11 shrink-0">
                <SafeImage src={m.coverImage.large ?? ""} alt="" fill sizes="44px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold group-hover:text-primary-ink">{displayTitle(m)}</p>
                <p className="truncate text-xs text-muted">
                  {[formatLabel(m.format), m.seasonYear ?? m.startDate.year, m.studios.nodes[0]?.name].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="w-24 shrink-0 max-xs:hidden">
                <div className="flex justify-end">
                  <ScorePill score={m.averageScore} />
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${m.averageScore ?? 0}%` }} />
                </div>
              </div>
            </Link>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

/** Upcoming — posters with an air-date label. */
export function UpcomingSection({ media }: { media: MediaCard[] }) {
  if (!media.length) return null;
  const when = (m: MediaCard) => {
    if (m.nextAiringEpisode) return undefined;
    const { year, month } = m.startDate;
    if (year && month) return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" });
    if (m.season && m.seasonYear) return `${m.season[0]}${m.season.slice(1).toLowerCase()} ${m.seasonYear}`;
    return year ? String(year) : "TBA";
  };
  return <RailSection id="upcoming-h" title="Próximos estrenos" jp="放送予定" kicker="En el horizonte" media={media} href="/discover?status=NOT_YET_RELEASED&sort=POPULARITY_DESC" captions={when} />;
}

export function HiddenGemsSection({ media }: { media: MediaCard[] }) {
  return (
    <RailSection
      id="gems-h"
      title="Joyas ocultas"
      jp="隠れた名作"
      kicker="Nota 77%+ · menos de 45k miembros"
      media={media}
      href="/discover?sort=SCORE_DESC&score=77&popMax=45000"
      captions={(m) => (m.popularity ? `${formatNumber(m.popularity)} members` : undefined)}
    />
  );
}

export function CalendarHint() {
  return (
    <div className="container-k mt-16">
      <Link href="/seasonal" className={cn("k-card group flex items-center gap-4 p-5 transition-shadow hover:shadow-[var(--k-hover-glow)]")}>
        <CalendarClock className="size-6 text-primary-ink" aria-hidden />
        <div className="flex-1">
          <p className="font-display text-lg">This season&apos;s full chart</p>
          <p className="text-sm text-muted">Todos los estrenos, ordenables por popularidad, nota y día de emisión.</p>
        </div>
        <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden />
      </Link>
    </div>
  );
}

export function OpenCinemaBanner() {
  return (
    <section aria-labelledby="cinema-h" className="container-k mt-20">
      <div className="k-card relative grid overflow-hidden md:grid-cols-[1.2fr_1fr]">
        <div className="relative z-[1] p-6 sm:p-10">
          <p className="k-label text-primary-ink">Playable now · Demo</p>
          <h2 id="cinema-h" className="font-display text-title mt-3">
            KAZE Open Cinema
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted">
            Try the full player — adaptive HLS, subtitles, skip markers, theater &amp; ambient modes, resume — with open-licensed Blender Foundation films. These are not anime and not
            AniList titles.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/watch/open-cinema/1" className="k-btn k-btn-primary">
              Start the demo
            </Link>
            <Link href="/watch-parties" className="k-btn k-btn-outline">
              Host a watch party
            </Link>
          </div>
        </div>
        <div className="relative min-h-48 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_40%,var(--k-primary),transparent_60%)] opacity-40" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="k-jp select-none text-[9rem] font-bold leading-none text-fg/10" lang="ja">
              映
            </span>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="absolute h-[2px] w-2/3 bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" style={{ top: `${30 + i * 18}%`, left: `${i * 12}%`, rotate: "-14deg" }} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CommunityFavorites({ media }: { media: MediaCard[] }) {
  return (
    <RailSection
      id="fav-h"
      title="Favoritos de la comunidad"
      jp="みんなの推し"
      kicker="Los más guardados en AniList"
      media={media}
      href="/discover?sort=FAVOURITES_DESC"
      captions={(m) => (m.favourites ? `♥ ${formatNumber(m.favourites)}` : undefined)}
    />
  );
}

export function StatCredit() {
  return (
    <p className="container-k mt-6 text-[0.6875rem] text-muted">
      Datos del catálogo obtenidos de <a className="underline" href="https://anilist.co" target="_blank" rel="noreferrer">AniList</a>, en caché y actualizados cada hora.
    </p>
  );
}

