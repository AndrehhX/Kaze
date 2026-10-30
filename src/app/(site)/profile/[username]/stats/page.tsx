import type { Metadata } from "next";
import { ProfileStatsPage } from "@/components/profile/pages";

export async function generateMetadata({ params }: PageProps<"/profile/[username]/stats">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)} · Anime DNA` };
}

export default async function Page({ params }: PageProps<"/profile/[username]/stats">) {
  const { username } = await params;
  return <ProfileStatsPage username={decodeURIComponent(username).slice(0, 32)} />;
}
