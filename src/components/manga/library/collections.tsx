"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderPlus, Globe2, Lock, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMangaLibrary } from "@/stores/manga";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { mangaHref, type MangaSnapshot } from "@/lib/manga/types";
import { EmptyState, SafeImage, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/dialog";
import { LibraryKindSwitch } from "./kind-switch";

const COLORS = ["#e96b35", "#a855f7", "#e86a9a", "#00d9ff", "#3ddc97", "#ffd166", "#242424"];

export function MangaCollectionsView() {
  const collections = useMangaLibrary((s) => s.collections);
  const entries = useMangaLibrary((s) => s.entries);
  const hydrated = useMangaLibrary((s) => s.hydrated);
  const create = useMangaLibrary((s) => s.createCollection);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const list = Object.values(collections).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="container-k pb-16 pt-8">
      <LibraryKindSwitch active="manga" />
      <p className="k-label text-primary-ink">コレクション</p>
      <h1 className="km-title mt-2 text-title">Colecciones de manga</h1>
      <form
        className="km-frame mt-6 flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const c = create({ name, color });
          setName("");
          toast.success("Colección creada", { description: c.name });
        }}
      >
        <label className="min-w-56 flex-1 text-xs text-muted">
          Nombre
          <input className="k-input mt-1" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Para leer este verano" />
        </label>
        <fieldset className="text-xs text-muted">
          <legend>Color</legend>
          <div className="mt-1 flex gap-1.5">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className="size-8 rounded-full ring-offset-2 ring-offset-bg aria-pressed:ring-2 aria-pressed:ring-primary" style={{ background: c }} />
            ))}
          </div>
        </fieldset>
        <button type="submit" className="k-btn k-btn-primary" disabled={!name.trim()}>
          <FolderPlus className="size-4" aria-hidden /> Crear
        </button>
      </form>
      {!hydrated ? (
        <Skeleton className="mt-8 h-48" />
      ) : !list.length ? (
        <EmptyState className="mt-8" jp="集" title="Aún no tienes colecciones" body="Agrupa tus manga como quieras. Después, añádelos desde el menú «Añadir a mi biblioteca» de cada ficha." />
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/manga/collections/${c.id}`} className="km-frame group block overflow-hidden p-4 hover:bg-[var(--k-btn-ghost)]">
                <div className="flex h-28 items-end gap-1.5">
                  {c.mangaIds.slice(0, 6).map((id, i) => (
                    <div key={id} className="k-poster relative h-full w-[18%] shrink-0" style={{ transform: `translateY(${i % 2 ? 6 : 0}px)` }}>
                      <SafeImage src={entries[id]?.media.cover ?? ""} alt="" fill sizes="60px" className="object-cover" />
                    </div>
                  ))}
                  {!c.mangaIds.length && <div className="km-tone h-full w-full opacity-40" />}
                </div>
                <p className="mt-3 flex items-center gap-2 font-display text-lg">
                  <span className="size-3 rounded-full" style={{ background: c.color }} aria-hidden /> {c.name}
                </p>
                <p className="text-xs text-muted">
                  {c.mangaIds.length} títulos · {c.isPublic ? "Pública" : "Privada"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MangaCollectionDetail({ id }: { id: string }) {
  const own = useMangaLibrary((s) => s.collections[id]);
  const entries = useMangaLibrary((s) => s.entries);
  const hydrated = useMangaLibrary((s) => s.hydrated);
  const updateCollection = useMangaLibrary((s) => s.updateCollection);
  const deleteCollection = useMangaLibrary((s) => s.deleteCollection);
  const toggle = useMangaLibrary((s) => s.toggleInCollection);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  // Someone else's public collection: read through RLS (only visible when public and the owner shares lists).
  const shared = useQuery({
    queryKey: ["manga-collection", id],
    enabled: hydrated && !own && Boolean(getSupabaseBrowser()) && /^[0-9a-f-]{36}$/i.test(id),
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()!.from("manga_collections").select("id, name, description, color, is_public, manga_collection_items(manga_id, position, media_snapshot)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; description: string; color: string; is_public: boolean; manga_collection_items: { manga_id: number; position: number; media_snapshot: MangaSnapshot }[] } | null;
    },
  });
  if (!hydrated || shared.isLoading) return <div className="container-k mt-10"><Skeleton className="h-64" /></div>;
  const items = own ? own.mangaIds.map((m) => ({ id: m, snap: entries[m]?.media })) : (shared.data?.manga_collection_items ?? []).sort((a, b) => a.position - b.position).map((i) => ({ id: i.manga_id, snap: i.media_snapshot }));
  const meta = own ?? (shared.data ? { name: shared.data.name, description: shared.data.description, color: shared.data.color, isPublic: shared.data.is_public } : null);
  if (!meta) return <div className="container-k mt-10"><EmptyState title="Colección no encontrada" body="Puede que sea privada o que se haya eliminado." /></div>;
  return (
    <div className="container-k pb-16 pt-8">
      <Link href="/manga/collections" className="text-sm text-muted hover:text-fg">
        ← Colecciones
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="km-title flex items-center gap-3 text-title">
            <span className="size-4 rounded-full" style={{ background: meta.color }} aria-hidden /> {meta.name}
          </h1>
          {meta.description && <p className="mt-2 max-w-2xl text-sm text-muted">{meta.description}</p>}
        </div>
        {own && (
          <div className="flex gap-2">
            <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => updateCollection(id, { isPublic: !own.isPublic })} aria-pressed={own.isPublic}>
              {own.isPublic ? <Globe2 className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />} {own.isPublic ? "Pública" : "Privada"}
            </button>
            <button type="button" className="k-btn k-btn-ghost k-btn-sm text-danger" onClick={() => setConfirm(true)}>
              <Trash2 className="size-4" aria-hidden /> Eliminar
            </button>
          </div>
        )}
      </div>
      {own && <p className="mt-2 text-xs text-muted">Las colecciones públicas solo son visibles si tu perfil comparte listas (Ajustes → Privacidad).</p>}
      {!items.length ? (
        <EmptyState className="mt-8" title="Colección vacía" body="Añade manga desde el menú de biblioteca de cualquier ficha." />
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map(({ id: mid, snap }) => (
            <li key={mid} className="relative">
              <Link href={mangaHref(mid, snap?.slug)} className="group block">
                <div className="km-book">
                  <div className="k-poster relative aspect-[2/3]">
                    <SafeImage src={snap?.cover ?? ""} alt="" fill sizes="180px" className="object-cover" fallbackLabel={snap?.title} />
                  </div>
                </div>
                <p className="clamp-2 mt-2 text-sm font-semibold group-hover:text-primary-ink">{snap?.title ?? `Manga ${mid}`}</p>
              </Link>
              {own && (
                <button type="button" className="k-btn k-btn-icon k-btn-sm absolute right-1 top-1 !bg-black/60 !text-white" aria-label={`Quitar ${snap?.title ?? "manga"} de la colección`} onClick={() => toggle(id, mid)}>
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Eliminar colección?"
        body="Los manga siguen en tu biblioteca; solo se elimina la agrupación."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          deleteCollection(id);
          setConfirm(false);
          router.push("/manga/collections");
        }}
      />
    </div>
  );
}
