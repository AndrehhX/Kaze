import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileStatsPage } from "@/components/profile/pages";
import { Skeleton } from "@/components/ui/primitives";

export async function generateMetadata({ params }: PageProps<"/profile/[username]/stats">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)} · ADN Anime` };
}

export default async function Page({ params }: PageProps<"/profile/[username]/stats">) {
  const { username } = await params;
  return (
    <Suspense fallback={<Skeleton className="container-k mt-8 h-80" />}>
      <ProfileStatsPage username={decodeURIComponent(username).slice(0, 32)} />
    </Suspense>
  );
}
