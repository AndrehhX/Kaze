import type { Metadata } from "next";
import { ProfileOverviewPage } from "@/components/profile/pages";

export async function generateMetadata({ params }: PageProps<"/profile/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

export default async function Page({ params }: PageProps<"/profile/[username]">) {
  const { username } = await params;
  return <ProfileOverviewPage username={decodeURIComponent(username).slice(0, 32)} />;
}
