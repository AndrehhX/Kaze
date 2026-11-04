import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMangaDetails } from "@/lib/manga/anilist-manga";
import { MangaReader } from "@/components/manga/manga-reader";

interface PageProps {
  params: Promise<{ id: string; chapterId: string }>;
}

async function loadManga(idParam: string) {
  const id = Number.parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const media = await getMangaDetails(id);
    if (!media || media.isAdult) return null;
    return media;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const media = await loadManga(id);
  if (!media) return { title: "Lector de Manga · Orunei" };

  const title = media.title.english || media.title.romaji || "Manga";
  return {
    title: `Leyendo ${title} · Orunei`,
    description: `Lee los capítulos de ${title} online en español en alta resolución.`,
  };
}

export default function MangaReaderPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-neutral-400">
          Cargando lector...
        </div>
      }
    >
      <MangaReaderContent params={params} />
    </Suspense>
  );
}

async function MangaReaderContent({ params }: PageProps) {
  const { id, chapterId } = await params;
  const media = await loadManga(id);

  if (!media || !chapterId) {
    notFound();
  }

  const title = media.title.english || media.title.romaji || media.title.userPreferred || "Manga";

  return (
    <MangaReader
      mangaId={media.id}
      chapterId={chapterId}
      mangaTitle={title}
      mangaRomaji={media.title.romaji}
      mangaEnglish={media.title.english}
    />
  );
}
