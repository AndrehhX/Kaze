"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { mangaApi } from "@/lib/manga/client-api";
import { useMangaLibrary } from "@/stores/manga";
import { MANGA_LIBRARY_STATUSES } from "@/lib/manga/types";
import { DEMO_SERIES } from "@/lib/manga/demo/series";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { MangaVault, type VaultItem } from "./vault";
import { vaultItemFromCard, vaultItemFromDemo, vaultItemFromEntry } from "./items";

type Shelf = "mine" | "trending" | "top" | "originals";

const SHELVES: { value: Shelf; label: string; jp: string }[] = [
  { value: "mine", label: "Mi colección", jp: "私の棚" },
  { value: "trending", label: "Tendencias", jp: "急上昇" },
  { value: "top", label: "Mejor valorados", jp: "名作" },
  { value: "originals", label: "KAZE Originals", jp: "風" },
];

export function ShelfPage() {
  const entries = useMangaLibrary((s) => s.entries);
  const hydrated = useMangaLibrary((s) => s.hydrated);
  const [chosen, setChosen] = useState<Shelf | null>(null);
  const [status, setStatus] = useState<string>("ALL");
  const [sel, setSel] = useState(0);
  const mine = Object.keys(entries).length > 0;

  // Until the visitor picks a shelf: their collection if it has volumes, otherwise a public shelf.
  const shelf: Shelf = chosen ?? (hydrated && !mine ? "trending" : "mine");
  const setShelf = (s: Shelf) => {
    setChosen(s);
    setSel(0);
  };

  const remote = useQuery({
    queryKey: ["manga-shelf", shelf],
    enabled: shelf === "trending" || shelf === "top",
    queryFn: ({ signal }) => mangaApi.browse({ sort: shelf === "top" ? "SCORE_DESC" : "TRENDING_DESC", perPage: 40, minPopularity: shelf === "top" ? 20000 : undefined }, signal),
  });

  const items: VaultItem[] = useMemo(() => {
    if (shelf === "originals") return DEMO_SERIES.map(vaultItemFromDemo);
    if (shelf === "mine") {
      return Object.values(entries)
        .filter((e) => status === "ALL" || (status === "FAVORITES" ? e.favorite : e.status === status))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(vaultItemFromEntry);
    }
    return (remote.data?.media ?? []).map((m) => vaultItemFromCard(m));
  }, [entries, remote.data, shelf, status]);


  return (
    <div className="container-k pb-10 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="k-label text-primary-ink">保管庫 · The Manga Vault</p>
          <h1 className="km-title mt-2 text-title">La Bóveda</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Recorre tu colección como una estantería de tomos. Arrastra, usa las flechas o el teclado; pulsa un volumen para traerlo al frente y otra vez para examinarlo.</p>
        </div>
        <div role="tablist" aria-label="Estanterías" className="flex flex-wrap gap-1.5">
          {SHELVES.map((s) => (
            <button key={s.value} role="tab" type="button" aria-selected={shelf === s.value} className="k-chip" data-active={shelf === s.value} onClick={() => setShelf(s.value)}>
              {s.label}
              <span className="k-jp text-[0.625rem] opacity-80" lang="ja">
                {s.jp}
              </span>
            </button>
          ))}
        </div>
      </header>

      {shelf === "mine" && mine && (
        <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Filtrar por estado">
          {[{ value: "ALL", label: "Todo" }, ...MANGA_LIBRARY_STATUSES.map((s) => ({ value: s.value, label: s.label })), { value: "FAVORITES", label: "Favoritos" }].map((s) => (
            <button key={s.value} type="button" className="k-chip" aria-pressed={status === s.value} onClick={() => (setStatus(s.value), setSel(0))}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        {(shelf === "trending" || shelf === "top") && remote.isLoading ? (
          <Skeleton className="h-[460px]" />
        ) : remote.isError && shelf !== "mine" && shelf !== "originals" ? (
          <EmptyState title="No pudimos cargar esta estantería" body="AniList no respondió. Prueba de nuevo en un momento o abre KAZE Originals." />
        ) : (
          <MangaVault
            items={items}
            label={SHELVES.find((s) => s.value === shelf)!.label}
            selected={sel}
            onSelect={setSel}
            emptyState={
              <EmptyState
                icon={<Layers className="size-6" />}
                jp="棚"
                title={status === "ALL" ? "Tu estantería está vacía" : "Nada en esta balda"}
                body="Añade manga a tu biblioteca desde cualquier ficha y aparecerá aquí como un tomo."
                action={
                  <Link href="/manga/discover" className="k-btn k-btn-primary k-btn-sm">
                    Explorar manga
                  </Link>
                }
              />
            }
          />
        )}
      </div>
    </div>
  );
}
