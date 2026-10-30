import type { Metadata } from "next";
import { Suspense } from "react";
import { CommunityTabs, ReviewsPage } from "@/components/social/community";

export const metadata: Metadata = { title: "Reseñas" };

export default function Page() {
  return (
    <>
      <CommunityTabs active="reviews" />
      <Suspense fallback={<div className="k-skeleton mt-8 h-96" />}>
        <ReviewsPage />
      </Suspense>
    </>
  );
}
