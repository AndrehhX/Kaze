import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogPage } from "../catalog-page";

export const metadata: Metadata = { title: "Volúmenes" };

export default function MangaVolumesPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="container-k mt-10 k-skeleton h-96" />}>
      {params.then(({ id }) => (
        <CatalogPage param={id} tab="volumes" />
      ))}
    </Suspense>
  );
}
