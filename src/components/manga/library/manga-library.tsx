"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, CloudOff, Download, FolderOpen, History, Layers, LayoutGrid, List, Minus, Plus, Search, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useMangaLibrary } from "@/stores/manga";
import { useAuth } from "@/stores/auth";
import { MANGA_LIBRARY_STATUSES, mangaHref, mangaStatusMeta, type MangaLibraryEntry, type MangaStatus } from "@/lib/manga/types";
import { genreLabel } from "@/lib/anilist/browse-params";
import { EmptyState, SafeImage, Skeleton } from "@/components/ui/primitives";
import { cn, relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import { LibraryKindSwitch } from "./kind-switch";
import { MangaListMenu } from "../library-actions";

type Tab = MangaStatus | "FAVORITES" | "BOOKMARKS" | "HISTORY";
type Sort = "updated" | "title" | "score" | "progress" | "added";

const snapshotSchema = z.object({
  kind: z.literal("manga").optional(),
  title: z.string().max(300),
  titleNative: z.string().nullable(),
  cover: z.string().nullable(),
  banner: z.string().nullable(),
  color: z.string().nullable(),
  chapters: z.number().nullable(),
  volumes: z.number().nullable(),
  format: z.string().nullable(),
  country: z.string().nullable(),
  year: z.number().nullable(),
  genres: z.array(z.string()),
  averageScore: z.number().nullable(),
  author: z.string().nullable(),
  slug: z.string().nullable().optional(),
});
const exportSchema = z.object({
  format: z.literal("kaze-manga-library"),
  version: z.literal(1),
  entries: z.array(
    z.object({
      mangaId: z.number().int().refine((n) => n !== 0),
      status: z.enum(["CURRENT", "PLANNING", "COMPLETED", "DROPPED", "PAUSED", "REPEATING"]),
      progress: z.number().int().min(0),
      progressVolumes: z.number().int().min(0),
      lastChapterId: z.string().max(120).nullable(),
      lastChapterLabel: z.string().max(120).nullable(),
      lastPage: z.number().int().min(0).nullable(),
      score: z.number().min(0).max(100).nullable(),
      notes: z.string().max(4000),
      favorite: z.boolean(),
      startedAt: z.string().nullable(),
      completedAt: z.string().nullable(),
      repeat: z.number().int().min(0),
      createdAt: z.number(),
      updatedAt: z.number(),
      media: snapshotSchema,
    }),
  ),
});

export function MangaLibraryView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = ((sp.get("tab") as Tab) || "CURRENT") as Tab;
  const entries = useMangaLibrary((s) => s.entries);
  const hydrated = useMangaLibrary((s) => s.hydrated);
  const remoteState = useMangaLibrary((s) => s.remoteState);
  const update = useMangaLibrary((s) => s.update);
  const importEntries = useMangaLibrary((s) => s.importEntries);
  const bookmarks = useMangaLibrary((s) => s.bookmarks);
  const sessions = useMangaLibrary((s) => s.sessions);
  const removeBookmark = useMangaLibrary((s) => s.removeBookmark);
  const authStatus = useAuth((s) => s.status);
  const now = useNow();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<Sort>("updated");
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => Object.values(entries), [entries]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { FAVORITES: all.filter((e) => e.favorite).length, BOOKMARKS: Object.keys(bookmarks).length, HISTORY: sessions.length };
    for (const s of MANGA_LIBRARY_STATUSES) c[s.value] = all.filter((e) => e.status === s.value).length;
    return c;
  }, [all, bookmarks, sessions.length]);
  const genres = useMemo(() => [...new Set(all.flatMap((e) => e.media.genres))].sort(), [all]);
  const list = useMemo(() => {
    let l = tab === "FAVORITES" ? all.filter((e) => e.favorite) : all.filter((e) => e.status === tab);
    if (q) l = l.filter((e) => e.media.title.toLowerCase().includes(q.toLowerCase()) || e.media.titleNative?.includes(q) || e.media.author?.toLowerCase().includes(q.toLowerCase()));
    if (genre) l = l.filter((e) => e.media.genres.includes(genre));
    const by: Record<Sort, (a: MangaLibraryEntry, b: MangaLibraryEntry) => number> = {
      updated: (a, b) => b.updatedAt - a.updatedAt,
      added: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => a.media.title.localeCompare(b.media.title, "es"),
      score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
      progress: (a, b) => b.progress - a.progress,
    };
    return [...l].sort(by[sort]);
  }, [all, tab, q, genre, sort]);

  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ format: "kaze-manga-library", version: 1, exportedAt: new Date().toISOString(), entries: all }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kaze-manga-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Exportados ${all.length} títulos`);
  };
  const importJson = async (file: File) => {
    if (file.size > 5_000_000) return toast.error("El archivo es demasiado grande (máx. 5 MB)");
    try {
      const parsed = exportSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) return toast.error("No es una exportación válida de manga de KAZE", { description: parsed.error.issues[0]?.message });
      const n = importEntries(parsed.data.entries.map((e) => ({ ...e, media: { ...e.media, kind: "manga" as const, slug: e.media.slug ?? null } })));
      toast.success(`Importados ${n} títulos`, { description: "Se conservaron tus ediciones locales más recientes." });
    } catch {
      toast.error("No se pudo leer el archivo");
    }
  };

  const tabs: { value: Tab; label: string }[] = [...MANGA_LIBRARY_STATUSES.map((s) => ({ value: s.value as Tab, label: s.label })), { value: "FAVORITES", label: "Favoritos" }, { value: "BOOKMARKS", label: "Marcadores" }, { value: "HISTORY", label: "Historial" }];

  return (
    <div className="container-k pb-16 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <LibraryKindSwitch active="manga" />
          <p className="k-label text-primary-ink">Tu colección de manga · 本棚</p>
          <h1 className="km-title mt-2 text-title">Mi manga</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            {authStatus === "signed-in" && remoteState === "synced" ? (
              "Sincronizado con tu cuenta"
            ) : authStatus === "signed-in" && remoteState === "unavailable" ? (
              <>
                <CloudOff className="size-4" aria-hidden /> La nube de manga no está disponible: se guarda en este dispositivo
              </>
            ) : (
              "Guardado en este dispositivo"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/manga/shelf" className="k-btn k-btn-ghost k-btn-sm">
            <Layers className="size-4" aria-hidden /> Ver como estantería
          </Link>
          <Link href="/manga/collections" className="k-btn k-btn-ghost k-btn-sm">
            <FolderOpen className="size-4" aria-hidden /> Colecciones
          </Link>
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={exportJson} disabled={!all.length}>
            <Download className="size-4" aria-hidden /> Exportar
          </button>
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden /> Importar
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="sr-only" aria-label="Importar biblioteca de manga" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
      </header>

      <div role="tablist" aria-label="Estados" className="scrollbar-none -mx-[var(--k-gutter)] mt-6 flex gap-1.5 overflow-x-auto px-[var(--k-gutter)] pb-1">
        {tabs.map((t) => (
          <button key={t.value} role="tab" type="button" aria-selected={tab === t.value} className="k-chip shrink-0" data-active={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label} <span className="text-xs text-muted">{hydrated ? counts[t.value] ?? 0 : "·"}</span>
          </button>
        ))}
      </div>

      {!hydrated ? (
        <Skeleton className="mt-8 h-64" />
      ) : tab === "BOOKMARKS" ? (
        <BookmarksList bookmarks={Object.values(bookmarks).sort((a, b) => b.createdAt - a.createdAt)} entries={entries} onRemove={removeBookmark} />
      ) : tab === "HISTORY" ? (
        sessions.length ? (
          <ol className="mt-6 divide-y divide-line border-y border-line">
            {sessions.slice(0, 60).map((s) => {
              const e = entries[s.mangaId];
              return (
                <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
                  <History className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{e?.media.title ?? `Manga ${s.mangaId}`}</span> <span className="text-muted">· {s.pagesViewed} páginas · {Math.round(s.activeSeconds / 60)} min activos</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{now ? relativeTime(s.startedAt, now) : ""}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState className="mt-8" icon={<History className="size-6" />} jp="履歴" title="Sin historial de lectura" body="Las sesiones del lector de KAZE aparecen aquí con el tiempo realmente activo." />
        )
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input className="k-input !pl-9" placeholder="Filtrar por título o autor" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar por título o autor" />
            </div>
            <select className="k-input w-auto" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Género">
              <option value="">Todos los géneros</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {genreLabel(g)}
                </option>
              ))}
            </select>
            <select className="k-input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
              <option value="updated">Actividad reciente</option>
              <option value="added">Añadidos recientemente</option>
              <option value="title">Título</option>
              <option value="score">Tu puntuación</option>
              <option value="progress">Capítulos leídos</option>
            </select>
            <div className="flex rounded-[var(--k-radius-btn)] bg-[var(--k-btn-ghost)] p-1" role="group" aria-label="Vista">
              <button className={cn("k-btn k-btn-icon k-btn-sm", view === "grid" && "bg-surface shadow")} aria-pressed={view === "grid"} aria-label="Cuadrícula" onClick={() => setView("grid")}>
                <LayoutGrid className="size-4" />
              </button>
              <button className={cn("k-btn k-btn-icon k-btn-sm", view === "list" && "bg-surface shadow")} aria-pressed={view === "list"} aria-label="Lista" onClick={() => setView("list")}>
                <List className="size-4" />
              </button>
            </div>
          </div>
          {!list.length ? (
            <EmptyState
              className="mt-8"
              jp="空"
              title={all.length ? "Nada en esta pestaña" : "Tu biblioteca de manga está vacía"}
              body={all.length ? "Cambia de pestaña o quita filtros." : "Añade manga desde cualquier ficha, desde la Bóveda o al continuar la historia de un anime."}
              action={
                <Link href="/manga/discover" className="k-btn k-btn-primary k-btn-sm">
                  Explorar manga
                </Link>
              }
            />
          ) : view === "grid" ? (
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {list.map((e) => (
                <li key={e.mangaId}>
                  <Link href={mangaHref(e.mangaId, e.media.slug)} className="group block">
                    <div className="km-book">
                      <div className="k-poster relative aspect-[2/3]" style={{ backgroundColor: e.media.color ?? undefined }}>
                        <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="180px" className="object-cover" fallbackLabel={e.media.title} />
                        {e.media.chapters ? (
                          <div className="absolute inset-x-0 bottom-0 z-[4] h-1 bg-black/40" aria-hidden>
                            <div className="h-full bg-primary" style={{ width: `${Math.min(100, (e.progress / e.media.chapters) * 100)}%` }} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p className="clamp-2 mt-2 text-sm font-semibold group-hover:text-primary-ink">{e.media.title}</p>
                  </Link>
                  <ProgressInline e={e} onChange={(p) => update(e.mangaId, { progress: p })} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {list.map((e) => (
                <li key={e.mangaId} className="flex items-center gap-3 py-2.5">
                  <Link href={mangaHref(e.mangaId, e.media.slug)} className="k-poster relative h-16 w-11 shrink-0" tabIndex={-1} aria-hidden>
                    <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="44px" className="object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={mangaHref(e.mangaId, e.media.slug)} className="block truncate font-semibold hover:text-primary-ink">
                      {e.media.title}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {[e.media.author, mangaStatusMeta(e.status).label, e.score ? `${e.score / 10}/10` : null, e.lastChapterLabel ? `última: ${e.lastChapterLabel}` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <ProgressInline e={e} onChange={(p) => update(e.mangaId, { progress: p })} />
                  <MangaListMenu manga={{ id: e.mangaId, snapshot: e.media }} size="sm" align="end" />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ProgressInline({ e, onChange }: { e: MangaLibraryEntry; onChange: (p: number) => void }) {
  return (
    <div className="mt-1 flex items-center gap-1 text-xs text-muted">
      <button type="button" className="k-btn k-btn-ghost k-btn-icon k-btn-sm" aria-label={`Restar un capítulo a ${e.media.title}`} disabled={e.progress <= 0} onClick={() => onChange(e.progress - 1)}>
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className="min-w-14 text-center tabular-nums">
        cap. {e.progress}
        {e.media.chapters ? `/${e.media.chapters}` : ""}
      </span>
      <button type="button" className="k-btn k-btn-ghost k-btn-icon k-btn-sm" aria-label={`Sumar un capítulo a ${e.media.title}`} disabled={Boolean(e.media.chapters && e.progress >= e.media.chapters)} onClick={() => onChange(e.progress + 1)}>
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function BookmarksList({ bookmarks, entries, onRemove }: { bookmarks: { id: string; mangaId: number; chapterId: string; chapterLabel: string; page: number; createdAt: number }[]; entries: Record<number, MangaLibraryEntry>; onRemove: (id: string) => void }) {
  if (!bookmarks.length) return <EmptyState className="mt-8" icon={<Bookmark className="size-6" />} jp="栞" title="Sin marcadores" body="En el lector, pulsa B o el icono de marcador para guardar una página." />;
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {bookmarks.map((b) => {
        const e = entries[b.mangaId];
        const slug = e?.media.slug;
        return (
          <li key={b.id} className="km-frame flex items-center gap-3 p-3">
            <Bookmark className="size-5 shrink-0 text-primary-ink" aria-hidden />
            <div className="min-w-0 flex-1">
              {slug ? (
                <Link href={`/manga/read/${slug}/${b.chapterId}?page=${b.page + 1}`} className="block truncate font-semibold hover:text-primary-ink">
                  {e?.media.title ?? "Manga"}
                </Link>
              ) : (
                <span className="block truncate font-semibold">{e?.media.title ?? "Manga"}</span>
              )}
              <p className="text-xs text-muted">
                {b.chapterLabel} · página {b.page + 1}
              </p>
            </div>
            <button type="button" className="k-btn k-btn-ghost k-btn-icon k-btn-sm" aria-label="Eliminar marcador" onClick={() => onRemove(b.id)}>
              <X className="size-4" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
