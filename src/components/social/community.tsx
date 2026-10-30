"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, PenLine, Search } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useDebounced } from "@/lib/hooks";
import { snapshotFromMedia } from "@/lib/library/types";
import { useAuth } from "@/stores/auth";
import { ReviewComposer, ReviewList } from "./reviews";
import { DiscussionList } from "./discussions";
import { useIsModerator } from "./moderation";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function CommunityTabs({ active }: { active: "hub" | "reviews" | "discussions" | "moderation" }) {
  const isMod = useIsModerator().data;
  const tabs = [
    ["hub", "/community", "Overview"],
    ["reviews", "/community/reviews", "Reviews"],
    ["discussions", "/community/discussions", "Discussions"],
    ...(isMod || active === "moderation" ? ([["moderation", "/community/moderation", "Moderation"]] as const) : []),
  ] as const;
  return (
    <nav aria-label="Community" className="mt-6 flex gap-1 border-b border-line">
      {tabs.map(([k, href, label]) => (
        <Link key={k} href={href} aria-current={active === k ? "page" : undefined} className={cn("relative px-4 py-3 text-sm font-semibold text-muted hover:text-fg", active === k && "text-fg after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-primary")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function CommunityHub() {
  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <section aria-labelledby="top-reviews">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="top-reviews" className="font-display text-section">Most appreciated reviews</h2>
          <Link href="/community/reviews" className="k-btn k-btn-ghost k-btn-sm">
            All <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <ReviewList sort="top" showMedia limit={5} />
      </section>
      <section aria-labelledby="active-threads">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="active-threads" className="font-display text-section">Active threads</h2>
          <Link href="/community/discussions" className="k-btn k-btn-ghost k-btn-sm">
            All <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <DiscussionList limit={8} />
        <div className="k-card mt-6 p-5 text-sm text-muted">
          <p className="font-display text-base text-fg">Community guidelines</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Mark spoilers — readers must opt in to see them.</li>
            <li>Critique shows, not people.</li>
            <li>Report anything harmful; moderators review every report.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

/** Reviews page: optional "write" flow (?write=<anilistId>) plus the full list. */
export function ReviewsPage() {
  const sp = useSearchParams();
  const status = useAuth((s) => s.status);
  const writeId = Number(sp.get("write")) || null;
  const [pick, setPick] = useState<number | null>(writeId);
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 250);
  const [sort, setSort] = useState<"recent" | "top">("recent");
  const media = useQuery({ queryKey: ["media", pick], queryFn: ({ signal }) => api.media(pick!, signal), enabled: Boolean(pick) });
  const suggest = useQuery({ queryKey: ["suggest", dq], queryFn: ({ signal }) => api.suggest(dq, signal), enabled: dq.length >= 2 && !pick });

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-4 flex gap-1.5" role="group" aria-label="Sort reviews">
          <button className="k-chip" aria-pressed={sort === "recent"} onClick={() => setSort("recent")}>Newest</button>
          <button className="k-chip" aria-pressed={sort === "top"} onClick={() => setSort("top")}>Most liked</button>
        </div>
        <ReviewList sort={sort} showMedia limit={40} />
      </div>
      <aside className="lg:sticky lg:top-[calc(var(--k-nav-h)+24px)] lg:self-start">
        {status === "signed-in" ? (
          pick ? (
            media.isLoading ? (
              <Skeleton className="h-96" />
            ) : media.data ? (
              <div>
                <p className="mb-2 text-sm">
                  Reviewing <strong>{media.data.media.title.english || media.data.media.title.romaji}</strong>{" "}
                  <button className="text-primary-ink underline" onClick={() => setPick(null)}>change</button>
                </p>
                <ReviewComposer mediaId={pick} snapshot={snapshotFromMedia(media.data.media)} onDone={() => setPick(null)} />
              </div>
            ) : (
              <p className="text-sm text-danger">Couldn&apos;t load that anime.</p>
            )
          ) : (
            <div className="k-card p-5">
              <p className="flex items-center gap-2 font-display text-lg">
                <PenLine className="size-5 text-primary-ink" aria-hidden /> Write a review
              </p>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <label htmlFor="rv-pick" className="sr-only">Find an anime to review</label>
                <input id="rv-pick" className="k-input !pl-9" placeholder="Which anime?" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <ul className="mt-2">
                {suggest.data?.results.map((r) => (
                  <li key={r.id}>
                    <button className="w-full rounded-[min(var(--k-radius-btn),10px)] px-3 py-2 text-left text-sm hover:bg-[var(--k-btn-ghost)]" onClick={() => setPick(r.id)}>
                      {r.title.english || r.title.romaji} <span className="text-xs text-muted">{r.seasonYear}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <div className="k-card p-5 text-sm text-muted">
            <Link href="/login" className="font-semibold text-primary-ink">Sign in</Link> to write reviews. Every review on KAZE comes from a real member.
          </div>
        )}
      </aside>
    </div>
  );
}
