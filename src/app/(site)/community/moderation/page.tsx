import type { Metadata } from "next";
import { CommunityTabs } from "@/components/social/community";
import { ModerationConsole } from "@/components/social/moderation";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };

export default function Page() {
  return (
    <>
      <CommunityTabs active="moderation" />
      <ModerationConsole />
    </>
  );
}
