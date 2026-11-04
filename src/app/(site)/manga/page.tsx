import { Suspense } from "react";
import type { Metadata } from "next";
import { getMangaHomeData } from "@/lib/manga/anilist-manga";
import { HeroCarousel, HeroSkeleton } from "@/components/home/hero-carousel";
import { RailSection } from "@/components/home/sections";
import { RailSkeleton } from "@/components/anime/skeletons";
import { AdBanner } from "@/components/ads/ad-banner";

export const metadata: Metadata = {
  title: "Manga & Manhwa | Orunei",
  description: "Lee los mejores mangas, manhwas y novelas ligeras en español con nuestro lector integrado y sin interrupciones.",
};

export default function MangaLandingPage() {
  return (
    <Suspense fallback={<MangaSkeleton />}>
      <MangaContent />
    </Suspense>
  );
}

async function MangaContent() {
  const d = await getMangaHomeData();
  const seen = new Set<number>();
  const heroCandidates = [...d.trending, ...d.popular, ...d.manhwa];
  const hero = heroCandidates
    .filter((m) => m.bannerImage && !seen.has(m.id) && seen.add(m.id))
    .slice(0, 6)
    .map((m) => ({
      ...m,
      type: "MANGA" as const,
      trailer: null,
    }));

  const firstBanner = hero[0]?.bannerImage;

  return (
    <>
      {firstBanner && (
        <link
          rel="preload"
          as="image"
          href={firstBanner}
          fetchPriority="high"
        />
      )}

      {hero.length > 0 && (
        <HeroCarousel
          items={hero as any}
          kickerPrefix="Manga & Manhwa"
          trendingIds={d.trending.map((t) => t.id)}
        />
      )}

      <div className="pt-6">
        <RailSection
          id="trending-manga"
          title="Manga en Tendencia"
          jp="急上昇"
          kicker="Lecturas del momento en español"
          media={d.trending as any}
          ranked
        />

        <RailSection
          id="popular-manhwa"
          title="Manhwas & Webtoons Populares"
          jp="ウェブトゥーン"
          kicker="Directo de Corea del Sur (KR)"
          media={d.manhwa as any}
        />

        <RailSection
          id="all-time-popular-manga"
          title="Obras Más Populares"
          jp="歴代人気"
          kicker="Los mangas más leídos de la historia"
          media={d.popular as any}
        />

        <RailSection
          id="top-rated-manga"
          title="Mejor Calificados"
          jp="最高評価"
          kicker="Aclamados por la crítica y comunidad"
          media={d.topRated as any}
        />
      </div>

      <div className="container-k mt-12 mb-8">
        <AdBanner placement="home-bottom" />
      </div>
    </>
  );
}

function MangaSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <div className="container-k py-8 space-y-12">
        <RailSkeleton />
        <RailSkeleton />
        <RailSkeleton />
      </div>
    </>
  );
}
