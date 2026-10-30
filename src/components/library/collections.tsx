"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reorder } from "motion/react";
import { ArrowLeft, FolderPlus, GripVertical, Globe, Lock, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLibrary } from "@/stores/library";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, SafeImage, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const COLORS = ["#a855f7", "#ff4fd8", "#00d9ff", "#b3ff39", "#e96b35", "#e86a9a", "#287bff", "#f2a65a"];

function CollectionForm({ initial, onSubmit, submitLabel }: { initial?: { name: string; description: string; color: string; isPublic: boolean }; onSubmit: (v: { name: string; description: string; color: string; isPublic: boolean }) => void; submitLabel: string }) {
  const [v, setV] = useState(initial ?? { name: "", description: "", color: COLORS[0], isPublic: false });
  const [err, setErr] = useState("");
  return (
    <form
      className="space-y-4 px-5 pb-5 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.name.trim()) return setErr("Give your collection a name");
        onSubmit({ ...v, name: v.name.trim() });
      }}
    >
      <div>
        <label htmlFor="c-name" className="mb-1.5 block text-sm font-semibold">Name</label>
        <input id="c-name" className="k-input" maxLength={60} value={v.name} onChange={(e) => (setV({ ...v, name: e.target.value }), setErr(""))} autoFocus aria-invalid={Boolean(err)} />
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </div>
      <div>
        <label htmlFor="c-desc" className="mb-1.5 block text-sm font-semibold">Description</label>
        <textarea id="c-desc" className="k-input !min-h-20 text-sm" maxLength={400} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setV({ ...v, color: c })} aria-pressed={v.color === c} aria-label={`Colour ${c}`} className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface", v.color === c && "ring-2 ring-fg")} style={{ background: c }} />
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.isPublic} onChange={(e) => setV({ ...v, isPublic: e.target.checked })} className="accent-[var(--k-primary)]" /> Show on my public profile (respects your list privacy)
      </label>
      <div className="flex justify-end">
        <button className="k-btn k-btn-primary k-btn-sm">{submitLabel}</button>
      </div>
    </form>
  );
}

export function CollectionsIndex() {
  const collections = useLibrary((s) => s.collections);
  const entries = useLibrary((s) => s.entries);
  const hydrated = useLibrary((s) => s.hydrated);
  const create = useLibrary((s) => s.createCollection);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const list = Object.values(collections).sort((a, b) => b.updatedAt - a.updatedAt);
  if (!hydrated) return <Skeleton className="container-k mt-10 h-64" />;
  return (
    <div className="container-k pt-8">
      <Link href="/library" className="k-btn k-btn-ghost k-btn-sm">
        <ArrowLeft className="size-4" aria-hidden /> Library
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="k-label text-primary-ink">Curate</p>
          <h1 className="font-display text-title mt-2">Collections</h1>
        </div>
        <button className="k-btn k-btn-primary" onClick={() => setOpen(true)}>
          <FolderPlus className="size-4" aria-hidden /> New collection
        </button>
      </div>
      {list.length === 0 ? (
        <EmptyState className="mt-8" jp="集" icon={<FolderPlus className="size-6" />} title="No collections yet" body="Group anime however you like: “Rainy-day comfort”, “Show my friends”, “2000s mecha”…" action={<button className="k-btn k-btn-primary k-btn-sm" onClick={() => setOpen(true)}>Create one</button>} />
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const covers = c.mediaIds.slice(0, 4).map((id) => entries[id]?.media.cover).filter(Boolean) as string[];
            return (
              <li key={c.id}>
                <Link href={`/library/collections/${c.id}`} className="k-card group block overflow-hidden transition-shadow hover:shadow-[var(--k-hover-glow)]">
                  <div className="relative flex h-40 items-end gap-0 overflow-hidden p-4" style={{ background: `linear-gradient(135deg, ${c.color}66, var(--k-surface))` }}>
                    {covers.map((src, i) => (
                      <div key={i} className="k-poster relative -ml-6 aspect-[2/3] w-20 shrink-0 first:ml-0 transition-transform group-hover:-translate-y-1" style={{ rotate: `${(i - 1.5) * 4}deg`, zIndex: 4 - i }}>
                        <SafeImage src={src} alt="" fill sizes="80px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="p-4">
                    <p className="flex items-center gap-2 font-display text-lg">
                      {c.name} {c.isPublic ? <Globe className="size-3.5 text-muted" aria-label="Public" /> : <Lock className="size-3.5 text-muted" aria-label="Private" />}
                    </p>
                    <p className="clamp-2 text-sm text-muted">{c.description || `${c.mediaIds.length} titles`}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen} title="New collection">
        <CollectionForm
          submitLabel="Create"
          onSubmit={(v) => {
            const c = create(v);
            setOpen(false);
            toast.success("Collection created");
            router.push(`/library/collections/${c.id}`);
          }}
        />
      </Dialog>
    </div>
  );
}

export function CollectionDetail({ id }: { id: string }) {
  const c = useLibrary((s) => s.collections[id]);
  const entries = useLibrary((s) => s.entries);
  const hydrated = useLibrary((s) => s.hydrated);
  const updateCollection = useLibrary((s) => s.updateCollection);
  const deleteCollection = useLibrary((s) => s.deleteCollection);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  if (!hydrated) return <Skeleton className="container-k mt-10 h-64" />;
  if (!c)
    return (
      <div className="container-k pt-10">
        <EmptyState title="Collection not found" body="It may have been deleted, or it lives on another device or account." action={<Link className="k-btn k-btn-outline k-btn-sm" href="/library/collections">All collections</Link>} />
      </div>
    );
  return (
    <div className="container-k pt-8">
      <Link href="/library/collections" className="k-btn k-btn-ghost k-btn-sm">
        <ArrowLeft className="size-4" aria-hidden /> Collections
      </Link>
      <header className="k-card relative mt-4 overflow-hidden p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${c.color}55, var(--k-surface) 70%)` }}>
        <p className="k-label flex items-center gap-2 text-muted">
          {c.isPublic ? <Globe className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />} {c.isPublic ? "Public" : "Private"} collection · {c.mediaIds.length} titles
        </p>
        <h1 className="font-display text-title mt-2">{c.name}</h1>
        {c.description && <p className="mt-2 max-w-2xl text-muted">{c.description}</p>}
        <div className="mt-5 flex gap-2">
          <button className="k-btn k-btn-outline k-btn-sm" onClick={() => setEdit(true)}>Edit</button>
          <button className="k-btn k-btn-ghost k-btn-sm text-danger" onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </button>
        </div>
      </header>
      {c.mediaIds.length === 0 ? (
        <EmptyState className="mt-6" title="This collection is empty" body="Use “Add to list → Collections” on any anime, or select titles in your library." />
      ) : (
        <>
          <p className="mt-6 text-xs text-muted">Drag to reorder (or focus the handle and use the arrow keys).</p>
          <Reorder.Group axis="y" values={c.mediaIds} onReorder={(ids) => updateCollection(c.id, { mediaIds: ids })} className="k-card mt-2 divide-y divide-line">
            {c.mediaIds.map((mid, i) => {
              const e = entries[mid];
              return (
                <Reorder.Item key={mid} value={mid} className="flex items-center gap-3 bg-surface p-3">
                  <button
                    className="cursor-grab touch-none text-muted"
                    aria-label={`Reorder ${e?.media.title ?? mid}. Position ${i + 1} of ${c.mediaIds.length}`}
                    onKeyDown={(ev) => {
                      if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
                      ev.preventDefault();
                      const j = ev.key === "ArrowUp" ? i - 1 : i + 1;
                      if (j < 0 || j >= c.mediaIds.length) return;
                      const ids = [...c.mediaIds];
                      [ids[i], ids[j]] = [ids[j], ids[i]];
                      updateCollection(c.id, { mediaIds: ids });
                    }}
                  >
                    <GripVertical className="size-5" />
                  </button>
                  <span className="k-outline-num w-8 text-2xl">{i + 1}</span>
                  <div className="k-poster relative aspect-[2/3] w-11 shrink-0">
                    <SafeImage src={e?.media.cover ?? ""} alt="" fill sizes="44px" className="object-cover" fallbackLabel={e?.media.title} />
                  </div>
                  <Link href={`/anime/${mid}`} className="min-w-0 flex-1 truncate font-semibold hover:text-primary-ink">
                    {e?.media.title ?? `AniList #${mid}`}
                  </Link>
                  <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm" aria-label="Remove from collection" onClick={() => updateCollection(c.id, { mediaIds: c.mediaIds.filter((x) => x !== mid) })}>
                    <X className="size-4" />
                  </button>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </>
      )}
      <Dialog open={edit} onOpenChange={setEdit} title="Edit collection">
        <CollectionForm
          initial={{ name: c.name, description: c.description, color: c.color, isPublic: c.isPublic }}
          submitLabel="Save"
          onSubmit={(v) => {
            updateCollection(c.id, v);
            setEdit(false);
            toast.success("Saved");
          }}
        />
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this collection?"
        body="The anime stay in your library; only the collection is removed."
        destructive
        confirmLabel="Delete"
        onConfirm={() => {
          deleteCollection(c.id);
          router.push("/library/collections");
          toast("Collection deleted");
        }}
      />
    </div>
  );
}
