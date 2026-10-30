"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckSquare, CloudOff, Download, FolderOpen, Heart, LayoutGrid, List, Minus, Plus, Search, Square, Trash2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useLibrary } from "@/stores/library";
import { useAuth } from "@/stores/auth";
import { LIBRARY_STATUSES, statusMeta, type LibraryEntry, type LibraryStatus } from "@/lib/library/types";
import { EmptyState, SafeImage, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn, formatNumber } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";

type Tab = LibraryStatus | "FAVORITES";
type Sort = "updated" | "title" | "score" | "progress" | "added";

const exportSchema = z.object({
  format: z.literal("kaze-library"),
  version: z.literal(1),
  entries: z.array(
    z.object({
      mediaId: z.number().int().positive(),
      status: z.enum(["CURRENT", "PLANNING", "COMPLETED", "DROPPED", "PAUSED", "REPEATING"]),
      progress: z.number().int().min(0),
      score: z.number().min(0).max(100).nullable(),
      notes: z.string().max(4000),
      favorite: z.boolean(),
      startedAt: z.string().nullable(),
      completedAt: z.string().nullable(),
      repeat: z.number().int().min(0),
      createdAt: z.number(),
      updatedAt: z.number(),
      media: z.object({ title: z.string(), titleNative: z.string().nullable(), cover: z.string().nullable(), banner: z.string().nullable(), color: z.string().nullable(), episodes: z.number().nullable(), format: z.string().nullable(), year: z.number().nullable(), genres: z.array(z.string()), averageScore: z.number().nullable(), studio: z.string().nullable(), duration: z.number().nullable() }),
    }),
  ),
});

export function LibraryView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = ((sp.get("tab") as Tab) || "CURRENT") as Tab;
  const entries = useLibrary((s) => s.entries);
  const hydrated = useLibrary((s) => s.hydrated);
  const syncing = useLibrary((s) => s.syncing);
  const remote = useLibrary((s) => s.remote);
  const bulkUpdate = useLibrary((s) => s.bulkUpdate);
  const bulkRemove = useLibrary((s) => s.bulkRemove);
  const update = useLibrary((s) => s.update);
  const importEntries = useLibrary((s) => s.importEntries);
  const collections = useLibrary((s) => s.collections);
  const toggleInCollection = useLibrary((s) => s.toggleInCollection);
  const authStatus = useAuth((s) => s.status);
  const { reduced, m } = useKazeMotion();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<Sort>("updated");
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [dragOver, setDragOver] = useState<Tab | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => Object.values(entries), [entries]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { FAVORITES: all.filter((e) => e.favorite).length };
    for (const s of LIBRARY_STATUSES) c[s.value] = all.filter((e) => e.status === s.value).length;
    return c;
  }, [all]);
  const genres = useMemo(() => [...new Set(all.flatMap((e) => e.media.genres))].sort(), [all]);
  const stats = useMemo(() => {
    const episodes = all.reduce((s, e) => s + e.progress, 0);
    const minutes = all.reduce((s, e) => s + e.progress * (e.media.duration ?? 24), 0);
    const scored = all.filter((e) => e.score != null);
    return { episodes, days: minutes / 1440, mean: scored.length ? Math.round(scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length) : null };
  }, [all]);

  const list = useMemo(() => {
    let l = tab === "FAVORITES" ? all.filter((e) => e.favorite) : all.filter((e) => e.status === tab);
    if (q) l = l.filter((e) => e.media.title.toLowerCase().includes(q.toLowerCase()) || e.media.titleNative?.includes(q));
    if (genre) l = l.filter((e) => e.media.genres.includes(genre));
    const by: Record<Sort, (a: LibraryEntry, b: LibraryEntry) => number> = {
      updated: (a, b) => b.updatedAt - a.updatedAt,
      added: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => a.media.title.localeCompare(b.media.title),
      score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
      progress: (a, b) => b.progress / (b.media.episodes || b.progress || 1) - a.progress / (a.media.episodes || a.progress || 1),
    };
    return [...l].sort(by[sort]);
  }, [all, tab, q, genre, sort]);

  const setTab = (t: Tab) => {
    router.replace(`${pathname}?tab=${t}`, { scroll: false });
    setSelected(new Set());
  };
  const toggleSel = (id: number) => setSelected((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ format: "kaze-library", version: 1, exportedAt: new Date().toISOString(), entries: all }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kaze-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Exported ${all.length} entries`);
  };
  const importJson = async (file: File) => {
    if (file.size > 5_000_000) return toast.error("That file is too large (5 MB max)");
    try {
      const parsed = exportSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) return toast.error("El archivo no es una exportación válida de KAZE", { description: parsed.error.issues[0]?.message });
      const n = importEntries(parsed.data.entries.map((e) => ({ ...e })));
      toast.success(`Se importaron ${n} título${n === 1 ? "" : "s"}`, { description: "Se mantuvieron las ediciones locales más recientes." });
    } catch {
      toast.error("No se pudo leer el archivo");
    }
  };

  const tabs: { value: Tab; label: string; jp: string }[] = [...LIBRARY_STATUSES.map((s) => ({ value: s.value, label: s.label, jp: s.jp })), { value: "FAVORITES", label: "Favoritos", jp: "推し" }];

  if (!hydrated) return <Skeleton className="container-k mt-10 h-96" />;

  return (
    <div className="container-k pt-8">
      <header className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="k-label text-primary-ink">Tu colección</p>
          <h1 className="font-display text-title mt-2">Mi Biblioteca</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            {authStatus === "signed-in" && remote ? (
              <>{syncing ? "Sincronizando con tu cuenta…" : "Sincronizado con tu cuenta de KAZE"}</>
            ) : (
              <>
                <CloudOff className="size-4" aria-hidden /> Guardado en este dispositivo.{" "}
                {authStatus === "signed-out" && (
                  <Link href="/register" className="font-semibold text-primary-ink">
                    Crea una cuenta para sincronizar
                  </Link>
                )}
              </>
            )}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-6 text-right max-md:text-left">
          <div>
            <dt className="k-label text-muted">Títulos</dt>
            <dd className="font-display text-2xl">{all.length}</dd>
          </div>
          <div>
            <dt className="k-label text-muted">Episodios</dt>
            <dd className="font-display text-2xl">{formatNumber(stats.episodes)}</dd>
          </div>
          <div>
            <dt className="k-label text-muted">Días vistos</dt>
            <dd className="font-display text-2xl">{stats.days.toFixed(1)}</dd>
          </div>
        </dl>
      </header>

      {/* Status shelves — also drop targets for drag-and-drop */}
      <nav aria-label="Secciones de la biblioteca" className="scrollbar-none -mx-[var(--k-gutter)] mt-8 flex gap-2 overflow-x-auto px-[var(--k-gutter)] pb-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            aria-current={tab === t.value ? "page" : undefined}
            onDragOver={(e) => {
              if (t.value === tab) return;
              e.preventDefault();
              setDragOver(t.value);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = Number(e.dataTransfer.getData("text/kaze-media"));
              if (!id) return;
              if (t.value === "FAVORITES") update(id, { favorite: true });
              else update(id, { status: t.value });
              toast.success(`Moved to ${t.label}`, { description: entries[id]?.media.title });
            }}
            className={cn(
              "k-card flex min-w-36 shrink-0 flex-col items-start gap-0.5 px-4 py-3 text-left transition-all",
              tab === t.value && "shadow-[var(--k-hover-glow)]",
              dragOver === t.value && "scale-105 ring-2 ring-primary",
            )}
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="font-display text-xl tabular-nums">{counts[t.value] ?? 0}</span>
            </span>
            <span className="k-jp text-[0.6875rem] text-muted" lang="ja">
              {t.jp}
            </span>
          </button>
        ))}
        <Link href="/library/collections" className="k-card flex min-w-36 shrink-0 flex-col items-start gap-0.5 px-4 py-3">
          <span className="flex w-full items-center justify-between gap-3 text-sm font-semibold">
            Colecciones <FolderOpen className="size-4 text-primary-ink" aria-hidden />
          </span>
          <span className="text-[0.6875rem] text-muted">{Object.keys(collections).length} custom</span>
        </Link>
      </nav>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="lib-q" className="sr-only">Filter by title</label>
          <input id="lib-q" className="k-input !min-h-10 !pl-9 text-sm" placeholder="Filtrar por título…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label htmlFor="lib-genre" className="sr-only">Genre</label>
        <select id="lib-genre" className="k-input !min-h-10 w-auto text-sm" value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">Todos los géneros</option>
          {genres.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <label htmlFor="lib-sort" className="sr-only">Sort</label>
        <select id="lib-sort" className="k-input !min-h-10 w-auto text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="updated">Actualizado recientemente</option>
          <option value="added">Añadido recientemente</option>
          <option value="title">Título</option>
          <option value="score">Tu nota</option>
          <option value="progress">Progreso</option>
        </select>
        <button className="k-btn k-btn-ghost k-btn-sm" aria-pressed={selecting} onClick={() => (setSelecting((s) => !s), setSelected(new Set()))}>
          <CheckSquare className="size-4" aria-hidden /> Seleccionar
        </button>
        <div className="flex rounded-[var(--k-radius-btn)] bg-[var(--k-btn-ghost)] p-1" role="group" aria-label="Layout">
          <button className={cn("k-btn k-btn-icon k-btn-sm", view === "grid" && "bg-surface shadow")} aria-pressed={view === "grid"} aria-label="Cuadrícula" onClick={() => setView("grid")}>
            <LayoutGrid className="size-4" />
          </button>
          <button className={cn("k-btn k-btn-icon k-btn-sm", view === "list" && "bg-surface shadow")} aria-pressed={view === "list"} aria-label="Lista" onClick={() => setView("list")}>
            <List className="size-4" />
          </button>
        </div>
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={exportJson} disabled={!all.length}>
          <Download className="size-4" aria-hidden /> Exportar
        </button>
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" aria-hidden /> Importar
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0]).finally(() => (e.target.value = ""))} />
      </div>
      <p className="mt-2 text-xs text-muted max-md:hidden">Consejo: arrastra un póster a una estantería superior para moverlo. La importación/sincronización con AniList está en Configuración → Integraciones.</p>

      {/* Bulk bar */}
      <AnimatePresence>
        {selecting && selected.size > 0 && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} className="k-panel fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-2 !bg-surface p-3 lg:bottom-6">
            <span className="px-2 text-sm font-semibold">{selected.size} seleccionados</span>
            <label htmlFor="bulk-status" className="sr-only">Move to</label>
            <select id="bulk-status" className="k-input !min-h-9 w-auto text-sm" defaultValue="" onChange={(e) => {
              if (!e.target.value) return;
              bulkUpdate([...selected], { status: e.target.value as LibraryStatus });
              toast.success(`Moved ${selected.size} to ${statusMeta(e.target.value as LibraryStatus).label}`);
              setSelected(new Set());
              e.target.value = "";
            }}>
              <option value="">Mover a…</option>
              {LIBRARY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {Object.values(collections).length > 0 && (
              <select className="k-input !min-h-9 w-auto text-sm" aria-label="Add to collection" defaultValue="" onChange={(e) => {
                const cid = e.target.value;
                if (!cid) return;
                const c = collections[cid];
                [...selected].filter((id) => !c.mediaIds.includes(id)).forEach((id) => toggleInCollection(cid, id));
                toast.success(`Added to ${c.name}`);
                e.target.value = "";
              }}>
                <option value="">Añadir a colección…</option>
                {Object.values(collections).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => bulkUpdate([...selected], { favorite: true })}>
              <Heart className="size-4" aria-hidden /> Favorito
            </button>
            <button className="k-btn k-btn-ghost k-btn-sm text-danger" onClick={() => setConfirm(true)}>
              <Trash2 className="size-4" aria-hidden /> Eliminar
            </button>
            <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm ml-auto" aria-label="Limpiar selección" onClick={() => setSelected(new Set())}>
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`¿Eliminar ${selected.size} título${selected.size === 1 ? "" : "s"}?`}
        body="Se eliminarán de tu biblioteca, incluyendo progreso, notas y puntuaciones."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          bulkRemove([...selected]);
          toast(`Removed ${selected.size} titles`);
          setSelected(new Set());
          setConfirm(false);
        }}
      />

      <div className="mt-6">
        {list.length === 0 ? (
          <EmptyState
            jp={tab === "FAVORITES" ? "推" : statusMeta(tab as LibraryStatus).jp.slice(0, 1)}
            title={all.length === 0 ? "Tu biblioteca está vacía" : q || genre ? "Ningún título coincide con estos filtros" : `Aún no hay nada en ${tab === "FAVORITES" ? "Favoritos" : statusMeta(tab as LibraryStatus).label}`}
            body={all.length === 0 ? "Añade animes desde cualquier parte de KAZE con el botón “Añadir a mi lista”, o importa tu catálogo desde AniList." : undefined}
            action={
              all.length === 0 ? (
                <>
                  <Link href="/discover" className="k-btn k-btn-primary k-btn-sm">Descubrir anime</Link>
                  <Link href="/settings/integrations" className="k-btn k-btn-outline k-btn-sm">Importar desde AniList</Link>
                </>
              ) : undefined
            }
          />
        ) : view === "grid" ? (
          <motion.ul layout={!reduced} className="grid grid-cols-2 gap-x-4 gap-y-8 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 3xl:grid-cols-8">
            <AnimatePresence initial={false}>
              {list.map((e) => (
                <motion.li key={e.mediaId} layout={!reduced} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={m.spring}>
                  <ShelfCard e={e} selecting={selecting} selected={selected.has(e.mediaId)} onToggle={() => toggleSel(e.mediaId)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        ) : (
          <ul className="k-card divide-y divide-line">
            {list.map((e) => (
              <ShelfRow key={e.mediaId} e={e} selecting={selecting} selected={selected.has(e.mediaId)} onToggle={() => toggleSel(e.mediaId)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProgressRing({ value, total }: { value: number; total: number | null }) {
  const pct = total ? Math.min(1, value / total) : 0;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="rgb(0 0 0 / 0.6)" stroke="rgb(255 255 255 / 0.2)" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--k-primary)" strokeWidth="3" strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round" />
    </svg>
  );
}

function ShelfCard({ e, selecting, selected, onToggle }: { e: LibraryEntry; selecting: boolean; selected: boolean; onToggle: () => void }) {
  const update = useLibrary((s) => s.update);
  const inner = (
    <>
      <div className={cn("k-poster relative aspect-[2/3] w-full", selected && "ring-4 ring-primary")}>
        <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="(max-width:640px) 45vw, 180px" className="object-cover" fallbackLabel={e.media.title} tint={e.media.color} />
        {(e.status === "CURRENT" || e.status === "REPEATING") && (
          <div className="absolute bottom-2 right-2 z-[3] grid place-items-center">
            <ProgressRing value={e.progress} total={e.media.episodes} />
            <span className="absolute text-[0.5625rem] font-bold text-white">{e.progress}</span>
          </div>
        )}
        {e.favorite && <Heart className="absolute left-2 top-2 z-[3] size-4 fill-accent text-accent drop-shadow" aria-label="Favorite" />}
        {e.score != null && <span className="absolute right-2 top-2 z-[3] rounded bg-black/70 px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">{e.score}</span>}
        {selecting && <span className="absolute inset-0 z-[4] grid place-items-center bg-black/20">{selected ? <CheckSquare className="size-8 text-white" /> : <Square className="size-8 text-white/80" />}</span>}
      </div>
      <p className="clamp-2 mt-2 text-sm font-semibold leading-snug">{e.media.title}</p>
      <p className="text-xs text-muted">
        {e.progress}/{e.media.episodes ?? "?"} ep{e.media.year ? ` · ${e.media.year}` : ""}
      </p>
    </>
  );
  return (
    <div
      draggable={!selecting}
      onDragStart={(ev) => {
        ev.dataTransfer.setData("text/kaze-media", String(e.mediaId));
        ev.dataTransfer.effectAllowed = "move";
      }}
      className="group relative"
    >
      {selecting ? (
        <button className="block w-full text-left" onClick={onToggle} aria-pressed={selected} aria-label={`Select ${e.media.title}`}>
          {inner}
        </button>
      ) : (
        <Link href={`/anime/${e.mediaId}`} className="block">
          {inner}
        </Link>
      )}
      {!selecting && (e.status === "CURRENT" || e.status === "REPEATING") && (
        <div className="absolute inset-x-2 top-[calc(66%-1rem)] z-[5] flex justify-between opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button className="k-btn k-btn-icon k-btn-sm bg-black/70 text-white" aria-label={`One episode back for ${e.media.title}`} onClick={() => update(e.mediaId, { progress: e.progress - 1 })}>
            <Minus className="size-4" />
          </button>
          <button className="k-btn k-btn-icon k-btn-sm bg-black/70 text-white" aria-label={`Mark next episode of ${e.media.title} watched`} onClick={() => update(e.mediaId, { progress: e.progress + 1 })}>
            <Plus className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ShelfRow({ e, selecting, selected, onToggle }: { e: LibraryEntry; selecting: boolean; selected: boolean; onToggle: () => void }) {
  const update = useLibrary((s) => s.update);
  return (
    <li className={cn("flex items-center gap-4 p-3", selected && "bg-primary/10")}>
      {selecting && (
        <button onClick={onToggle} aria-pressed={selected} aria-label={`Select ${e.media.title}`}>
          {selected ? <CheckSquare className="size-5 text-primary-ink" /> : <Square className="size-5 text-muted" />}
        </button>
      )}
      <Link href={`/anime/${e.mediaId}`} className="k-poster relative aspect-[2/3] w-12 shrink-0">
        <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="48px" className="object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/anime/${e.mediaId}`} className="font-semibold hover:text-primary-ink">
          {e.media.title}
        </Link>
        <p className="truncate text-xs text-muted">
          {statusMeta(e.status).label} · {e.media.genres.slice(0, 3).join(", ")}
          {e.notes ? " · has notes" : ""}
        </p>
        {e.media.episodes ? (
          <div className="mt-1.5 h-1 max-w-xs overflow-hidden rounded-full bg-line">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, (e.progress / e.media.episodes) * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm" aria-label="One episode back" onClick={() => update(e.mediaId, { progress: e.progress - 1 })} disabled={e.progress <= 0}>
          <Minus className="size-4" />
        </button>
        <span className="w-16 text-center text-sm tabular-nums">
          {e.progress}/{e.media.episodes ?? "?"}
        </span>
        <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm" aria-label="Next episode watched" onClick={() => update(e.mediaId, { progress: e.progress + 1 })}>
          <Plus className="size-4" />
        </button>
      </div>
      <label className="sr-only" htmlFor={`score-${e.mediaId}`}>Score for {e.media.title}</label>
      <input id={`score-${e.mediaId}`} className="k-input !min-h-9 w-16 text-center text-sm tabular-nums max-sm:hidden" inputMode="numeric" placeholder="—" defaultValue={e.score ?? ""} onBlur={(ev) => update(e.mediaId, { score: ev.target.value ? Number(ev.target.value) : null })} />
    </li>
  );
}
