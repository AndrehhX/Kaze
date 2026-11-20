import type { Metadata } from "next";
import { Suspense } from "react";
import { getMeta } from "@/lib/anilist/service";
import { FALLBACK_GENRES } from "@/lib/anilist/browse-params";
import { MangaExplorer } from "@/components/manga/explorer";
import { GridSkeleton, PageHeaderSkeleton } from "@/components/anime/skeletons";

export const metadata: Metadata = { title: "Explorar manga", description: "Busca y filtra manga, manhwa y manhua por género, autor, estado, capítulos y más." };

async function loadMeta() {
  try {
    return await getMeta();
  } catch {
    return { genres: FALLBACK_GENRES, tags: [] };
  }
}

export default async function MangaDiscoverPage() {
  const meta = await loadMeta();
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
      <MangaExplorer meta={{ genres: meta.genres, tags: meta.tags.map((t) => ({ name: t.name, category: t.category })) }} />
    </Suspense>
  );
}
