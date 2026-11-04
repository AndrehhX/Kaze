import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Film, Star } from "lucide-react";
import { getMangaDetails } from "@/lib/manga/anilist-manga";
import { cleanDescription, formatLabel, statusLabel } from "@/lib/utils";
import { SafeImage } from "@/components/ui/primitives";
import { ChapterList } from "@/components/manga/chapter-list";
import { AdBanner } from "@/components/ads/ad-banner";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function loadManga(idParam: string) {
  const id = Number.parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const media = await getMangaDetails(id);
    if (!media || media.isAdult) return null;
    return media;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const media = await loadManga(id);
  if (!media) return { title: "Manga no encontrado · Orunei" };

  const title = media.title.english || media.title.romaji || "Manga";
  const cleanDesc = cleanDescription(media.description);
  const snippet = cleanDesc
    ? cleanDesc.slice(0, 160)
    : `Leer ${title} online en español en alta calidad en Orunei.`;

  return {
    title: `Leer ${title} Online en Español · Orunei`,
    description: snippet,
  };
}

export default function MangaDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<MangaDetailSkeleton />}>
      <MangaDetailContent params={params} />
    </Suspense>
  );
}

async function MangaDetailContent({ params }: PageProps) {
  const { id } = await params;
  const media = await loadManga(id);

  if (!media) notFound();

  const title = media.title.english || media.title.romaji || media.title.userPreferred || "Manga";
  const desc = cleanDescription(media.description);
  const animeAdaptation = media.relations?.edges?.find(
    (e: any) => (e.relationType === "ADAPTATION" || e.relationType === "SOURCE") && e.node?.type === "ANIME"
  )?.node;

  const originMap: Record<string, string> = {
    KR: "Manhwa (Corea)",
    JP: "Manga (Japón)",
    CN: "Manhua (China)",
  };
  const originLabel = media.countryOfOrigin ? originMap[media.countryOfOrigin] || media.countryOfOrigin : null;

  return (
    <div className="min-h-screen pb-16">
      {/* Banner Backdrop */}
      <div className="relative -mt-[var(--k-nav-h)] h-[min(45svh,400px)] overflow-hidden">
        {media.bannerImage ? (
          <img
            src={media.bannerImage}
            alt=""
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `radial-gradient(ellipse at 70% 20%, ${media.coverImage?.color ?? "var(--k-primary)"}, transparent 70%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/25" />
      </div>

      <div className="container-k relative -mt-32 md:-mt-44 grid gap-8 md:grid-cols-[minmax(220px,280px)_1fr] lg:gap-12">
        {/* Left Column: Poster & Details */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div
            className="k-poster relative aspect-[2/3] w-[min(65vw,260px)] md:w-full shadow-[var(--k-shadow-pop)] rounded-[var(--k-radius-card)] overflow-hidden"
            style={{ backgroundColor: media.coverImage?.color ?? undefined }}
          >
            <SafeImage
              src={media.coverImage?.extraLarge || media.coverImage?.large || ""}
              alt={`${title} cover`}
              fill
              loading="eager"
              sizes="280px"
              className="object-cover"
              fallbackLabel={title}
            />
          </div>

          {/* Quick info list */}
          <div className="w-full space-y-2.5 rounded-[var(--k-radius-card)] border border-border/40 bg-surface/30 p-4 text-xs backdrop-blur">
            <div className="flex justify-between py-1 border-b border-border/30">
              <span className="text-muted">Estado</span>
              <span className="font-medium">{statusLabel(media.status)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/30">
              <span className="text-muted">Formato</span>
              <span className="font-medium">{formatLabel(media.format)}</span>
            </div>
            {originLabel && (
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-muted">Origen</span>
                <span className="font-medium">{originLabel}</span>
              </div>
            )}
            {media.chapters && (
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-muted">Capítulos totales</span>
                <span className="font-medium">{media.chapters}</span>
              </div>
            )}
            {media.volumes && (
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-muted">Volúmenes</span>
                <span className="font-medium">{media.volumes}</span>
              </div>
            )}
            {media.startDate?.year && (
              <div className="flex justify-between py-1">
                <span className="text-muted">Año</span>
                <span className="font-medium">{media.startDate.year}</span>
              </div>
            )}
          </div>

          {/* Anime cross-link badge if adaptation exists */}
          {animeAdaptation && (
            <Link
              href={`/anime/${animeAdaptation.id}`}
              className="w-full flex items-center justify-center gap-2 rounded-[var(--k-radius-card)] border border-primary/40 bg-primary/10 p-3 text-sm font-semibold text-primary-ink transition-all hover:bg-primary/20 hover:scale-[1.01]"
            >
              <Film className="size-4" />
              <span>Ver adaptación Anime</span>
            </Link>
          )}
        </div>

        {/* Right Column: Title, Synopsis, Chapters */}
        <div className="min-w-0 md:pt-12 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {originLabel && <span className="k-chip !bg-primary/15 font-semibold text-primary-ink">{originLabel}</span>}
              <span className="k-chip">{formatLabel(media.format)}</span>
              <span className="k-chip">{statusLabel(media.status)}</span>
              {media.averageScore && (
                <span className="k-chip !bg-accent/15 text-accent font-semibold flex items-center gap-1">
                  <Star className="size-3 fill-current" /> {media.averageScore}%
                </span>
              )}
            </div>

            <h1 className="font-display text-title mt-3 text-balance-k">{title}</h1>

            {media.title.native && (
              <p className="k-jp mt-1.5 text-base text-muted" lang="ja">
                {media.title.native}
              </p>
            )}
            {media.title.romaji && media.title.romaji !== title && (
              <p className="mt-1 text-sm text-muted">{media.title.romaji}</p>
            )}
          </div>

          {/* Genres Chips */}
          {media.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {media.genres.map((g: string) => (
                <span key={g} className="k-chip text-xs">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          {desc && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-fg/90 uppercase tracking-wider">Sinopsis</h2>
              <p className="text-sm leading-relaxed text-muted whitespace-pre-line max-w-3xl">
                {desc}
              </p>
            </div>
          )}

          <div className="h-px w-full bg-border/40 my-6" />

          {/* Chapters Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                  <BookOpen className="size-5 text-primary-ink" />
                  <span>Capítulos en Español</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Conectado directamente a la red MangaDex
                </p>
              </div>
            </div>

            <ChapterList
              mangaId={media.id}
              title={title}
              romaji={media.title.romaji}
              english={media.title.english}
            />
          </section>

          <div className="mt-12">
            <AdBanner placement="home-bottom" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MangaDetailSkeleton() {
  return (
    <div className="min-h-screen pb-16">
      <div className="h-[min(45svh,400px)] bg-neutral-900 animate-pulse" />
      <div className="container-k -mt-32 grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="aspect-[2/3] w-full bg-neutral-800 rounded-[var(--k-radius-card)] animate-pulse" />
        <div className="space-y-4 pt-12">
          <div className="h-8 w-1/2 bg-neutral-800 rounded animate-pulse" />
          <div className="h-4 w-1/4 bg-neutral-850 rounded animate-pulse" />
          <div className="h-32 w-full bg-neutral-850 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
