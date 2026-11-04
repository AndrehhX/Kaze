import { Suspense } from "react";
import { getHomeData } from "@/lib/anilist/service";
import { HeroCarousel, HeroSkeleton } from "@/components/home/hero-carousel";
import {
  CalendarHint,
  CommunityFavorites,
  HiddenGemsSection,
  OpenCinemaBanner,
  RailSection,
  RecentlyReleased,
  SeasonBento,
  StatCredit,
  TopRatedEditorial,
  UpcomingSection,
} from "@/components/home/sections";
import { BecauseYouLoved, ContinueWatching, FavoriteGenres, FriendsAreWatching, LibraryNudge, RecommendedForYou } from "@/components/home/personal";
import { RailSkeleton } from "@/components/anime/skeletons";
import { SEASONS } from "@/lib/anilist/browse-params";
import { AdBanner } from "@/components/ads/ad-banner";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const d = await getHomeData();
  const seen = new Set<number>();
  const hero = [...d.trending, ...d.season].filter((m) => m.bannerImage && !seen.has(m.id) && seen.add(m.id)).slice(0, 6);
  const seasonLabel = `${SEASONS.find((s) => s.value === d.seasonInfo.season)?.label} ${d.seasonInfo.year}`;
  const pool = [...d.trending, ...d.season, ...d.top, ...d.gems, ...d.favourites];
  const firstBanner = hero[0]?.bannerImage;

  return (
    <>
      {firstBanner && (
        <link
          rel="preload"
          as="image"
          href={firstBanner}
          fetchPriority="high"
        />
      )}
      <HeroCarousel items={hero} kickerPrefix={seasonLabel} trendingIds={d.trending.map((t) => t.id)} />
      <ContinueWatching />
      <LibraryNudge />
      <RailSection id="trending-h" title="Tendencias del momento" jp="急上昇" kicker="Ahora mismo en AniList" media={d.trending} ranked href="/discover?sort=TRENDING_DESC" />
      <SeasonBento media={d.season} season={d.seasonInfo.season} year={d.seasonInfo.year} />
      <RecommendedForYou pool={pool} />
      <RecentlyReleased items={d.recent} />
      <TopRatedEditorial media={d.top} />
      <HiddenGemsSection media={d.gems} />

      <UpcomingSection media={d.upcoming} />
      <FavoriteGenres />
      <FriendsAreWatching />
      <BecauseYouLoved />
      <CommunityFavorites media={d.favourites} />
      <CalendarHint />
      <div className="container-k mt-12 mb-4">
        <AdBanner placement="home-bottom" />
      </div>
      <StatCredit />
    </>
  );
}

function HomeSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <RailSkeleton />
      <RailSkeleton />
    </>
  );
}
