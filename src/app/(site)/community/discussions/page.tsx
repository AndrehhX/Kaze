import type { Metadata } from "next";
import { CommunityTabs } from "@/components/social/community";
import { DiscussionList } from "@/components/social/discussions";

export const metadata: Metadata = { title: "Discussions" };

export default function Page() {
  return (
    <>
      <CommunityTabs active="discussions" />
      <div className="mt-8 max-w-4xl">
        <DiscussionList limit={50} />
      </div>
    </>
  );
}
