import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { DEMO_SERIES, demoBySlug, demoSnapshot } from "@/lib/manga/demo/series";
import { adjacentChapters, chapterLabel, sortChapters, type MangaChapter } from "@/lib/manga/catalog";
import { demoMangaProvider } from "@/lib/manga/providers/demo";
import { getMangaDetail } from "@/lib/anilist/manga-service";
import { mangaTitle } from "@/lib/anilist/manga-types";
import { availabilityFor, catalogFor, contentFor, seriesKeyFor } from "@/lib/manga/providers";
import { snapshotFromManga } from "@/lib/manga/types";
import { AvailabilityList } from "@/components/manga/detail/interactive";
import { MangaReader, type ReaderChapter } from "@/components/manga/reader/reader";

type Props = { params: Promise<{ mangaId: string; chapterId: string }>; searchParams: Promise<{ page?: string }> };

export function generateStaticParams() {
  return DEMO_SERIES.flatMap((s) => s.chapters.map((c) => ({ mangaId: s.slug, chapterId: c.id })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mangaId, chapterId } = await params;
  const s = demoBySlug(mangaId);
  if (s) {
    const c = s.chapters.find((x) => x.id === chapterId);
    return { title: c ? `${s.title} · ${chapterLabel(c)} (demo)` : "Lector de manga", robots: { index: false } };
  }
  const anilistId = Number.parseInt(mangaId, 10);
  if (Number.isInteger(anilistId) && anilistId > 0) {
    const m = await getMangaDetail(anilistId);
    if (m) {
      return { title: `${mangaTitle(m)} · Leer manga en KAZE`, robots: { index: false } };
    }
  }
  return { title: "Lector de manga", robots: { index: false } };
}

const toReaderChapter = (c: MangaChapter): ReaderChapter => ({ id: c.id, label: chapterLabel(c), title: c.title, number: c.number, regular: c.kind === "regular" });

export default function ReadPage(props: Props) {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] bg-black" aria-busy="true" />}>
      <ReadContent {...props} />
    </Suspense>
  );
}

async function ReadContent({ params, searchParams }: Props) {
  const { mangaId, chapterId } = await params;
  const s = demoBySlug(mangaId);
  if (s) {
    const chapter = s.chapters.find((c) => c.id === chapterId);
    if (!chapter) notFound();
    const entitlement = await demoMangaProvider.canRead(chapter.id, { userId: null });
    if (!entitlement.allowed) notFound();
    const pages = await demoMangaProvider.getPages(chapter.id);
    const ordered = sortChapters(s.chapters);
    const { prev, next } = adjacentChapters(s.chapters, chapter.id);
    return (
      <Suspense fallback={<div className="fixed inset-0 z-[60] bg-black" />}>
        <ReaderWithPage
          searchParams={searchParams}
          props={{
            mangaId: s.id,
            slug: s.slug,
            seriesTitle: s.title,
            snapshot: demoSnapshot(s),
            readingDirection: s.readingDirection,
            chapter: toReaderChapter(chapter),
            pages,
            chapters: ordered.map(toReaderChapter),
            prev: prev ? toReaderChapter(prev) : null,
            next: next ? toReaderChapter(next) : null,
            demo: true,
          }}
        />
      </Suspense>
    );
  }

  // AniList series lookup
  const anilistId = Number.parseInt(mangaId, 10);
  if (!Number.isInteger(anilistId) || anilistId <= 0) return <NotReadable param={mangaId} />;
  const media = await getMangaDetail(anilistId);
  if (!media || media.isAdult) return <NotReadable param={mangaId} />;

  const seriesKey = seriesKeyFor(media.id);
  const catalog = catalogFor(seriesKey);
  const content = contentFor(seriesKey);
  if (!catalog || !content) return <NotReadable param={mangaId} />;

  const chapters = await catalog.listChapters(seriesKey);
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) return <NotReadable param={mangaId} />;

  const pages = await content.getPages(chapter.id);
  if (!pages || pages.length === 0) return <NotReadable param={mangaId} />;

  const ordered = sortChapters(chapters);
  const { prev, next } = adjacentChapters(chapters, chapter.id);

  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] bg-black" />}>
      <ReaderWithPage
        searchParams={searchParams}
        props={{
          mangaId: media.id,
          slug: String(media.id),
          seriesTitle: mangaTitle(media),
          snapshot: snapshotFromManga(media),
          readingDirection: media.countryOfOrigin === "KR" || media.countryOfOrigin === "CN" ? "vertical" : "rtl",
          chapter: toReaderChapter(chapter),
          pages,
          chapters: ordered.map(toReaderChapter),
          prev: prev ? toReaderChapter(prev) : null,
          next: next ? toReaderChapter(next) : null,
          demo: false,
        }}
      />
    </Suspense>
  );
}

async function ReaderWithPage({ searchParams, props }: { searchParams: Props["searchParams"]; props: Omit<React.ComponentProps<typeof MangaReader>, "initialPage"> }) {
  const raw = Number.parseInt((await searchParams).page ?? "", 10);
  const initialPage = Number.isInteger(raw) && raw > 0 ? raw - 1 : null;
  return <MangaReader key={props.chapter.id} {...props} initialPage={initialPage} />;
}

/** Fallback notice when chapters cannot be resolved */
async function NotReadable({ param }: { param: string }) {
  const id = Number.parseInt(param, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== param) notFound();
  const m = await getMangaDetail(id);
  if (!m || m.isAdult) notFound();
  const title = mangaTitle(m);
  return (
    <div className="container-k max-w-3xl pb-16 pt-12">
      <BookOpen className="size-8 text-primary-ink" aria-hidden />
      <h1 className="km-title mt-4 text-title">{title} · Capítulo no disponible</h1>
      <p className="mt-3 text-muted">
        Las páginas de este capítulo no se pudieron cargar en este momento desde los servidores. Puedes intentar recargar la página o seleccionar otro capítulo de la obra dentro de KAZE.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/manga/${m.id}#chapters`} className="k-btn k-btn-primary">
          <BookOpen className="size-4" aria-hidden /> Ver lista de capítulos
        </Link>
        <Link href={`/manga/${m.id}`} className="k-btn k-btn-outline">
          Volver a la ficha
        </Link>
      </div>
    </div>
  );
}
