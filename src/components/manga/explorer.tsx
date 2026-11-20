"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { History, LayoutGrid, List, Loader2, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { activeMangaFilterCount, COUNTRIES, MANGA_FORMATS, MANGA_SORTS, MANGA_STATUSES, parseMangaParams, serializeMangaParams } from "@/lib/anilist/manga-params";
import type { MangaBrowseParams } from "@/lib/anilist/manga-types";
import { genreLabel } from "@/lib/anilist/browse-params";
import { mangaApi } from "@/lib/manga/client-api";
import { useDebounced, useMediaQuery } from "@/lib/hooks";
import { useLocal } from "@/stores/local";
import { cn, formatLabel } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorPanel } from "@/components/ui/primitives";
import { MangaCardSkeleton, MangaCardView, MangaRow } from "./cards";
import { MangaListMenu, refFromCard } from "./library-actions";

type Meta = { genres: string[]; tags: { name: string; category: string }[] };

/** Manga search & discovery. Every filter lives in the URL, so results are shareable and back/forward just works. */
export function MangaExplorer({ meta }: { meta: Meta }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const params = useMemo(() => parseMangaParams(new URLSearchParams(sp.toString())), [sp]);
  const [q, setQ] = useState(params.search ?? "");
  const debouncedQ = useDebounced(q, 300);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sheet, setSheet] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const pushSearch = useLocal((s) => s.pushSearch);

  const setParams = (patch: Partial<MangaBrowseParams>) => {
    const next = { ...params, ...patch, page: undefined };
    const qs = serializeMangaParams(next).toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if ((params.search ?? "") === debouncedQ.trim()) return;
    setParams({ search: debouncedQ.trim() || undefined });
    if (debouncedQ.trim().length >= 2) pushSearch(debouncedQ.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);
  const [urlSearch, setUrlSearch] = useState(params.search ?? "");
  if ((params.search ?? "") !== urlSearch) {
    setUrlSearch(params.search ?? "");
    setQ(params.search ?? "");
  }

  const query = useInfiniteQuery({
    queryKey: ["manga-browse", serializeMangaParams(params).toString()],
    queryFn: ({ pageParam, signal }) => mangaApi.browse({ ...params, page: pageParam, perPage: 30 }, signal),
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

  const count = activeMangaFilterCount(params);
  const filters = <MangaFilterPanel params={params} meta={meta} setParams={setParams} />;

  return (
    <div className="container-k pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="k-label text-primary-ink">Catálogo de AniList · 探す</p>
          <h1 className="km-title mt-2 text-title">Explorar manga</h1>
        </div>
        <nav aria-label="Atajos" className="flex flex-wrap gap-2">
          <Link href="/manga/trending" className="k-btn k-btn-ghost k-btn-sm">Tendencias</Link>
          <Link href="/manga/seasonal" className="k-btn k-btn-ghost k-btn-sm">Novedades</Link>
          <Link href="/manga/random" className="k-btn k-btn-ghost k-btn-sm">Ruleta</Link>
        </nav>
      </header>

      <div className="sticky top-[var(--k-nav-h)] z-30 -mx-[var(--k-gutter)] mt-6 bg-gradient-to-b from-bg via-bg/95 to-bg/0 px-[var(--k-gutter)] pb-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={setQ} busy={query.isFetching && !query.isFetchingNextPage} />
          <label className="sr-only" htmlFor="manga-sort">
            Ordenar
          </label>
          <select id="manga-sort" className="k-input !min-h-12 w-auto" value={params.sort ?? (params.search ? "SEARCH_MATCH" : "POPULARITY_DESC")} onChange={(e) => setParams({ sort: e.target.value as MangaBrowseParams["sort"] })}>
            {params.search && <option value="SEARCH_MATCH">Mejor coincidencia</option>}
            {MANGA_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="k-btn k-btn-outline !min-h-12 lg:hidden" onClick={() => setSheet(true)}>
            <SlidersHorizontal className="size-4" aria-hidden /> Filtros{count ? ` · ${count}` : ""}
          </button>
          <div className="flex rounded-[var(--k-radius-btn)] bg-[var(--k-btn-ghost)] p-1" role="group" aria-label="Vista">
            <button className={cn("k-btn k-btn-icon k-btn-sm", view === "grid" ? "bg-surface shadow" : "")} aria-pressed={view === "grid"} aria-label="Vista en cuadrícula" onClick={() => setView("grid")}>
              <LayoutGrid className="size-4" />
            </button>
            <button className={cn("k-btn k-btn-icon k-btn-sm", view === "list" ? "bg-surface shadow" : "")} aria-pressed={view === "list"} aria-label="Vista en lista" onClick={() => setView("list")}>
              <List className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted" aria-live="polite">
            {total != null ? `${total.toLocaleString("es")} resultados` : "Buscando…"}
          </span>
          {params.author && <FilterChip label={`Autor: ${params.author}`} onClear={() => setParams({ author: undefined })} />}
          {params.country && <FilterChip label={COUNTRIES.find((c) => c.value === params.country)?.label ?? params.country} onClear={() => setParams({ country: undefined })} />}
          {params.genres?.map((g) => <FilterChip key={g} label={genreLabel(g)} onClear={() => setParams({ genres: params.genres!.filter((x) => x !== g) })} />)}
          {params.tags?.map((t) => <FilterChip key={t} label={`#${t}`} onClear={() => setParams({ tags: params.tags!.filter((x) => x !== t) })} />)}
          {count > 0 && (
            <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => startTransition(() => router.replace(params.search ? `${pathname}?q=${encodeURIComponent(params.search)}` : pathname, { scroll: false }))}>
              <RotateCcw className="size-3.5" aria-hidden /> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {desktop && <aside className="sticky top-[calc(var(--k-nav-h)+120px)] max-h-[calc(100dvh-var(--k-nav-h)-140px)] self-start overflow-y-auto pr-2" aria-label="Filtros">{filters}</aside>}
        <div className="min-w-0 pb-16">
          {query.isError ? (
            <ErrorPanel title="No se pudo buscar" message={(query.error as Error).message} onRetry={() => query.refetch()} />
          ) : query.isLoading ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }, (_, i) => (
                <MangaCardSkeleton key={i} />
              ))}
            </div>
          ) : !items.length ? (
            <EmptyState jp="無" title="Sin resultados" body="Prueba otra búsqueda, quita filtros o busca por autor con el campo «Autor o artista»." />
          ) : view === "grid" ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {items.map((m) => (
                <li key={m.id}>
                  <MangaCardView media={m} />
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              {items.map((m) => (
                <li key={m.id}>
                  <MangaRow media={m} action={<MangaListMenu manga={refFromCard(m)} size="sm" align="end" />} />
                </li>
              ))}
            </ul>
          )}
          <div ref={sentinel} className="h-10" />
          {query.isFetchingNextPage && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando más…
            </p>
          )}
        </div>
      </div>

      {!desktop && (
        <Dialog open={sheet} onOpenChange={setSheet} title="Filtros de manga" side="bottom">
          <div className="px-5 pb-6">{filters}</div>
        </Dialog>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" className="k-chip" data-active="true" onClick={onClear} aria-label={`Quitar filtro ${label}`}>
      {label} <X className="size-3" aria-hidden />
    </button>
  );
}

/** Search input with live AniList suggestions and recent searches, fully keyboard-operable (combobox pattern). */
function SearchBox({ value, onChange, busy }: { value: string; onChange: (v: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebounced(value, 180);
  const recent = useLocal((s) => s.recentSearches);
  const clearSearches = useLocal((s) => s.clearSearches);
  const listId = useId();
  const router = useRouter();
  const sug = useQuery({ queryKey: ["manga-suggest", debounced.trim().toLowerCase()], enabled: debounced.trim().length >= 2, queryFn: ({ signal }) => mangaApi.suggest(debounced.trim(), signal), staleTime: 10 * 60_000 });
  const options = value.trim().length >= 2 ? (sug.data?.results ?? []).map((r) => ({ key: `m-${r.id}`, label: r.title.english || r.title.romaji || "", hint: [formatLabel(r.format), r.startDate.year].filter(Boolean).join(" · "), go: () => router.push(`/manga/${r.id}`) })) : recent.map((r) => ({ key: `r-${r}`, label: r, hint: "Reciente", go: () => onChange(r) }));

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
      <label htmlFor="manga-q" className="sr-only">
        Buscar manga
      </label>
      <input
        id="manga-q"
        type="search"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(options.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === "Enter" && active >= 0 && options[active]) {
            e.preventDefault();
            options[active].go();
            setOpen(false);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Busca por título: español, inglés, romaji o japonés"
        className="k-input !min-h-12 !pl-11 text-base"
        autoComplete="off"
      />
      {busy && <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
      {open && options.length > 0 && (
        <div className="k-panel absolute inset-x-0 top-[calc(100%+6px)] z-40 !bg-surface p-1.5">
          <ul id={listId} role="listbox" aria-label={value.trim().length >= 2 ? "Sugerencias" : "Búsquedas recientes"}>
            {options.map((o, i) => (
              <li
                key={o.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-[min(var(--k-radius-btn),10px)] px-3 text-sm", i === active && "bg-[var(--k-btn-ghost)]")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  o.go();
                  setOpen(false);
                }}
              >
                {o.hint === "Reciente" ? <History className="size-4 text-muted" aria-hidden /> : <Search className="size-4 text-muted" aria-hidden />}
                <span className="flex-1 truncate">{o.label}</span>
                <span className="text-xs text-muted">{o.hint}</span>
              </li>
            ))}
          </ul>
          {value.trim().length < 2 && (
            <button type="button" className="k-btn k-btn-ghost k-btn-sm mt-1 w-full" onMouseDown={(e) => (e.preventDefault(), clearSearches())}>
              Borrar búsquedas recientes
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MangaFilterPanel({ params, meta, setParams }: { params: MangaBrowseParams; meta: Meta; setParams: (p: Partial<MangaBrowseParams>) => void }) {
  const [author, setAuthor] = useState(params.author ?? "");
  const debAuthor = useDebounced(author, 400);
  useEffect(() => {
    if ((params.author ?? "") !== debAuthor.trim()) setParams({ author: debAuthor.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debAuthor]);
  const toggle = (list: string[] | undefined, v: string) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);
  const num = (v: string) => (v ? Number(v) : undefined);
  const tagGroups = useMemo(() => meta.tags.filter((t) => ["Theme-Other", "Setting-Universe", "Cast-Main Cast", "Demographic"].some((c) => t.category.startsWith(c.split("-")[0]))).slice(0, 40), [meta.tags]);

  return (
    <div className="space-y-6 text-sm">
      <fieldset>
        <legend className="k-label mb-2 text-muted">Origen</legend>
        <div className="flex flex-wrap gap-1.5">
          {COUNTRIES.map((c) => (
            <button key={c.value} type="button" className="k-chip" aria-pressed={params.country === c.value} onClick={() => setParams({ country: params.country === c.value ? undefined : c.value })}>
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="k-label mb-2 text-muted">Formato</legend>
        <div className="flex flex-wrap gap-1.5">
          {MANGA_FORMATS.map((f) => (
            <button key={f.value} type="button" className="k-chip" aria-pressed={Boolean(params.formats?.includes(f.value))} onClick={() => setParams({ formats: toggle(params.formats, f.value) as MangaBrowseParams["formats"] })}>
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="k-label mb-2 block text-muted">Estado de publicación</span>
        <select className="k-input" value={params.status ?? ""} onChange={(e) => setParams({ status: (e.target.value || undefined) as MangaBrowseParams["status"] })}>
          <option value="">Cualquiera</option>
          {MANGA_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="k-label mb-2 block text-muted">Autor o artista</span>
        <input className="k-input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="p. ej. Fujimoto" />
        <span className="mt-1 block text-xs text-muted">La búsqueda por autor ignora los demás filtros (AniList la resuelve por persona).</span>
      </label>
      <fieldset>
        <legend className="k-label mb-2 text-muted">Géneros</legend>
        <div className="flex flex-wrap gap-1.5">
          {meta.genres.map((g) => (
            <button key={g} type="button" className="k-chip" aria-pressed={Boolean(params.genres?.includes(g))} onClick={() => setParams({ genres: toggle(params.genres, g) })}>
              {genreLabel(g)}
            </button>
          ))}
        </div>
      </fieldset>
      {tagGroups.length > 0 && (
        <fieldset>
          <legend className="k-label mb-2 text-muted">Etiquetas</legend>
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {tagGroups.map((t) => (
              <button key={t.name} type="button" className="k-chip" aria-pressed={Boolean(params.tags?.includes(t.name))} onClick={() => setParams({ tags: toggle(params.tags, t.name) })}>
                {t.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="k-label mb-2 text-muted">Año de inicio</legend>
        <input aria-label="Desde el año" type="number" inputMode="numeric" className="k-input" placeholder="Desde" value={params.yearFrom ?? ""} onChange={(e) => setParams({ yearFrom: num(e.target.value) })} />
        <input aria-label="Hasta el año" type="number" inputMode="numeric" className="k-input" placeholder="Hasta" value={params.yearTo ?? ""} onChange={(e) => setParams({ yearTo: num(e.target.value) })} />
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="k-label mb-2 text-muted">Capítulos</legend>
        <input aria-label="Capítulos mínimos" type="number" inputMode="numeric" className="k-input" placeholder="Mín." value={params.minChapters ?? ""} onChange={(e) => setParams({ minChapters: num(e.target.value) })} />
        <input aria-label="Capítulos máximos" type="number" inputMode="numeric" className="k-input" placeholder="Máx." value={params.maxChapters ?? ""} onChange={(e) => setParams({ maxChapters: num(e.target.value) })} />
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="k-label mb-2 text-muted">Volúmenes</legend>
        <input aria-label="Volúmenes mínimos" type="number" inputMode="numeric" className="k-input" placeholder="Mín." value={params.minVolumes ?? ""} onChange={(e) => setParams({ minVolumes: num(e.target.value) })} />
        <input aria-label="Volúmenes máximos" type="number" inputMode="numeric" className="k-input" placeholder="Máx." value={params.maxVolumes ?? ""} onChange={(e) => setParams({ maxVolumes: num(e.target.value) })} />
      </fieldset>
      <p className="-mt-3 text-xs text-muted">Los filtros de extensión excluyen series cuyo total AniList aún no conoce (habitual en obras en curso).</p>
      <label className="block">
        <span className="k-label mb-2 block text-muted">Puntuación mínima</span>
        <input type="range" min={0} max={95} step={5} value={params.minScore ?? 0} onChange={(e) => setParams({ minScore: Number(e.target.value) || undefined })} className="w-full accent-[var(--k-primary)]" aria-valuetext={`${params.minScore ?? 0}%`} />
        <span className="text-xs text-muted">{params.minScore ? `${params.minScore}% o más` : "Cualquiera"}</span>
      </label>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="k-label mb-2 text-muted">Popularidad (lectores)</legend>
        <input aria-label="Popularidad mínima" type="number" inputMode="numeric" className="k-input" placeholder="Mín." value={params.minPopularity ?? ""} onChange={(e) => setParams({ minPopularity: num(e.target.value) })} />
        <input aria-label="Popularidad máxima" type="number" inputMode="numeric" className="k-input" placeholder="Máx." value={params.maxPopularity ?? ""} onChange={(e) => setParams({ maxPopularity: num(e.target.value) })} />
      </fieldset>
      <p className="text-xs text-muted">Disponibilidad por idioma: cada ficha muestra las plataformas oficiales y sus idiomas según AniList.</p>
    </div>
  );
}
