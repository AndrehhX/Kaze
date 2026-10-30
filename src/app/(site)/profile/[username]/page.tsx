import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileOverviewPage } from "@/components/profile/pages";
import { Skeleton } from "@/components/ui/primitives";

export async function generateMetadata({ params }: PageProps<"/profile/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

export default async function Page({ params }: PageProps<"/profile/[username]">) {
  const { username } = await params;
  return (
    <Suspense fallback={<Skeleton className="container-k mt-8 h-80" />}>
      <ProfileOverviewPage username={decodeURIComponent(username).slice(0, 32)} />
    </Suspense>
  );
}
