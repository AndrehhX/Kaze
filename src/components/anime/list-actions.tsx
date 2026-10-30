"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, FolderPlus, Heart, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { MediaCard } from "@/lib/anilist/types";
import { LIBRARY_STATUSES, statusMeta, type LibraryStatus } from "@/lib/library/types";
import { useLibrary } from "@/stores/library";
import { cn } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";

const itemCls =
  "flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-[min(var(--k-radius-btn),10px)] px-3 text-sm outline-none data-[highlighted]:bg-[var(--k-btn-ghost)] data-[highlighted]:text-fg";

export function ListMenu({ media, size = "md", className, align = "start" }: { media: MediaCard; size?: "sm" | "md"; className?: string; align?: "start" | "end" }) {
  const entry = useLibrary((s) => s.entries[media.id]);
  const hydrated = useLibrary((s) => s.hydrated);
  const collections = useLibrary((s) => s.collections);
  const upsert = useLibrary((s) => s.upsert);
  const remove = useLibrary((s) => s.remove);
  const toggleInCollection = useLibrary((s) => s.toggleInCollection);
  const title = media.title.english || media.title.userPreferred || media.title.romaji || "this title";

  const setStatus = (status: LibraryStatus) => {
    const progress = status === "COMPLETED" ? (media.episodes ?? entry?.progress ?? 0) : entry?.progress;
    upsert(media, { status, ...(progress !== undefined ? { progress } : {}) });
    toast.success(`${statusMeta(status).label}`, { description: title });
  };

  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button
          type="button"
          className={cn("k-btn", entry ? "k-btn-outline" : "k-btn-ghost", size === "sm" && "k-btn-sm", className)}
          aria-label={entry ? `${statusMeta(entry.status).short}: change list status for ${title}` : `Add to list: ${title}`}
          disabled={!hydrated}
        >
          {entry ? <Check className="size-4 text-primary-ink" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          <span>{entry ? statusMeta(entry.status).short : "Add to list"}</span>
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align={align} sideOffset={8} className="k-panel z-[90] min-w-56 !bg-surface p-1.5 data-[state=open]:animate-in">
          <DM.Label className="k-label px-3 pb-1 pt-2 text-muted">Status</DM.Label>
          {LIBRARY_STATUSES.map((s) => (
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
                  <FolderPlus className="size-4" aria-hidden /> <span className="flex-1">Collections</span>
                </DM.SubTrigger>
                <DM.Portal>
                  <DM.SubContent className="k-panel z-[91] min-w-52 !bg-surface p-1.5" sideOffset={6}>
                    {Object.values(collections).map((c) => (
                      <DM.CheckboxItem
                        key={c.id}
                        className={itemCls}
                        checked={c.mediaIds.includes(media.id)}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (!useLibrary.getState().entries[media.id]) upsert(media, {});
                          toggleInCollection(c.id, media.id);
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
                  remove(media.id);
                  toast(`Removed from your library`, {
                    description: title,
                    action: { label: "Undo", onClick: () => useLibrary.getState().importEntries([snapshot], { overwrite: true }) },
                  });
                }}
              >
                <Trash2 className="size-4" aria-hidden /> Remove from library
              </DM.Item>
            </>
          )}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function FavoriteButton({ media, className, size = "md" }: { media: MediaCard; className?: string; size?: "sm" | "md" }) {
  const entry = useLibrary((s) => s.entries[media.id]);
  const hydrated = useLibrary((s) => s.hydrated);
  const upsert = useLibrary((s) => s.upsert);
  const { reduced } = useKazeMotion();
  const on = Boolean(entry?.favorite);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      disabled={!hydrated}
      className={cn("k-btn k-btn-ghost k-btn-icon", size === "sm" && "k-btn-sm", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        upsert(media, { favorite: !on });
      }}
    >
      <motion.span
        key={String(on)}
        initial={reduced ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        className="grid place-items-center"
      >
        <Heart className={cn("size-[18px]", on && "fill-accent text-accent")} aria-hidden />
      </motion.span>
    </button>
  );
}
