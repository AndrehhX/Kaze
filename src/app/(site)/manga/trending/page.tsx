import type { Metadata } from "next";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { browseManga } from "@/lib/anilist/manga-service";
import { MangaRanking } from "@/components/manga/ranking";
import { ErrorPanel } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Manga en tendencia", description: "Los manga con más actividad reciente en AniList." };

async function loadTrending() {
  "use cache";
  cacheLife("hours");
  return browseManga({ sort: "TRENDING_DESC", perPage: 50 });
}

export default function MangaTrendingPage() {
  return (
    <Suspense fallback={<div className="container-k mt-10 k-skeleton h-[60vh]" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const d = await loadTrending().catch(() => null);
  if (!d)
    return (
      <div className="container-k mt-10">
        <ErrorPanel title="AniList no responde" message="Vuelve a intentarlo en unos minutos." />
      </div>
    );
  return <MangaRanking title="Tendencias" jp="急上昇" kicker="Ranking en vivo · AniList" explanation="Ordenado por el indicador de tendencia de AniList: actividad reciente de lectores (listas, puntuaciones y progreso), no por ventas." media={d.media} />;
}
