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
      <section className="container-k mt-10" aria-label="Accesos de manga">
        <ul className="grid gap-3 md:grid-cols-3">
          {[
            { href: "/discover", icon: Tv, kicker: "物語は続く", title: "La historia continúa", body: "Abre un anime y pulsa «Continuar la historia» para saber en qué capítulo seguir, con fuentes y nivel de verificación." },
            { href: "/manga/shelf", icon: Library, kicker: "保管庫", title: "La Bóveda", body: "Tu colección como una estantería de tomos físicos: arrastra, examina y abre cada volumen." },
            { href: "/manga/random", icon: Dices, kicker: "運命", title: "Ruleta de manga", body: "Filtra por género, extensión o estado y deja que la estantería elija tu próxima lectura." },
          ].map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="km-frame group relative flex h-full flex-col gap-2 overflow-hidden p-5 transition-colors hover:bg-[var(--k-btn-ghost)]">
                <span aria-hidden className="k-jp absolute -right-2 -top-3 text-5xl text-fg opacity-[0.06]" lang="ja">
                  {c.kicker}
                </span>
                <c.icon className="size-5 text-primary-ink" aria-hidden />
                <span className="font-display text-lg">{c.title}</span>
                <span className="text-sm text-muted">{c.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <MangaRailSection id="mk-trending" title="Tendencias" jp="急上昇" kicker="Actividad reciente en AniList" media={d.trending} ranked href="/manga/trending" />
      <MangaRailSection id="mk-popular" title="Populares en publicación" jp="連載中" kicker="Series en curso con más lectores en AniList" media={d.popularMonth} href="/manga/discover?status=RELEASING&sort=POPULARITY_DESC" />
      <BasedOnYourAnime pool={pool} />
      <MangaRailSection id="mk-top" title="Mejor valorados" jp="高評価" kicker="Puntuación media en AniList (más de 15 000 lectores)" media={d.topRated} ranked href="/manga/discover?sort=SCORE_DESC&popMin=15000" />
      <MangaRailSection id="mk-updated" title="Fichas actualizadas" jp="更新" kicker="Series en publicación cuya ficha de AniList se actualizó hace poco" note="AniList no publica fechas de capítulos nuevos; esta lista ordena por la última edición de la ficha." media={d.recentlyUpdated} />
      <MangaRailSection id="mk-completed" title="Series completas" jp="完結" kicker="Finalizadas: léelas de principio a fin" media={d.completed} href="/manga/discover?status=FINISHED" />
      <FriendsReading />
      <MangaRailSection id="mk-gems" title="Joyas ocultas" jp="隠れた名作" kicker="Puntuación alta, menos de 25 000 lectores" media={d.gems} href="/manga/discover?sort=SCORE_DESC&popMax=25000&score=78" />
      <MangaRailSection id="mk-new" title="Nuevos descubrimientos" jp="新作" kicker="Empezaron a publicarse en los últimos 12 meses" media={d.newDiscoveries} href="/manga/seasonal" />
      <MangaRailSection id="mk-manhwa" title="Manhwa destacados" jp="만화" kicker="Obras de Corea del Sur más populares" media={d.manhwa} href="/manga/discover?country=KR" />
      <MangaRailSection id="mk-short" title="Lecturas cortas" jp="短編" kicker="Finalizadas en 30 capítulos o menos" media={d.shortReads} href="/manga/discover?status=FINISHED&chMax=30&sort=SCORE_DESC" />
      <MangaRailSection id="mk-long" title="Historias épicas" jp="長編" kicker="Más de 200 capítulos" media={d.longRunning} href="/manga/discover?chMin=200" />
      <KazeOriginalsShelf />
      <p className="container-k mt-12 text-xs text-muted">Datos de manga proporcionados por AniList. Los capítulos de obras comerciales se leen en las plataformas oficiales de cada editor.</p>
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
