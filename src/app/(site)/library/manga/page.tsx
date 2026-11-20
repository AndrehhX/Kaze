import type { Metadata } from "next";
import { Suspense } from "react";
import { MangaLibraryView } from "@/components/manga/library/manga-library";
import { GridSkeleton, PageHeaderSkeleton } from "@/components/anime/skeletons";

export const metadata: Metadata = { title: "Mi manga" };

export default function MangaLibraryPage() {
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
      <MangaLibraryView />
    </Suspense>
  );
}
