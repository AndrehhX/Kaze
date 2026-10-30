import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMediaDetail } from "@/lib/anilist/service";
import { EpisodeBrowser } from "@/components/anime/episode-browser";

export async function generateMetadata({ params }: PageProps<"/anime/[id]/episodes">): Promise<Metadata> {
  const id = Number((await params).id);
  const media = Number.isInteger(id) && id > 0 ? await getMediaDetail(id) : null;
  return { title: media ? `Episodes · ${media.title.english || media.title.romaji}` : "Episodes" };
}

export default async function EpisodesPage({ params }: PageProps<"/anime/[id]/episodes">) {
  const raw = (await params).id;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) notFound();
  const media = await getMediaDetail(id);
  if (!media || media.isAdult) notFound();
  const title = media.title.english || media.title.romaji || "Anime";
  return (
    <div className="container-k pt-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/discover" className="hover:text-fg">
              Discover
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/anime/${media.id}`} className="hover:text-fg">
              {title}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-fg">
            Episodes
          </li>
        </ol>
      </nav>
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="k-label text-primary-ink">Episode guide</p>
          <h1 className="font-display text-title mt-2">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Episode titles and thumbnails appear only where AniList provides official streaming metadata; air dates come from AniList&apos;s schedule. KAZE doesn&apos;t stream this title —
            links open the official service.
          </p>
        </div>
        <Link href={`/anime/${media.id}`} className="k-btn k-btn-ghost k-btn-sm">
          <ArrowLeft className="size-4" aria-hidden /> Back to title
        </Link>
      </header>
      <EpisodeBrowser media={media} />
    </div>
  );
}
