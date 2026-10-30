import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryView } from "@/components/library/library-view";
import { GridSkeleton, PageHeaderSkeleton } from "@/components/anime/skeletons";

export const metadata: Metadata = { title: "Mi Biblioteca" };

export default function LibraryPage() {
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
      <LibraryView />
    </Suspense>
  );
}
