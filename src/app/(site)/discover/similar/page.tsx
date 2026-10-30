import type { Metadata } from "next";
import { Suspense } from "react";
import { SimilarityGraph } from "@/components/discover/similarity-graph";
import { PageHeaderSkeleton } from "@/components/anime/skeletons";

export const metadata: Metadata = { title: "Similarity Explorer" };

export default function SimilarPage() {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <SimilarityGraph />
    </Suspense>
  );
}
