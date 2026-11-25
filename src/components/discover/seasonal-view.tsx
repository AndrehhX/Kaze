"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { SEASONS } from "@/lib/anilist/browse-params";
import type { MediaCard, MediaSeason } from "@/lib/anilist/types";
import { AnimeCard, displayTitle } from "@/components/anime/anime-card";
import { GridSkeleton } from "@/components/anime/skeletons";
import { EmptyState, ErrorPanel } from "@/components/ui/primitives";
import { formatLabel } from "@/lib/utils";
import { useMounted } from "@/lib/hooks";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER: MediaSeason[] = ["WINTER", "SPRING", "SUMMER", "FALL"];
type Sort = "popularity" | "score" | "title" | "day";

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

async function fetchSeasonClient(season: MediaSeason, year: number, signal?: AbortSignal) {
  const res1 = await fetch(`/api/anilist/browse?season=${season}&year=${year}&sort=POPULARITY_DESC&page=1&perPage=50`, {
    signal,
    headers: { Accept: "application/json" },
  });
  const body1 = await res1.json().catch(() => null);
  if (!res1.ok) throw new Error(body1?.error ?? "No se pudo cargar la temporada");

  let media: MediaCard[] = body1.media ?? [];
  if (body1.pageInfo?.hasNextPage) {
    const res2 = await fetch(`/api/anilist/browse?season=${season}&year=${year}&sort=POPULARITY_DESC&page=2&perPage=50`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (res2.ok) {
      const body2 = await res2.json().catch(() => null);
      if (Array.isArray(body2?.media)) {
        media = [...media, ...body2.media];
      }
    }
  }
  return { media, total: body1.pageInfo?.total ?? media.length };
}

export function SeasonalView({
  initialSeason,
  initialYear,
  initialMedia,
  initialTotal,
}: {
  initialSeason: MediaSeason;
  initialYear: number;
  initialMedia: MediaCard[];
  initialTotal: number;
}) {
  const sp = useSearchParams();
  const qSeason = sp.get("season") as MediaSeason | null;
  const qYear = Number(sp.get("year"));

  const season = qSeason && ORDER.includes(qSeason) ? qSeason : initialSeason;
  const year = Number.isInteger(qYear) && qYear >= 1940 && qYear <= initialYear + 2 ? qYear : initialYear;
  const isDefault = season === initialSeason && year === initialYear;

  const query = useQuery({
    queryKey: ["seasonal", season, year],
    queryFn: ({ signal }) => fetchSeasonClient(season, year, signal),
    enabled: !isDefault,
    staleTime: 60 * 60_000,
  });

  const media = useMemo(() => (isDefault ? initialMedia : (query.data?.media ?? [])), [isDefault, initialMedia, query.data]);
  const total = isDefault ? initialTotal : (query.data?.total ?? 0);

  const [sort, setSort] = useState<Sort>("popularity");
  const [format, setFormat] = useState<string>("ALL");
  const mounted = useMounted();

  const prev = shift(season, year, -1);
  const next = shift(season, year, 1);
  const meta = SEASONS.find((s) => s.value === season)!;

  const formats = useMemo(() => ["ALL", ...new Set(media.map((m) => m.format).filter(Boolean) as string[])], [media]);
  const list = useMemo(() => {
    const l = media.filter((m) => format === "ALL" || m.format === format);
    if (sort === "score") l.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));
    else if (sort === "title") l.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)));
    else if (sort === "popularity") l.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    return l;
  }, [media, sort, format]);

  const byDay = useMemo(() => {
    if (sort !== "day" || !mounted) return null;
    const groups: Record<string, MediaCard[]> = {};
    for (const m of list) {
      const key = m.nextAiringEpisode ? DAYS[new Date(m.nextAiringEpisode.airingAt * 1000).getDay()] : "Sin emisión ahora mismo";
      (groups[key] ??= []).push(m);
    }
    const today = new Date().getDay();
    const order = [...DAYS.slice(today), ...DAYS.slice(0, today), "Sin emisión ahora mismo"];
    return order.filter((d) => groups[d]).map((d) => ({ day: d, items: groups[d].sort((a, b) => (a.nextAiringEpisode?.airingAt ?? 0) - (b.nextAiringEpisode?.airingAt ?? 0)) }));
  }, [list, sort, mounted]);

  const grid = (items: MediaCard[]) => (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((m) => (
        <li key={m.id}>
          <AnimeCard media={m} layoutScope="seasonal" />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="container-k pt-8">
      <header className="relative overflow-hidden">
        <span className="k-jp pointer-events-none absolute -top-8 right-0 select-none text-[10rem] font-bold leading-none text-fg/[0.05]" lang="ja" aria-hidden>
          {meta.jp}
        </span>
        <p className="k-label text-primary-ink">Tabla de temporada</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <h1 className="font-display text-title">
            {meta.label} {year}
          </h1>
          <nav aria-label="Cambiar de temporada" className="flex items-center gap-1">
            <Link href={`/seasonal?season=${prev.season}&year=${prev.year}`} prefetch={false} className="k-btn k-btn-ghost k-btn-sm">
              <ChevronLeft className="size-4" aria-hidden /> {SEASONS.find((s) => s.value === prev.season)!.label} {prev.year}
            </Link>
            <Link href={`/seasonal?season=${next.season}&year=${next.year}`} prefetch={false} className="k-btn k-btn-ghost k-btn-sm">
              {SEASONS.find((s) => s.value === next.season)!.label} {next.year} <ChevronRight className="size-4" aria-hidden />
            </Link>
          </nav>
        </div>
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Temporadas">
          {SEASONS.map((s) => (
            <li key={s.value}>
              <Link href={`/seasonal?season=${s.value}&year=${year}`} prefetch={false} className="k-chip" data-active={s.value === season} aria-current={s.value === season ? "page" : undefined}>
                <span className="k-jp" lang="ja">{s.jp}</span> {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      {!isDefault && query.isLoading ? (
        <div className="mt-8">
          <GridSkeleton />
        </div>
      ) : !isDefault && query.error ? (
        <div className="mt-8">
          <ErrorPanel title="No se pudo cargar la temporada" message={(query.error as Error).message} onRetry={() => query.refetch()} />
        </div>
      ) : !media.length ? (
        <EmptyState className="mt-10" title="Aún no hay títulos anunciados para esta temporada" body="AniList todavía no registra nada. Vuelve a mirar cuando se acerque la temporada." />
      ) : (
        <div className="mt-8">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Formato">
              {formats.map((f) => (
                <button key={f} className="k-chip" aria-pressed={format === f} onClick={() => setFormat(f)}>
                  {f === "ALL" ? "Todos los formatos" : formatLabel(f)}
                </button>
              ))}
            </div>
            <label htmlFor="season-sort" className="sr-only">Ordenar</label>
            <select id="season-sort" className="k-input ml-auto !min-h-9 w-auto text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="popularity">Popularidad</option>
              <option value="score">Puntuación</option>
              <option value="title">Título</option>
              <option value="day">Día de emisión</option>
            </select>
            <span className="text-sm text-muted">{total} titles</span>
          </div>
          {byDay
            ? byDay.map((g) => (
                <section key={g.day} aria-labelledby={`day-${g.day}`} className="mb-12">
                  <h2 id={`day-${g.day}`} className="font-display mb-4 flex items-center gap-3 text-xl">
                    {g.day} <span className="k-rule flex-1" aria-hidden />
                  </h2>
                  {grid(g.items)}
                </section>
              ))
            : grid(list)}
        </div>
      )}
    </div>
  );
}
