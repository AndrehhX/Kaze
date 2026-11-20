import { Suspense } from "react";
import { redirect } from "next/navigation";

/** /manga/search is an alias of the explorer: it keeps every query parameter. */
export default function MangaSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={null}>
      <Redirector searchParams={searchParams} />
    </Suspense>
  );
}

async function Redirector({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  return redirect(qs.size ? `/manga/discover?${qs}` : "/manga/discover");
}
