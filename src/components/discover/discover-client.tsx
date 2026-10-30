"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Bookmark, BookmarkPlus, LayoutGrid, List, Loader2, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { activeFilterCount, FORMATS, parseBrowseParams, SEASONS, serializeBrowseParams, SORTS, SOURCES, STATUSES } from "@/lib/anilist/browse-params";
import type { BrowseParams, MediaCard } from "@/lib/anilist/types";
import { api } from "@/lib/api-client";
import { AnimeCard, displayTitle, ScorePill } from "@/components/anime/anime-card";
import { ListMenu } from "@/components/anime/list-actions";
import { GridSkeleton } from "@/components/anime/skeletons";
import { EmptyState, ErrorPanel, SafeImage } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { Highlight } from "@/components/shell/command-palette";
import { useLocal } from "@/stores/local";
import { useDebounced, useMediaQuery } from "@/lib/hooks";
import { cn, formatLabel, formatNumber, statusLabel } from "@/lib/utils";

type Meta = { genres: string[]; tags: { name: string; category: string }[] };

export function DiscoverClient({ meta }: { meta: Meta }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const params = useMemo(() => parseBrowseParams(new URLSearchParams(sp.toString())), [sp]);
  const [q, setQ] = useState(params.search ?? "");
  const debouncedQ = useDebounced(q, 300);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sheet, setSheet] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const pushSearch = useLocal((s) => s.pushSearch);

  const setParams = (patch: Partial<BrowseParams>) => {
    const next = { ...params, ...patch, page: undefined };
    const qs = serializeBrowseParams(next).toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // URL ← debounced search box
  useEffect(() => {
    if ((params.search ?? "") === debouncedQ.trim()) return;
    setParams({ search: debouncedQ.trim() || undefined, sort: debouncedQ.trim() && !params.sort ? undefined : params.sort });
    if (debouncedQ.trim().length >= 2) pushSearch(debouncedQ.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);
  // search box ← URL (back/forward): adjust state during render, not in an effect.
  const [urlSearch, setUrlSearch] = useState(params.search ?? "");
  if ((params.search ?? "") !== urlSearch) {
    setUrlSearch(params.search ?? "");
    setQ(params.search ?? "");
  }

  const query = useInfiniteQuery({
    queryKey: ["browse", serializeBrowseParams(params).toString()],
    queryFn: ({ pageParam, signal }) => api.browse({ ...params, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.currentPage + 1 : undefined),
  });
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (query.data?.pages ?? []).flatMap((p) => p.media).filter((m) => !seen.has(m.id) && seen.add(m.id));
  }, [query.data]);
  const total = query.data?.pages[0]?.pageInfo.total;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  const count = activeFilterCount(params);
  const filters = <FilterPanel params={params} meta={meta} setParams={setParams} />;

  return (
    <div className="container-k pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="k-label text-primary-ink">AniList catalog</p>
          <h1 className="font-display text-title mt-2">Discover</h1>
        </div>
        <nav aria-label="Discovery experiences" className="flex flex-wrap gap-2">
          <Link href="/discover/moods" className="k-btn k-btn-ghost k-btn-sm">Mood Explorer</Link>
          <Link href="/discover/roulette" className="k-btn k-btn-ghost k-btn-sm">Roulette</Link>
          <Link href="/discover/similar" className="k-btn k-btn-ghost k-btn-sm">Similarity graph</Link>
        </nav>
      </header>

      <div className="sticky top-[var(--k-nav-h)] z-30 -mx-[var(--k-gutter)] mt-6 bg-gradient-to-b from-bg via-bg/95 to-bg/0 px-[var(--k-gutter)] pb-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="discover-q" className="sr-only">
              Search anime
            </label>
            <input
              id="discover-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title — English, romaji or Japanese"
              className="k-input !min-h-12 !pl-11 text-base"
              autoComplete="off"
            />
            {query.isFetching && !query.isFetchingNextPage && <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
          </div>
          <label className="sr-only" htmlFor="discover-sort">
            Sort
          </label>
          <select id="discover-sort" className="k-input !min-h-12 w-auto" value={params.sort ?? (params.search ? "SEARCH_MATCH" : "POPULARITY_DESC")} onChange={(e) => setParams({ sort: e.target.value as BrowseParams["sort"] })}>
            {params.search && <option value="SEARCH_MATCH">Best match</option>}
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="k-btn k-btn-outline !min-h-12 lg:hidden" onClick={() => setSheet(true)}>
            <SlidersHorizontal className="size-4" aria-hidden /> Filters{count ? ` · ${count}` : ""}
          </button>
          <div className="flex rounded-[var(--k-radius-btn)] bg-[var(--k-btn-ghost)] p-1" role="group" aria-label="Layout">
            <button className={cn("k-btn k-btn-icon k-btn-sm", view === "grid" ? "bg-surface shadow" : "")} aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => setView("grid")}>
              <LayoutGrid className="size-4" />
            </button>
            <button className={cn("k-btn k-btn-icon k-btn-sm", view === "list" ? "bg-surface shadow" : "")} aria-pressed={view === "list"} aria-label="List view" onClick={() => setView("list")}>
              <List className="size-4" />
            </button>
          </div>
        </div>
        <ActiveFilters params={params} setParams={setParams} total={total} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {desktop && <aside className="sticky top-[calc(var(--k-nav-h)+120px)] max-h-[calc(100dvh-var(--k-nav-h)-140px)] self-start overflow-y-auto pr-2">{filters}</aside>}
        <div className="min-w-0" aria-live="polite" aria-busy={query.isLoading}>
          {query.isLoading && <GridSkeleton />}
          {query.isError && <ErrorPanel title="Search is unavailable" message={(query.error as Error).message} onRetry={() => query.refetch()} />}
          {query.isSuccess && !items.length && (
            <EmptyState
              icon={<Search className="size-6" />}
              jp="空"
              title="Nothing matches those filters"
              body={params.search ? `No anime found for “${params.search}”. Check the spelling or try the romaji title.` : "Try removing a filter or two."}
              action={
                <button className="k-btn k-btn-outline k-btn-sm" onClick={() => router.replace(pathname)}>
                  <RotateCcw className="size-4" aria-hidden /> Reset filters
                </button>
              }
            />
          )}
          {items.length > 0 &&
            (view === "grid" ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 xs:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 3xl:grid-cols-6">
                {items.map((m) => (
                  <li key={m.id}>
                    <AnimeCard media={m} layoutScope="discover" sizes="(max-width:640px) 45vw, (max-width:1280px) 22vw, 200px" />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="k-card divide-y divide-line">
                {items.map((m) => (
                  <ListRow key={m.id} m={m} q={params.search ?? ""} />
                ))}
              </ul>
            ))}
          <div ref={sentinel} className="h-px" />
          {query.isFetchingNextPage && <GridSkeleton count={6} />}
          {query.hasNextPage && !query.isFetchingNextPage && items.length > 0 && (
            <div className="mt-8 flex justify-center">
              <button className="k-btn k-btn-outline" onClick={() => query.fetchNextPage()}>
                Load more
              </button>
            </div>
          )}
        </div>
      </div>

      {!desktop && (
        <Dialog open={sheet} onOpenChange={setSheet} title="Filters" side="bottom">
          <div className="px-5 pb-6">{filters}</div>
          <div className="sticky bottom-0 border-t border-line bg-surface p-4">
            <button className="k-btn k-btn-primary w-full" onClick={() => setSheet(false)}>
              Show {total != null ? formatNumber(total) : ""} results
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ListRow({ m, q }: { m: MediaCard; q: string }) {
  return (
    <li className="flex items-center gap-4 p-3">
      <Link href={`/anime/${m.id}`} className="k-poster relative aspect-[2/3] w-14 shrink-0">
        <SafeImage src={m.coverImage.large ?? ""} alt="" fill sizes="56px" className="object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/anime/${m.id}`} className="font-semibold hover:text-primary-ink">
          <Highlight text={displayTitle(m)} query={q} />
        </Link>
        <p className="truncate text-xs text-muted">
          {[formatLabel(m.format), m.episodes ? `${m.episodes} ep` : null, statusLabel(m.status), m.seasonYear, m.studios.nodes[0]?.name].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 truncate text-xs text-muted">{m.genres.join(", ")}</p>
      </div>
      <ScorePill score={m.averageScore} className="max-sm:hidden" />
      <ListMenu media={m} size="sm" align="end" />
    </li>
  );
}

function ActiveFilters({ params, setParams, total }: { params: BrowseParams; setParams: (p: Partial<BrowseParams>) => void; total?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const saved = useLocal((s) => s.savedSearches);
  const saveSearch = useLocal((s) => s.saveSearch);
  const removeSaved = useLocal((s) => s.removeSavedSearch);
  const chips: { label: string; clear: () => void }[] = [];
  params.genres?.forEach((g) => chips.push({ label: g, clear: () => setParams({ genres: params.genres!.filter((x) => x !== g) }) }));
  params.tags?.forEach((t) => chips.push({ label: `#${t}`, clear: () => setParams({ tags: params.tags!.filter((x) => x !== t) }) }));
  params.formats?.forEach((f) => chips.push({ label: formatLabel(f), clear: () => setParams({ formats: params.formats!.filter((x) => x !== f) }) }));
  if (params.season) chips.push({ label: params.season.toLowerCase(), clear: () => setParams({ season: undefined }) });
  if (params.year) chips.push({ label: String(params.year), clear: () => setParams({ year: undefined }) });
  if (params.yearFrom || params.yearTo) chips.push({ label: `${params.yearFrom ?? "…"}–${params.yearTo ?? "…"}`, clear: () => setParams({ yearFrom: undefined, yearTo: undefined }) });
  if (params.status) chips.push({ label: statusLabel(params.status), clear: () => setParams({ status: undefined }) });
  if (params.minScore) chips.push({ label: `≥ ${params.minScore}%`, clear: () => setParams({ minScore: undefined }) });
  if (params.minEpisodes || params.maxEpisodes) chips.push({ label: `${params.minEpisodes ?? 0}–${params.maxEpisodes ?? "∞"} eps`, clear: () => setParams({ minEpisodes: undefined, maxEpisodes: undefined }) });
  if (params.minPopularity || params.maxPopularity) chips.push({ label: `${formatNumber(params.minPopularity ?? 0)}–${params.maxPopularity ? formatNumber(params.maxPopularity) : "∞"} members`, clear: () => setParams({ minPopularity: undefined, maxPopularity: undefined }) });
  if (params.source) chips.push({ label: params.source.toLowerCase().replace("_", " "), clear: () => setParams({ source: undefined }) });
  if (params.studio) chips.push({ label: params.studio, clear: () => setParams({ studio: undefined }) });
  const qs = serializeBrowseParams({ ...params, page: undefined }).toString();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
      {total != null && <span className="mr-2 text-muted tabular-nums">{formatNumber(total)} results</span>}
      {chips.map((c) => (
        <button key={c.label} className="k-chip capitalize" data-active="true" onClick={c.clear} aria-label={`Remove filter ${c.label}`}>
          {c.label} <X className="size-3" aria-hidden />
        </button>
      ))}
      {chips.length > 0 && (
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => router.replace(params.search ? `${pathname}?q=${encodeURIComponent(params.search)}` : pathname, { scroll: false })}>
          <RotateCcw className="size-3.5" aria-hidden /> Reset
        </button>
      )}
      {qs && !saved.some((s) => s.query === qs) && (
        <button
          className="k-btn k-btn-ghost k-btn-sm"
          onClick={() => {
            saveSearch(params.search || chips.map((c) => c.label).slice(0, 3).join(" · ") || "Saved search", qs);
            toast.success("Search saved on this device");
          }}
        >
          <BookmarkPlus className="size-3.5" aria-hidden /> Save search
        </button>
      )}
      {saved.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          <Bookmark className="size-3.5 text-muted" aria-label="Saved searches" />
          {saved.slice(0, 5).map((s) => (
            <span key={s.id} className="k-chip !pr-1">
              <Link href={`${pathname}?${s.query}`} className="max-w-36 truncate">
                {s.name}
              </Link>
              <button onClick={() => removeSaved(s.id)} aria-label={`Delete saved search ${s.name}`} className="grid size-5 place-items-center rounded-full hover:bg-[var(--k-btn-ghost)]">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-line py-4 first:pt-0">
      <legend className="k-label mb-3 text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function NumberPair({ idA, idB, a, b, onChange, placeholder }: { idA: string; idB: string; a?: number; b?: number; onChange: (a?: number, b?: number) => void; placeholder: [string, string] }) {
  const [va, setVa] = useState(a?.toString() ?? "");
  const [vb, setVb] = useState(b?.toString() ?? "");
  const commit = () => onChange(va ? Number(va) : undefined, vb ? Number(vb) : undefined);
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={idA} className="sr-only">{placeholder[0]}</label>
      <input id={idA} inputMode="numeric" className="k-input !min-h-9 text-sm" placeholder={placeholder[0]} value={va} onChange={(e) => setVa(e.target.value.replace(/\D/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
      <span className="text-muted">–</span>
      <label htmlFor={idB} className="sr-only">{placeholder[1]}</label>
      <input id={idB} inputMode="numeric" className="k-input !min-h-9 text-sm" placeholder={placeholder[1]} value={vb} onChange={(e) => setVb(e.target.value.replace(/\D/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
    </div>
  );
}

function FilterPanel({ params, meta, setParams }: { params: BrowseParams; meta: Meta; setParams: (p: Partial<BrowseParams>) => void }) {
  const [tagQ, setTagQ] = useState("");
  const [studio, setStudio] = useState(params.studio ?? "");
  const [urlStudio, setUrlStudio] = useState(params.studio ?? "");
  if ((params.studio ?? "") !== urlStudio) {
    setUrlStudio(params.studio ?? "");
    setStudio(params.studio ?? "");
  }
  const toggle = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);
  const tagMatches = tagQ.length >= 2 ? meta.tags.filter((t) => t.name.toLowerCase().includes(tagQ.toLowerCase())).slice(0, 12) : [];
  const thisYear = new Date().getFullYear();

  return (
    <div className="text-sm">
      <FilterGroup title="Genres">
        <div className="flex flex-wrap gap-1.5">
          {meta.genres.map((g) => (
            <button key={g} className="k-chip" aria-pressed={Boolean(params.genres?.includes(g))} onClick={() => setParams({ genres: toggle(params.genres, g) })}>
              {g}
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Tags">
        <label htmlFor="tag-q" className="sr-only">Search tags</label>
        <input id="tag-q" className="k-input !min-h-9 text-sm" placeholder="Search tags (e.g. Time Travel)" value={tagQ} onChange={(e) => setTagQ(e.target.value)} />
        {tagMatches.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tagMatches.map((t) => (
              <button key={t.name} className="k-chip" aria-pressed={Boolean(params.tags?.includes(t.name))} onClick={() => setParams({ tags: toggle(params.tags, t.name) })} title={t.category}>
                {t.name}
              </button>
            ))}
          </div>
        )}
      </FilterGroup>
      <FilterGroup title="Season & year">
        <div className="flex flex-wrap gap-1.5">
          {SEASONS.map((s) => (
            <button key={s.value} className="k-chip" aria-pressed={params.season === s.value} onClick={() => setParams({ season: params.season === s.value ? undefined : s.value, year: params.year ?? thisYear })}>
              <span className="k-jp" lang="ja">{s.jp}</span> {s.label}
            </button>
          ))}
        </div>
        <label htmlFor="f-year" className="mt-3 block text-xs text-muted">Exact year</label>
        <select id="f-year" className="k-input mt-1 !min-h-9 text-sm" value={params.year ?? ""} onChange={(e) => setParams({ year: e.target.value ? Number(e.target.value) : undefined, yearFrom: undefined, yearTo: undefined })}>
          <option value="">Any</option>
          {Array.from({ length: thisYear - 1959 }, (_, i) => thisYear + 1 - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <p className="mt-3 text-xs text-muted">Or a range</p>
        <div className="mt-1">
          <NumberPair key={`y${params.yearFrom}-${params.yearTo}`} idA="f-from" idB="f-to" a={params.yearFrom} b={params.yearTo} onChange={(a, b) => setParams({ yearFrom: a, yearTo: b, year: undefined, season: undefined })} placeholder={["From", "To"]} />
        </div>
      </FilterGroup>
      <FilterGroup title="Format">
        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <button key={f.value} className="k-chip" aria-pressed={Boolean(params.formats?.includes(f.value))} onClick={() => setParams({ formats: toggle(params.formats, f.value) })}>
              {f.label}
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Status">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button key={s.value} className="k-chip" aria-pressed={params.status === s.value} onClick={() => setParams({ status: params.status === s.value ? undefined : s.value })}>
              {s.label}
            </button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={`Minimum score${params.minScore ? ` · ${params.minScore}%` : ""}`}>
        <input type="range" min={0} max={95} step={5} defaultValue={params.minScore ?? 0} key={params.minScore ?? 0} onPointerUp={(e) => setParams({ minScore: Number(e.currentTarget.value) || undefined })} onKeyUp={(e) => setParams({ minScore: Number(e.currentTarget.value) || undefined })} className="w-full accent-[var(--k-primary)]" aria-label="Minimum average score" />
      </FilterGroup>
      <FilterGroup title="Episodes">
        <NumberPair key={`e${params.minEpisodes}-${params.maxEpisodes}`} idA="f-epmin" idB="f-epmax" a={params.minEpisodes} b={params.maxEpisodes} onChange={(a, b) => setParams({ minEpisodes: a, maxEpisodes: b })} placeholder={["Min", "Max"]} />
      </FilterGroup>
      <FilterGroup title="Popularity (AniList members)">
        <NumberPair key={`p${params.minPopularity}-${params.maxPopularity}`} idA="f-pmin" idB="f-pmax" a={params.minPopularity} b={params.maxPopularity} onChange={(a, b) => setParams({ minPopularity: a, maxPopularity: b })} placeholder={["Min", "Max"]} />
      </FilterGroup>
      <FilterGroup title="Source material">
        <select className="k-input !min-h-9 text-sm" aria-label="Source material" value={params.source ?? ""} onChange={(e) => setParams({ source: (e.target.value || undefined) as BrowseParams["source"] })}>
          <option value="">Any</option>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </FilterGroup>
      <FilterGroup title="Studio">
        <form onSubmit={(e) => (e.preventDefault(), setParams({ studio: studio.trim() || undefined }))} className="flex gap-2">
          <label htmlFor="f-studio" className="sr-only">Studio name</label>
          <input id="f-studio" className="k-input !min-h-9 text-sm" placeholder="e.g. MAPPA" value={studio} onChange={(e) => setStudio(e.target.value)} />
          <button className="k-btn k-btn-outline k-btn-sm">Go</button>
        </form>
        <p className="mt-2 text-xs text-muted">Studio search shows that studio&apos;s catalog; other filters don&apos;t apply to it (an AniList API limitation).</p>
      </FilterGroup>
      <p className="pt-4 text-xs text-muted">Adult content is always excluded. Content classification beyond that isn&apos;t exposed by AniList.</p>
    </div>
  );
}
