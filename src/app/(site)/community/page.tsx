import type { Metadata } from "next";
import { CommunityHub, CommunityTabs } from "@/components/social/community";

export const metadata: Metadata = { title: "Community" };

export default function CommunityPage() {
  return (
    <>
      <CommunityTabs active="hub" />
      <CommunityHub />
    </>
  );
}
