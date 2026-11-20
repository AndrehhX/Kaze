"use client";

import Link from "next/link";
import { BookOpen, Check, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMangaLibrary, progressKey } from "@/stores/manga";
import { MangaFavoriteButton, MangaListMenu, ProgressStepper, type MangaRef } from "../library-actions";
import { mangaStatusMeta } from "@/lib/manga/types";
import type { ReadingAvailability } from "@/lib/manga/catalog";

export function DetailActions({ manga, readHref, firstChapterHref }: { manga: MangaRef; readHref?: string | null; firstChapterHref?: string | null }) {
  const entry = useMangaLibrary((s) => s.entries[manga.id]);
  const mangaSlug = manga.snapshot.slug || String(manga.id);
  const resume = entry?.lastChapterId ? `/manga/read/${mangaSlug}/${entry.lastChapterId}?page=${(entry.lastPage ?? 0) + 1}` : null;
  const startHref = firstChapterHref || (readHref && readHref.startsWith("/manga/read/") ? readHref : null) || `#chapters`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {resume ? (
        <Link href={resume} className="k-btn k-btn-primary">
          <BookOpen className="size-4" aria-hidden /> Continuar · {entry?.lastChapterLabel || "Capítulo"}
        </Link>
      ) : (
        <Link href={startHref} className="k-btn k-btn-primary">
          <BookOpen className="size-4" aria-hidden /> Empezar a leer
        </Link>
      )}
      <MangaListMenu manga={manga} />
      <MangaFavoriteButton manga={manga} />
      <ShareButton title={manga.snapshot.title} />
    </div>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} en KAZE`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user dismissed the share sheet */
    }
  };
  return (
    <button type="button" className="k-btn k-btn-ghost k-btn-icon" aria-label="Compartir" onClick={share}>
      {copied ? <Check className="size-[18px]" aria-hidden /> : <Share2 className="size-[18px]" aria-hidden />}
    </button>
  );
}

export function YourMangaEntry({ manga }: { manga: MangaRef }) {
  const entry = useMangaLibrary((s) => s.entries[manga.id]);
  const update = useMangaLibrary((s) => s.update);
  const hydrated = useMangaLibrary((s) => s.hydrated);
  if (!hydrated) return <div className="k-skeleton h-40" />;
  return (
    <section aria-labelledby="your-manga" className="km-frame p-4">
      <h2 id="your-manga" className="k-label text-muted">
        Tu lectura
      </h2>
      {entry ? (
        <>
          <p className="mt-2 font-display text-lg">{mangaStatusMeta(entry.status).label}</p>
          {entry.lastChapterLabel && <p className="text-xs text-muted">Última posición: {entry.lastChapterLabel}{entry.lastPage != null ? `, página ${entry.lastPage + 1}` : ""}</p>}
          <div className="mt-3">
            <ProgressStepper manga={manga} />
          </div>
          <label className="mt-3 block text-xs text-muted">
            Tu puntuación
            <select className="k-input mt-1" value={entry.score ?? ""} onChange={(e) => update(manga.id, { score: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Sin puntuar</option>
              {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((s) => (
                <option key={s} value={s}>
                  {s / 10} / 10
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs text-muted">
            Notas privadas
            <textarea className="k-input mt-1 !min-h-20" defaultValue={entry.notes} maxLength={4000} onBlur={(e) => e.target.value !== entry.notes && update(manga.id, { notes: e.target.value })} />
          </label>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Aún no está en tu biblioteca. Añádelo para registrar capítulos, volúmenes y notas.</p>
      )}
    </section>
  );
}

/** Reading availability: embedded KAZE reading (only for content we have rights to) or official external destinations. */
export function AvailabilityList({ options, mangaTitle }: { options: ReadingAvailability[]; mangaTitle: string }) {
  if (!options.length)
    return (
      <div className="km-frame p-5 text-sm text-muted">
        <p className="font-semibold text-fg">No hay un destino de lectura oficial registrado.</p>
        <p className="mt-1">AniList no lista plataformas oficiales para {mangaTitle}. KAZE no aloja capítulos de obras comerciales sin licencia; consulta la editorial o tu librería habitual para el tomo físico o digital.</p>
      </div>
    );
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <li key={`${o.provider}-${o.label}-${o.language}`}>
          {o.kind === "embedded" ? (
            <Link href={o.url ?? "#"} className="km-frame flex h-full flex-col gap-1 p-4 transition-colors hover:bg-[var(--k-btn-ghost)]">
              <span className="font-semibold">{o.label}</span>
              <span className="text-xs text-muted">{o.note}</span>
            </Link>
          ) : (
            <a href={o.url ?? "#"} target="_blank" rel="noopener noreferrer" className="km-frame flex h-full flex-col gap-1 p-4 transition-colors hover:bg-[var(--k-btn-ghost)]">
              <span className="font-semibold">
                {o.label} <span aria-hidden>↗</span>
              </span>
              <span className="text-xs text-muted">{o.note}</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Chapter list row status from local progress (demo/licensed catalogs only). */
export function ChapterStatus({ mangaId, chapterId }: { mangaId: number; chapterId: string }) {
  const p = useMangaLibrary((s) => s.chapterProgress[progressKey(mangaId, chapterId)]);
  if (!p) return null;
  return <span className={p.completed ? "text-xs font-semibold text-success" : "text-xs text-primary-ink"}>{p.completed ? "Leído" : `Pág. ${p.page + 1}/${p.pageCount}`}</span>;
}
