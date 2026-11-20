import type { Metadata } from "next";
import { Suspense } from "react";
import { MangaCollectionDetail } from "@/components/manga/library/collections";

export const metadata: Metadata = { title: "Colección de manga", robots: { index: false } };

export default function MangaCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="container-k mt-10 k-skeleton h-64" />}>
      {params.then(({ id }) => (
        <MangaCollectionDetail id={id} />
      ))}
    </Suspense>
  );
}
