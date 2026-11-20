import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogPage } from "../catalog-page";
import { STATIC_MANGA_PARAMS } from "../load";

export const metadata: Metadata = { title: "Capítulos" };

export function generateStaticParams() {
  return STATIC_MANGA_PARAMS;
}

export default function MangaChaptersPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="container-k mt-10 k-skeleton h-96" />}>
      {params.then(({ id }) => (
        <CatalogPage param={id} tab="chapters" />
      ))}
    </Suspense>
  );
}
