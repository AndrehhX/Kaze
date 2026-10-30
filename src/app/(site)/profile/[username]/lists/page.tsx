import type { Metadata } from "next";
import { ProfileListsPage } from "@/components/profile/pages";

export async function generateMetadata({ params }: PageProps<"/profile/[username]/lists">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)} · Lists` };
}

export default async function Page({ params }: PageProps<"/profile/[username]/lists">) {
  const { username } = await params;
  return <ProfileListsPage username={decodeURIComponent(username).slice(0, 32)} />;
}
