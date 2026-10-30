import type { Metadata } from "next";
import { Suspense } from "react";
import { getMeta } from "@/lib/anilist/service";
import { FALLBACK_GENRES } from "@/lib/anilist/browse-params";
import { DiscoverClient } from "@/components/discover/discover-client";
import { GridSkeleton, PageHeaderSkeleton } from "@/components/anime/skeletons";

export const metadata: Metadata = { title: "Discover", description: "Search and filter the full AniList anime catalog." };

async function loadMeta() {
  try {
    return await getMeta();
  } catch {
    // Filters still work with the built-in genre list if AniList is briefly unavailable.
    return { genres: FALLBACK_GENRES, tags: [] };
  }
}

export default async function DiscoverPage() {
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
      <DiscoverClient meta={{ genres: meta.genres, tags: meta.tags.map((t) => ({ name: t.name, category: t.category })) }} />
    </Suspense>
  );
}
