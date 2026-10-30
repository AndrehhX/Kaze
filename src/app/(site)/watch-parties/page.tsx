import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchPartiesIndex } from "@/components/watch-party/parties";

export const metadata: Metadata = { title: "Watch Parties" };

export default function Page() {
  return (
    <div className="container-k pt-8">
      <p className="k-label text-primary-ink">Synchronized viewing</p>
      <h1 className="font-display text-title mt-2">Watch Parties</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Watch together in perfect sync. The host controls playback; everyone streams from an authorized source on their own device, kept in step by the server&apos;s clock.
      </p>
      <Suspense fallback={<div className="k-skeleton mt-8 h-64" />}>
        <WatchPartiesIndex />
      </Suspense>
    </div>
  );
}
