"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { BookmarkPlus, Check, ChevronDown, FolderPlus, Heart, Minus, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { MangaCard } from "@/lib/anilist/manga-types";
import { MANGA_LIBRARY_STATUSES, mangaStatusMeta, snapshotFromManga, type MangaSnapshot, type MangaStatus } from "@/lib/manga/types";
import { useMangaLibrary } from "@/stores/manga";
import { cn } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";

const itemCls =
  "flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-[min(var(--k-radius-btn),10px)] px-3 text-sm outline-none data-[highlighted]:bg-[var(--k-btn-ghost)] data-[highlighted]:text-fg";

/** Source of a manga for library writes: a full AniList card, or a ready snapshot (demo series, library rows). */
export type MangaRef = { id: number; snapshot: MangaSnapshot };
export const refFromCard = (m: MangaCard): MangaRef => ({ id: m.id, snapshot: snapshotFromManga(m) });

export function MangaListMenu({ manga, size = "md", className, align = "start" }: { manga: MangaRef; size?: "sm" | "md"; className?: string; align?: "start" | "end" }) {
  const entry = useMangaLibrary((s) => s.entries[manga.id]);
  const hydrated = useMangaLibrary((s) => s.hydrated);
  const collections = useMangaLibrary((s) => s.collections);
  const upsert = useMangaLibrary((s) => s.upsert);
  const remove = useMangaLibrary((s) => s.remove);
  const toggleInCollection = useMangaLibrary((s) => s.toggleInCollection);
  const title = manga.snapshot.title;

  const setStatus = (status: MangaStatus) => {
    const total = manga.snapshot.chapters;
    upsert(manga, { status, ...(status === "COMPLETED" && total ? { progress: total } : {}) });
    toast.success(mangaStatusMeta(status).label, { description: title });
  };

  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button type="button" className={cn("k-btn", entry ? "k-btn-outline" : "k-btn-ghost", size === "sm" && "k-btn-sm", className)} aria-label={entry ? `${mangaStatusMeta(entry.status).label}: cambiar estado de ${title}` : `Añadir a la biblioteca: ${title}`} disabled={!hydrated}>
          {entry ? <Check className="size-4 text-primary-ink" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          <span>{entry ? mangaStatusMeta(entry.status).label : "Añadir a mi biblioteca"}</span>
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align={align} sideOffset={8} className="k-panel z-[90] min-w-56 !bg-surface p-1.5">
          <DM.Label className="k-label px-3 pb-1 pt-2 text-muted">Estado de lectura</DM.Label>
          {MANGA_LIBRARY_STATUSES.map((s) => (
            <DM.Item key={s.value} className={itemCls} onSelect={() => setStatus(s.value)}>
              <span className="grid size-4 place-items-center">{entry?.status === s.value && <Check className="size-4 text-primary-ink" />}</span>
              <span className="flex-1">{s.label}</span>
              <span className="k-jp text-xs text-muted" lang="ja">
                {s.jp}
              </span>
            </DM.Item>
          ))}
          {Object.keys(collections).length > 0 && (
            <>
              <DM.Separator className="my-1.5 h-px bg-line" />
              <DM.Sub>
                <DM.SubTrigger className={itemCls}>
                  <FolderPlus className="size-4" aria-hidden /> <span className="flex-1">Colecciones de manga</span>
                </DM.SubTrigger>
                <DM.Portal>
                  <DM.SubContent className="k-panel z-[91] min-w-52 !bg-surface p-1.5" sideOffset={6}>
                    {Object.values(collections).map((c) => (
                      <DM.CheckboxItem
                        key={c.id}
                        className={itemCls}
                        checked={c.mangaIds.includes(manga.id)}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!useMangaLibrary.getState().entries[manga.id]) upsert(manga, {});
                          toggleInCollection(c.id, manga.id);
                        }}
                      >
                        <span className="grid size-4 place-items-center">
                          <DM.ItemIndicator>
                            <Check className="size-4 text-primary-ink" />
                          </DM.ItemIndicator>
                        </span>
                        <span className="size-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                        <span className="flex-1 truncate">{c.name}</span>
                      </DM.CheckboxItem>
                    ))}
                  </DM.SubContent>
                </DM.Portal>
              </DM.Sub>
            </>
          )}
          {entry && (
            <>
              <DM.Separator className="my-1.5 h-px bg-line" />
              <DM.Item
                className={cn(itemCls, "text-danger data-[highlighted]:text-danger")}
                onSelect={() => {
                  const snapshot = entry;
                  remove(manga.id);
                  toast("Eliminado de tu biblioteca de manga", { description: title, action: { label: "Deshacer", onClick: () => useMangaLibrary.getState().importEntries([snapshot], { overwrite: true }) } });
                }}
              >
                <Trash2 className="size-4" aria-hidden /> Quitar de la biblioteca
              </DM.Item>
            </>
          )}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function MangaFavoriteButton({ manga, className, size = "md" }: { manga: MangaRef; className?: string; size?: "sm" | "md" }) {
  const entry = useMangaLibrary((s) => s.entries[manga.id]);
  const hydrated = useMangaLibrary((s) => s.hydrated);
  const upsert = useMangaLibrary((s) => s.upsert);
  const { reduced } = useKazeMotion();
  const on = Boolean(entry?.favorite);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Quitar de favoritos" : "Añadir a favoritos"}
      disabled={!hydrated}
      className={cn("k-btn k-btn-ghost k-btn-icon", size === "sm" && "k-btn-sm", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        upsert(manga, { favorite: !on });
      }}
    >
      <motion.span key={String(on)} initial={reduced ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }} className="grid place-items-center">
        <Heart className={cn("size-[18px]", on && "fill-accent text-accent")} aria-hidden />
      </motion.span>
    </button>
  );
}

/** Manual chapter/volume logging for titles read outside KAZE (e.g. on an official app). */
export function ProgressStepper({ manga }: { manga: MangaRef }) {
  const entry = useMangaLibrary((s) => s.entries[manga.id]);
  const upsert = useMangaLibrary((s) => s.upsert);
  const total = manga.snapshot.chapters;
  const totalVol = manga.snapshot.volumes;
  const ch = entry?.progress ?? 0;
  const vol = entry?.progressVolumes ?? 0;
  const set = (patch: { progress?: number; progressVolumes?: number }) => upsert(manga, { ...(entry ? {} : { status: "CURRENT" as const }), ...patch });
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Capítulos leídos", value: ch, total, key: "progress" as const },
        { label: "Volúmenes leídos", value: vol, total: totalVol, key: "progressVolumes" as const },
      ].map((r) => (
        <div key={r.key} className="k-card p-3">
          <p className="text-xs text-muted">{r.label}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <button type="button" className="k-btn k-btn-ghost k-btn-icon k-btn-sm" aria-label={`Restar uno a ${r.label.toLowerCase()}`} disabled={r.value <= 0} onClick={() => set({ [r.key]: Math.max(0, r.value - 1) })}>
              <Minus className="size-4" aria-hidden />
            </button>
            <output className="km-number min-w-[3ch] text-center text-2xl" aria-live="polite">
              {r.value}
            </output>
            <button type="button" className="k-btn k-btn-ghost k-btn-icon k-btn-sm" aria-label={`Sumar uno a ${r.label.toLowerCase()}`} disabled={Boolean(r.total && r.value >= r.total)} onClick={() => set({ [r.key]: r.value + 1 })}>
              <Plus className="size-4" aria-hidden />
            </button>
            <span className="text-xs text-muted">/ {r.total ?? "?"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AddBookmarkHint() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      <BookmarkPlus className="size-3.5" aria-hidden /> Los marcadores se crean desde el lector (tecla B).
    </p>
  );
}
