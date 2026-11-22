import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { getMediaDetail } from "@/lib/anilist/service";
import { demoProvider } from "@/lib/media/demo-catalog";
import { cleanDescription } from "@/lib/utils";
import { snapshotFromMedia } from "@/lib/library/types";
import {
  AniListReviews,
  Availability,
  CharacterGrid,
  DetailHero,
  DetailSection,
  EpisodesPreview,
  InfoList,
  RecommendationRail,
  RelatedRail,
  ScoreDistribution,
  SectionNav,
  StaffList,
  TagCloud,
  TrailerBlock,
  YourEntry,
} from "@/components/anime/detail";
import { MediaReviews } from "@/components/social/reviews";
import { DiscussionList } from "@/components/social/discussions";
import { FriendsWithTitle } from "@/components/social/friends-with-title";
import { AdBanner } from "@/components/ads/ad-banner";
import { AnimeMangaBridge } from "@/components/manga/anime-bridge";

export function generateStaticParams() {
  return [{ id: "154587" }, { id: "21" }];
}

async function load(idParam: string) {
  const id = Number.parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== idParam) return null;
  const media = await getMediaDetail(id);
  if (!media || media.isAdult) return null;
  return media;
}

export async function generateMetadata({ params }: PageProps<"/anime/[id]">): Promise<Metadata> {
  const media = await load((await params).id);
  if (!media) return { title: "Anime no encontrado · KAZE" };
  const title = media.title.english || media.title.romaji || "Anime";
  const titleJp = media.title.native ? ` (${media.title.native})` : "";
  const cleanDesc = cleanDescription(media.description);
  const snippet = cleanDesc
    ? cleanDesc.slice(0, 160)
    : `Ver ${title} online gratis en audio Latino y Sub Español en HD 1080p en KAZE (Orunei).`;

  return {
    title: `Ver ${title}${titleJp} Online Gratis HD · KAZE`,
    description: snippet,
    alternates: { canonical: `/anime/${media.id}` },
    keywords: [
      `ver ${title}`,
      `ver ${title} gratis`,
      `ver ${title} online`,
      `${title} sub español`,
      `${title} audio latino`,
      `${title} 1080p`,
      "kaze anime",
      "orunei",
      "anime free",
    ],
    openGraph: {
      title: `Ver ${title} Online en Español HD 1080p · KAZE`,
      description: snippet,
      // La imagen la genera ./opengraph-image.tsx (tarjeta con portada y marca KAZE).
    },
  };
}

async function CachedAnimeArticle({ id }: { id: number }) {
  "use cache";
  cacheLife("days");
  cacheTag(`page:anime:${id}`);

  const media = await getMediaDetail(id);
  if (!media || media.isAdult) return null;

  const demo = demoProvider.findByAniListId ? await demoProvider.findByAniListId(media.id) : null;
  const title = media.title.english || media.title.romaji || "Anime";
  const playable = demo
    ? { seriesId: demo.id, title: demo.title }
    : { seriesId: String(media.id), title };
  const snapshot = snapshotFromMedia(media);

  return (
    <article>
      <DetailHero media={media} />
      <SectionNav />

      <section id="overview" aria-labelledby="overview-h" className="container-k mt-10 grid scroll-mt-32 gap-6 lg:grid-cols-[1fr_340px]">
        <h2 id="overview-h" className="sr-only">
          Overview
        </h2>
        <div className="space-y-6">
          <TagCloud media={media} />
          <ScoreDistribution media={media} />
        </div>
        <aside className="space-y-4">
          <YourEntry media={media} />
          <InfoList media={media} />
        </aside>
      </section>

      <div className="container-k my-8">
        <AdBanner placement="anime-detail" />
      </div>

      <DetailSection id="episodes" title="Episodes" jp="エピソード">
        <EpisodesPreview media={media} />
      </DetailSection>
      <DetailSection id="characters" title="Characters & Voice Actors" jp="キャラクター">
        <CharacterGrid characters={media.characters.edges} />
      </DetailSection>
      <DetailSection id="staff" title="Staff" jp="スタッフ">
        <StaffList media={media} />
      </DetailSection>
      <DetailSection id="related" title="Related Anime" jp="関連">
        <RelatedRail media={media} />
      </DetailSection>
      <DetailSection id="manga" title="Del anime al manga" jp="原作">
        <AnimeMangaBridge media={media} />
      </DetailSection>
      <DetailSection id="recommendations" title="Fans Also Recommend" jp="おすすめ">
        <RecommendationRail media={media} />
      </DetailSection>
      <DetailSection id="trailer" title="Trailer" jp="予告編">
        <TrailerBlock media={media} />
      </DetailSection>
      <DetailSection id="reviews" title="Reviews" jp="レビュー">
        <MediaReviews mediaId={media.id} snapshot={snapshot} />
        <AniListReviews media={media} />
      </DetailSection>
      <DetailSection id="discussions" title="Discussions" jp="掲示板">
        <DiscussionList mediaId={media.id} snapshot={snapshot} limit={8} />
      </DetailSection>
      <DetailSection id="friends" title="Friends Activity" jp="友達">
        <FriendsWithTitle mediaId={media.id} />
      </DetailSection>
      <DetailSection id="availability" title="Where to Watch" jp="配信">
        <Availability media={media} playable={playable} />
      </DetailSection>
    </article>
  );
}

export default async function AnimePage({ params }: PageProps<"/anime/[id]">) {
  const media = await load((await params).id);
  if (!media) notFound();
  return <CachedAnimeArticle id={media.id} />;
}
