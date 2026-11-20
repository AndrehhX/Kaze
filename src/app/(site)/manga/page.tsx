import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Dices, Library, Tv } from "lucide-react";
import { getMangaHome } from "@/lib/anilist/manga-service";
import { MangaHeroFeature } from "@/components/manga/home/hero";
import { BasedOnYourAnime, ContinueReadingRail, FriendsReading, KazeOriginalsShelf } from "@/components/manga/home/personal";
import { MangaRailSection } from "@/components/manga/cards";
import { RailSkeleton } from "@/components/anime/skeletons";
import { ErrorPanel } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Manga — La historia continúa",
  description: "Descubre manga, manhwa y manhua, encuentra dónde continuar la historia después del anime y lee en el lector de KAZE.",
};

export default function MangaHomePage() {
  return (
    <Suspense fallback={<MangaHomeSkeleton />}>
      <MangaHomeContent />
    </Suspense>
  );
}

async function MangaHomeContent() {
  let d;
  try {
    d = await getMangaHome();
  } catch {
    return (
      <div className="container-k mt-16 space-y-10">
        <ErrorPanel title="AniList no responde ahora mismo" message="El catálogo de manga vuelve en unos minutos. Mientras tanto puedes leer las obras de demostración de KAZE." />
        <KazeOriginalsShelf />
      </div>
    );
  }
  const pool = [...d.trending, ...d.popularMonth, ...d.topRated, ...d.gems, ...d.completed, ...d.newDiscoveries, ...d.manhwa];
  return (
    <>
      <MangaHeroFeature items={d.trending.slice(0, 6)} />
      <ContinueReadingRail />
      <MangaRailSection id="mk-trending" title="Tendencias" jp="急上昇" kicker="Actividad reciente en AniList" media={d.trending} ranked href="/manga/discover?sort=TRENDING_DESC" />
      <MangaRailSection id="mk-popular" title="Populares en publicación" jp="連載中" kicker="Series en curso con más lectores en AniList" media={d.popularMonth} href="/manga/discover?status=RELEASING&sort=POPULARITY_DESC" />
      <BasedOnYourAnime pool={pool} />
      <MangaRailSection id="mk-top" title="Mejor valorados" jp="高評価" kicker="Puntuación media en AniList" media={d.topRated} ranked href="/manga/discover?sort=SCORE_DESC" />
      <MangaRailSection id="mk-completed" title="Series completas" jp="完結" kicker="Finalizadas: léelas de principio a fin" media={d.completed} href="/manga/discover?status=FINISHED" />
      <FriendsReading />
      <MangaRailSection id="mk-manhwa" title="Manhwa destacados" jp="만화" kicker="Obras de Corea del Sur más populares" media={d.manhwa} href="/manga/discover?country=KR" />
      <p className="container-k mt-12 text-xs text-muted">Datos de manga proporcionados por AniList. Lectura integrada en español e inglés.</p>
    </>
  );
}

function MangaHomeSkeleton() {
  return (
    <div className="container-k mt-8" aria-busy="true">
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="k-skeleton h-14 w-24" />
          <div className="k-skeleton h-20 w-4/5" />
          <div className="k-skeleton h-4 w-1/2" />
          <div className="k-skeleton h-24 w-full" />
        </div>
        <div className="k-skeleton mx-auto aspect-[2/3] w-full max-w-[380px]" />
      </div>
      <div className="mt-12">
        <RailSkeleton />
      </div>
    </div>
  );
}
