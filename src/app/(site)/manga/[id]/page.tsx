import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookOpen, Tv } from "lucide-react";
import { resolveManga } from "./load";
import { animeAdaptations, mangaTitle, type MangaDetail } from "@/lib/anilist/manga-types";
import { cleanDescription } from "@/lib/utils";
import { genreLabel } from "@/lib/anilist/browse-params";
import { snapshotFromManga } from "@/lib/manga/types";
import { demoSnapshot, DEMO_LICENSE, type DemoSeries } from "@/lib/manga/demo/series";
import { availabilityFor, catalogFor, seriesKeyFor } from "@/lib/manga/providers";
import { sortChapters, type MangaChapter, type MangaVolume } from "@/lib/manga/catalog";
import { mappingsForManga } from "@/lib/manga/continuity/engine";
import { VERIFICATION_META } from "@/lib/manga/continuity/types";
import type { MediaSnapshot } from "@/lib/library/types";
import { AniListMangaReviews, DetailSection, MangaCharacters, MangaDetailHero, MangaInfo, MangaStaff, RelatedWorks, SectionNavManga } from "@/components/manga/detail/sections";
import { AvailabilityList, DetailActions, YourMangaEntry } from "@/components/manga/detail/interactive";
import { ChapterCatalog, NoCatalogNotice } from "@/components/manga/detail/chapters";
import { MangaCardView } from "@/components/manga/cards";
import { Rail } from "@/components/ui/rail";
import { MediaReviews } from "@/components/social/reviews";
import { DiscussionList } from "@/components/social/discussions";


type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolveManga((await params).id);
  if (!r) return { title: "Manga no encontrado" };
  const title = mangaTitle(r.media);
  return {
    title: `${title} — manga`,
    description: cleanDescription(r.media.description).slice(0, 160) || `${title} en KAZE: capítulos, volúmenes, adaptaciones al anime y más.`,
    openGraph: { title: `${title} · KAZE Manga`, images: r.media.coverImage.extraLarge ? [r.media.coverImage.extraLarge] : [] },
  };
}

export default function MangaDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <MangaDetailContent params={params} />
    </Suspense>
  );
}

function DetailSkeleton() {
  return (
    <div className="container-k grid gap-10 pt-10 md:grid-cols-[300px_1fr]" aria-busy="true">
      <div className="k-skeleton aspect-[2/3] w-full" />
      <div className="space-y-4">
        <div className="k-skeleton h-4 w-40" />
        <div className="k-skeleton h-16 w-3/4" />
        <div className="k-skeleton h-4 w-1/2" />
        <div className="k-skeleton h-24 w-full" />
      </div>
    </div>
  );
}

async function MangaDetailContent({ params }: Props) {
  const r = await resolveManga((await params).id);
  if (!r) notFound();
  const seriesKey = seriesKeyFor(r.media.id);
  const catalog = catalogFor(seriesKey);
  const chapters = catalog ? await catalog.listChapters(seriesKey) : [];
  const volumes = catalog ? await catalog.listVolumes(seriesKey) : [];
  return <AniListDetail m={r.media} chapters={chapters} volumes={volumes} />;
}

function AniListDetail({ m, chapters = [], volumes = [] }: { m: MangaDetail; chapters?: MangaChapter[]; volumes?: MangaVolume[] }) {
  const title = mangaTitle(m);
  const snapshot = snapshotFromManga(m);
  const ref = { id: m.id, snapshot };
  const firstChapter = chapters[0];
  const readHref = firstChapter ? `/manga/read/${m.id}/${firstChapter.id}` : `#chapters`;
  const adaptations = animeAdaptations(m);
  const mappings = mappingsForManga(m.id);
  const recs = m.recommendations.nodes.map((n) => n.mediaRecommendation).filter((x): x is NonNullable<typeof x> => Boolean(x && x.type === "MANGA" && !x.isAdult));
  const tags = m.tags.filter((t) => !t.isMediaSpoiler && !t.isGeneralSpoiler).slice(0, 14);
  const reviewSnapshot = { ...snapshot, studio: snapshot.author, episodes: null, duration: null } as unknown as Partial<MediaSnapshot>;

  return (
    <article>
      <MangaDetailHero m={m} actions={<DetailActions manga={ref} firstChapterHref={readHref} />} />
      <SectionNavManga
        items={[
          { id: "overview", label: "Resumen" },
          { id: "chapters", label: "Capítulos" },
          ...(adaptations.length > 0 ? [{ id: "anime", label: "Continuidad" }] : []),
          { id: "related", label: "Relacionados" },
          { id: "characters", label: "Personajes" },
          ...(recs.length > 0 ? [{ id: "recommendations", label: "Recomendaciones" }] : []),
        ]}
      />
      <section id="overview" aria-label="Resumen" className="container-k mt-10 grid scroll-mt-28 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {tags.length > 0 && (
            <div>
              <h2 className="k-label mb-2 text-muted">Etiquetas (sin spoilers)</h2>
              <ul className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <li key={t.id}>
                    <Link href={`/manga/discover?tags=${encodeURIComponent(t.name)}`} className="k-chip" title={`Relevancia ${t.rank}%`}>
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h2 className="k-label mb-2 text-muted">Staff</h2>
            <MangaStaff m={m} />
          </div>
        </div>
        <aside className="space-y-4">
          <YourMangaEntry manga={ref} />
          <MangaInfo m={m} />
        </aside>
      </section>

      <DetailSection id="chapters" title="Capítulos" jp="章">
        {chapters.length > 0 ? (
          <ChapterCatalog mangaId={m.id} slug={String(m.id)} chapters={chapters} volumes={volumes} tab="chapters" />
        ) : (
          <NoCatalogNotice chapters={m.chapters} volumes={m.volumes} status={m.status} />
        )}
      </DetailSection>

      {adaptations.length > 0 && (
        <DetailSection id="anime" title="Anime y continuidad" jp="物語は続く">
          <ul className="grid gap-3 md:grid-cols-2">
            {adaptations
              .filter((a) => {
                const titleLower = (a.title.english || a.title.romaji || "").toLowerCase();
                return !titleLower.includes(" pv") && !titleLower.endsWith(" pv");
              })
              .slice(0, 4)
              .map((a) => {
                const rec = mappings.find((x) => x.animeId === a.id);
                const meta = rec ? VERIFICATION_META[rec.verificationStatus] : null;
                return (
                  <li key={a.id} className="km-frame flex items-start gap-3 p-4">
                    <Tv className="mt-0.5 size-5 shrink-0 text-primary-ink" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href={`/anime/${a.id}`} className="font-semibold hover:text-primary-ink">
                        {a.title.english || a.title.romaji}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        {rec && rec.recommendedStartChapter ? `Tras ${rec.animeLabel.toLowerCase()}: capítulo ${rec.recommendedStartChapter} · ${meta?.label}` : "Continuación tras el anime"}
                      </p>
                      <Link href={`/manga/continue/${a.id}`} className="k-btn k-btn-outline k-btn-sm mt-3">
                        Continuar la historia
                      </Link>
                    </div>
                  </li>
                );
              })}
          </ul>
        </DetailSection>
      )}

      <DetailSection id="related" title="Obras relacionadas" jp="関連">
        <RelatedWorks m={m} />
      </DetailSection>
      <DetailSection id="characters" title="Personajes" jp="キャラクター">
        <MangaCharacters m={m} />
      </DetailSection>
      {recs.length > 0 && (
        <DetailSection id="recommendations" title="Los lectores también recomiendan" jp="おすすめ">
          <Rail label="Recomendaciones">
            {recs.map((r) => (
              <MangaCardView key={r.id} media={r} />
            ))}
          </Rail>
          <p className="mt-2 text-xs text-muted">Recomendaciones votadas por usuarios de AniList.</p>
        </DetailSection>
      )}
    </article>
  );
}


