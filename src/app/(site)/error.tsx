"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[kaze] route error", error.message);
  }, [error]);
  const anilist = /anilist|rate limit/i.test(error.message);
  return (
    <div className="container-k grid min-h-[60dvh] place-items-center py-20 text-center">
      <div role="alert" className="max-w-lg">
        <p className="k-jp text-7xl text-primary-ink" lang="ja" aria-hidden>
          嵐
        </p>
        <h1 className="font-display text-title mt-4">{anilist ? "The catalog is catching its breath" : "Something went wrong"}</h1>
        <p className="mt-3 text-muted">
          {anilist
            ? "AniList is rate-limiting or unreachable right now. Your library and the demo player still work — try again in a minute."
            : "An unexpected error interrupted this page. You can retry, or head back home."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="k-btn k-btn-primary" onClick={reset}>
            Try again
          </button>
          <Link href="/library" className="k-btn k-btn-ghost">
            Open my library
          </Link>
        </div>
      </div>
    </div>
  );
}
