import type { Metadata } from "next";
import { FriendsPage } from "@/components/social/friends";

export const metadata: Metadata = { title: "Friends" };

export default function Page() {
  return (
    <div className="container-k pt-8">
      <p className="k-label text-primary-ink">Your people</p>
      <h1 className="font-display text-title mt-2">Friends</h1>
      <FriendsPage />
    </div>
  );
}
