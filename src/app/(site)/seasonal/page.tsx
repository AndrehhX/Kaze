import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSeason } from "@/lib/anilist/service";
import { SEASONS } from "@/lib/anilist/browse-params";
import type { MediaSeason } from "@/lib/anilist/types";
import { seasonOf } from "@/lib/utils";
import { SeasonalView } from "@/components/discover/seasonal-view";
import { GridSkeleton, PageHeaderSkeleton } from "@/components/anime/skeletons";

export const metadata: Metadata = { title: "Seasonal chart" };

const ORDER: MediaSeason[] = ["WINTER", "SPRING", "SUMMER", "FALL"];

function shift(season: MediaSeason, year: number, d: number) {
  let i = ORDER.indexOf(season) + d;
  let y = year;
  while (i < 0) {
    i += 4;
    y--;
  }
  while (i > 3) {
    i -= 4;
    y++;
  }
  return { season: ORDER[i], year: y };
}

export default function SeasonalPage({ searchParams }: PageProps<"/seasonal">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeaderSkeleton />
          <div className="container-k mt-10">
            <GridSkeleton />
          </div>
        </>
      }
    >
      <SeasonalContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SeasonalContent({ searchParams }: { searchParams: PageProps<"/seasonal">["searchParams"] }) {
  const sp = await searchParams;
  const current = seasonOf(new Date());
  const season = ORDER.includes(sp.season as MediaSeason) ? (sp.season as MediaSeason) : current.season;
  const yearN = Number(sp.year);
  const year = Number.isInteger(yearN) && yearN >= 1940 && yearN <= current.year + 2 ? yearN : current.year;
  const [p1, p2] = await Promise.all([getSeason(season, year, 1), getSeason(season, year, 2)]);
  const media = [...p1.media, ...(p1.pageInfo.hasNextPage ? p2.media : [])];
  const prev = shift(season, year, -1);
  const next = shift(season, year, 1);
  const meta = SEASONS.find((s) => s.value === season)!;

  return (
    <div className="container-k pt-8">
      <header className="relative overflow-hidden">
        <span className="k-jp pointer-events-none absolute -top-8 right-0 select-none text-[10rem] font-bold leading-none text-fg/[0.05]" lang="ja" aria-hidden>
          {meta.jp}
        </span>
        <p className="k-label text-primary-ink">Seasonal chart</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <h1 className="font-display text-title">
            {meta.label} {year}
          </h1>
          <nav aria-label="Change season" className="flex items-center gap-1">
            <Link href={`/seasonal?season=${prev.season}&year=${prev.year}`} className="k-btn k-btn-ghost k-btn-sm">
              <ChevronLeft className="size-4" aria-hidden /> {SEASONS.find((s) => s.value === prev.season)!.label} {prev.year}
            </Link>
            <Link href={`/seasonal?season=${next.season}&year=${next.year}`} className="k-btn k-btn-ghost k-btn-sm">
              {SEASONS.find((s) => s.value === next.season)!.label} {next.year} <ChevronRight className="size-4" aria-hidden />
            </Link>
          </nav>
        </div>
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Seasons">
          {SEASONS.map((s) => (
            <li key={s.value}>
              <Link href={`/seasonal?season=${s.value}&year=${year}`} className="k-chip" data-active={s.value === season} aria-current={s.value === season ? "page" : undefined}>
                <span className="k-jp" lang="ja">{s.jp}</span> {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </header>
      <SeasonalView media={media} total={p1.pageInfo.total} />
    </div>
  );
}
