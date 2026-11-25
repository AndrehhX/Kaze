import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import { getSeason } from "@/lib/anilist/service";
import { seasonOf } from "@/lib/utils";
import { SeasonalView } from "@/components/discover/seasonal-view";
import { GridSkeleton, PageHeaderSkeleton } from "@/components/anime/skeletons";

export const metadata: Metadata = { title: "Temporada de Anime", description: "Todos los animes de la temporada, ordenados por popularidad, nota o día de emisión.", alternates: { canonical: "/seasonal" } };

async function getDefaultSeasonalData() {
  "use cache";
  cacheLife("hours");
  cacheTag("anilist:seasonal:default");

  const current = seasonOf(new Date());
  const [p1, p2] = await Promise.all([
    getSeason(current.season, current.year, 1),
    getSeason(current.season, current.year, 2),
  ]);
  const media = [...p1.media, ...(p1.pageInfo.hasNextPage ? p2.media : [])];
  return {
    season: current.season,
    year: current.year,
    media,
    total: p1.pageInfo.total ?? media.length,
  };
}

export default async function SeasonalPage() {
  const initial = await getDefaultSeasonalData();
  return (
    <Suspense
      fallback={
        <>
          <PageHeaderSkeleton />
          <div className="container-k mt-10">
            <GridSkeleton />
          </div>
        </>
      }
    >
      <SeasonalView
        initialSeason={initial.season}
        initialYear={initial.year}
        initialMedia={initial.media}
        initialTotal={initial.total}
      />
    </Suspense>
  );
}
