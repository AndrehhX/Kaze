import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAnimeSource, getMangaDetail } from "@/lib/anilist/manga-service";
import { mangaTitle } from "@/lib/anilist/manga-types";
import { lookupContinuity } from "@/lib/manga/continuity/engine";
import { availabilityFor, seriesKeyFor } from "@/lib/manga/providers";
import { snapshotFromManga } from "@/lib/manga/types";
import { RELATION_LABELS } from "@/components/manga/detail/sections";
import { ContinuityView, type ContinuityManga } from "@/components/manga/continuity/continuity-view";

type Props = { params: Promise<{ animeId: string }> };

export function generateStaticParams() {
  return [{ animeId: "113415" }, { animeId: "154587" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number.parseInt((await params).animeId, 10);
  const a = Number.isInteger(id) && id > 0 ? await getAnimeSource(id).catch(() => null) : null;
  const t = a?.title.english || a?.title.romaji;
  return { title: t ? `Continuar ${t} en el manga` : "Continuar la historia", description: t ? `¿En qué capítulo del manga seguir después de ver ${t}? Punto de continuación con fuentes y nivel de verificación.` : undefined };
}

export default function ContinuePage({ params }: Props) {
  return (
    <Suspense fallback={<div className="container-k mt-10 k-skeleton h-[70vh]" aria-busy="true" />}>
      <ContinueContent params={params} />
    </Suspense>
  );
}

async function ContinueContent({ params }: Props) {
  const raw = (await params).animeId;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) notFound();
  const anime = await getAnimeSource(id);
  if (!anime) notFound();

  const lookup = lookupContinuity(id);
  const relations = anime.relations.edges.filter((e) => e.node.type === "MANGA" && !e.node.isAdult);
  // Primary manga: the one the verified dataset names, else AniList's SOURCE relation. Never guessed from titles.
  const mappedId = lookup.status === "found" ? lookup.current[0].mangaId : null;
  const primaryEdge = relations.find((e) => e.node.id === mappedId) ?? relations.find((e) => e.relationType === "SOURCE" && e.node.format !== "NOVEL") ?? relations.find((e) => e.relationType === "SOURCE");
  const detail = primaryEdge ? await getMangaDetail(primaryEdge.node.id).catch(() => null) : mappedId ? await getMangaDetail(mappedId).catch(() => null) : null;

  const toManga = (m: (typeof relations)[number]["node"], relation: string): ContinuityManga => ({ id: m.id, title: mangaTitle(m), cover: m.coverImage.large, chapters: m.chapters, volumes: m.volumes, status: m.status, snapshot: snapshotFromManga(m), relation });
  const manga = detail ? { id: detail.id, title: mangaTitle(detail), cover: detail.coverImage.extraLarge || detail.coverImage.large, chapters: detail.chapters, volumes: detail.volumes, status: detail.status, snapshot: snapshotFromManga(detail), relation: RELATION_LABELS.SOURCE } : null;
  const related = relations.filter((e) => e.node.id !== manga?.id).map((e) => toManga(e.node, RELATION_LABELS[e.relationType] ?? e.relationType));

  return (
    <ContinuityView
      anime={{ id: anime.id, title: anime.title.english || anime.title.romaji || "Anime", cover: anime.coverImage.large, color: anime.coverImage.color, episodes: anime.episodes, format: anime.format, year: anime.seasonYear }}
      timeline={lookup.status === "found" ? lookup.timeline : []}
      currentIds={lookup.status === "found" ? lookup.current.map((c) => c.id) : []}
      manga={manga}
      relatedManga={related}
      availability={detail ? availabilityFor({ seriesKey: seriesKeyFor(detail.id), externalLinks: detail.externalLinks }) : []}
    />
  );
}
