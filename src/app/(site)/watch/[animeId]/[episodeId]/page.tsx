import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Tv } from "lucide-react";
import { resolveSeries } from "@/lib/media/provider";
import { getMediaDetail } from "@/lib/anilist/service";
import { WatchClient } from "@/components/player/watch-client";

export async function generateMetadata({ params }: PageProps<"/watch/[animeId]/[episodeId]">): Promise<Metadata> {
  const { animeId, episodeId } = await params;
  const found = await resolveSeries(animeId);
  const ep = found?.series.episodes.find((e) => e.id === episodeId);
  const seriesTitle = found?.series.title ?? "Anime";
  const epText = ep ? `Episodio ${ep.number} - ${ep.title}` : `Episodio ${episodeId}`;

  return {
    title: `Ver ${seriesTitle} ${epText} Online Gratis HD · KAZE`,
    description: `Disfruta de ${seriesTitle} ${epText} online gratis en audio Latino y Sub Español en 1080p HD. Streaming rápido y sin publicidad invasiva en KAZE (Orunei).`,
    keywords: [
      `ver ${seriesTitle} capitulo ${episodeId}`,
      `ver ${seriesTitle} episodio ${episodeId}`,
      `${seriesTitle} sub español`,
      `${seriesTitle} latino`,
      "kaze anime",
      "orunei",
      "anime free",
    ],
    openGraph: {
      title: `${seriesTitle} · ${epText} · KAZE (Orunei)`,
      description: `Mira el episodio ${episodeId} de ${seriesTitle} en HD sin anuncios molestos en KAZE.`,
      images: ep?.thumbnail ? [ep.thumbnail] : [],
    },
  };
}

export default async function WatchPage({ params }: PageProps<"/watch/[animeId]/[episodeId]">) {
  const { animeId, episodeId } = await params;
  const found = await resolveSeries(animeId);
  if (found) {
    if (!found.series.episodes.some((e) => e.id === episodeId)) notFound();
    return <WatchClient seriesId={animeId} episodeId={episodeId} />;
  }

  // An AniList id with no licensed playback: explain honestly and point to official sources.
  const id = Number.parseInt(animeId, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== animeId) notFound();
  const media = await getMediaDetail(id);
  if (!media || media.isAdult) notFound();
  const title = media.title.english || media.title.romaji;
  const links = media.externalLinks.filter((l) => l.type === "STREAMING" && !l.isDisabled);
  return (
    <div className="container-k grid min-h-[60dvh] place-items-center py-16">
      <div className="k-card max-w-xl p-8 text-center">
        <p className="k-jp text-6xl text-primary-ink" lang="ja" aria-hidden>
          封
        </p>
        <h1 className="font-display mt-4 text-2xl">{title} isn&apos;t licensed for streaming on KAZE</h1>
        <p className="mt-3 text-sm text-muted">AniList provides this title&apos;s information, not the rights to stream it. Watch episode {episodeId} on an official service:</p>
        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {links.length ? (
            links.map((l) => (
              <li key={l.id}>
                <a className="k-btn k-btn-outline k-btn-sm" href={l.url.replace(/^http:/, "https:")} target="_blank" rel="noopener noreferrer">
                  <Tv className="size-4" aria-hidden /> {l.site}
                </a>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted">No official streaming service is listed on AniList.</li>
          )}
        </ul>
        <div className="mt-6 flex justify-center gap-2">
          <Link href={`/anime/${media.id}`} className="k-btn k-btn-primary k-btn-sm">
            Back to {title}
          </Link>
          <Link href="/watch/open-cinema/1" className="k-btn k-btn-ghost k-btn-sm">
            Try the demo player
          </Link>
        </div>
      </div>
    </div>
  );
}
