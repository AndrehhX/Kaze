import Link from "next/link";
import { BookOpen, Info } from "lucide-react";
import { chapterLabel, sortChapters, type MangaChapter, type MangaVolume } from "@/lib/manga/catalog";
import { ChapterStatus } from "./interactive";

/**
 * Chapter & volume catalog. Only providers with real catalogs (KAZE Originals today, licensed sources later) list chapters.
 * For AniList titles we never fabricate a chapter list from the total count.
 */
export function ChapterCatalog({ mangaId, slug, chapters, volumes, tab }: { mangaId: number; slug: string; chapters: MangaChapter[]; volumes: MangaVolume[]; tab: "chapters" | "volumes" }) {
  const sorted = sortChapters(chapters);
  return (
    <div>
      <div role="tablist" aria-label="Catálogo" className="mb-5 flex gap-1.5">
        <Link role="tab" aria-selected={tab === "chapters"} href={`/manga/${slug}/chapters`} className="k-chip" data-active={tab === "chapters"}>
          Capítulos ({sorted.length})
        </Link>
        <Link role="tab" aria-selected={tab === "volumes"} href={`/manga/${slug}/volumes`} className="k-chip" data-active={tab === "volumes"}>
          Volúmenes ({volumes.length})
        </Link>
      </div>
      {tab === "chapters" ? (
        <ol className="divide-y divide-line border-y border-line">
          {sorted.map((c) => (
            <li key={c.id}>
              <Link href={`/manga/read/${slug}/${c.id}`} className="group flex items-center gap-4 px-2 py-3 hover:bg-[var(--k-btn-ghost)]">
                <span className="km-number w-14 shrink-0 text-2xl text-muted">{c.number ?? "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold group-hover:text-primary-ink">{chapterLabel(c)}{c.title ? ` · ${c.title}` : ""}</span>
                  <span className="text-xs text-muted">
                    {c.pageCount} páginas{c.kind !== "regular" ? " · capítulo extra" : ""}
                    {c.releasedAt ? ` · ${c.releasedAt}` : ""} · {c.language.toUpperCase()}
                  </span>
                </span>
                <ChapterStatus mangaId={mangaId} chapterId={c.id} />
                <BookOpen className="size-4 text-muted group-hover:text-primary-ink" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      ) : volumes.length ? (
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {volumes.map((v) => (
            <li key={v.id}>
              <div className="km-book">
                <div className="k-poster aspect-[2/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.cover && <img src={v.cover} alt="" className="size-full object-cover" />}
                </div>
              </div>
              <p className="mt-2 font-display text-lg">Volumen {v.number}</p>
              {v.title && <p className="text-sm text-muted">{v.title}</p>}
              <ul className="mt-2 space-y-1 text-sm">
                {v.chapterIds.map((id) => {
                  const c = chapters.find((x) => x.id === id);
                  return c ? (
                    <li key={id}>
                      <Link href={`/manga/read/${slug}/${id}`} className="hover:text-primary-ink">
                        {chapterLabel(c)}
                      </Link>
                    </li>
                  ) : null;
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Esta obra se publica por episodios (formato webtoon) y no tiene tomos recopilatorios.</p>
      )}
    </div>
  );
}

/** Honest state for AniList titles: real totals only, plus where to read legally. */
export function NoCatalogNotice({ chapters, volumes, status }: { chapters: number | null; volumes: number | null; status: string | null }) {
  return (
    <div className="km-frame flex gap-3 p-5 text-sm">
      <Info className="mt-0.5 size-5 shrink-0 text-primary-ink" aria-hidden />
      <div>
        <p className="font-semibold">Catálogo de capítulos no disponible en KAZE</p>
        <p className="mt-1 text-muted">
          Según AniList: {chapters ? `${chapters} capítulos` : "número de capítulos desconocido"}
          {volumes ? ` en ${volumes} volúmenes` : ""}
          {status === "RELEASING" ? " (sigue en publicación, el total puede cambiar)" : ""}. No generamos listas de capítulos a partir de ese número porque la numeración real incluye extras, capítulos decimales y ediciones distintas.
        </p>
        <p className="mt-2 text-muted">Lee los capítulos en las plataformas oficiales que aparecen en «Dónde leer».</p>
      </div>
    </div>
  );
}
