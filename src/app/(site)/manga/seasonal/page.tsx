import type { Metadata } from "next";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { browseManga } from "@/lib/anilist/manga-service";
import { MangaRanking } from "@/components/manga/ranking";
import { ErrorPanel } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Novedades de manga", description: "Manga que empezaron a publicarse este año, ordenados por popularidad en AniList." };

/** The clock is read inside the cached scope so the page still prerenders under Cache Components. */
async function loadSeason() {
  "use cache";
  cacheLife("hours");
  const year = new Date().getUTCFullYear();
  const page = await browseManga({ yearFrom: year, yearTo: year, sort: "POPULARITY_DESC", perPage: 50 });
  return { year, media: page.media };
}

export default function MangaSeasonalPage() {
  return (
    <Suspense fallback={<div className="container-k mt-10 k-skeleton h-[60vh]" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  try {
    const { year, media } = await loadSeason();
    return <MangaRanking title={`Novedades de ${year}`} jp="今年の新作" kicker="Empezaron a publicarse este año" explanation={`Series cuya fecha de inicio en AniList está en ${year}, ordenadas por número de lectores. A diferencia del anime, el manga no se publica por temporadas.`} media={media} />;
  } catch {
    return (
      <div className="container-k mt-10">
        <ErrorPanel title="AniList no responde" message="Vuelve a intentarlo en unos minutos." />
      </div>
    );
  }
}
