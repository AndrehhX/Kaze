import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookOpen, Tv } from "lucide-react";
import { resolveManga, STATIC_MANGA_PARAMS } from "./load";
import { animeAdaptations, mangaTitle, type MangaDetail } from "@/lib/anilist/manga-types";
import { cleanDescription } from "@/lib/utils";
import { genreLabel } from "@/lib/anilist/browse-params";
import { snapshotFromManga } from "@/lib/manga/types";
import { demoSnapshot, DEMO_LICENSE, type DemoSeries } from "@/lib/manga/demo/series";
import { availabilityFor, seriesKeyFor } from "@/lib/manga/providers";
import { sortChapters } from "@/lib/manga/catalog";
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

export function generateStaticParams() {
  return STATIC_MANGA_PARAMS;
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolveManga((await params).id);
  if (!r) return { title: "Manga no encontrado" };
  if (r.kind === "demo") return { title: `${r.demo.title} (demo KAZE Originals)`, description: r.demo.description.slice(0, 160) };
  const title = mangaTitle(r.media);
  return {
    title: `${title} — manga`,
    description: cleanDescription(r.media.description).slice(0, 160) || `${title} en KAZE: dónde leerlo, volúmenes, adaptaciones al anime y más.`,
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
  return r.kind === "demo" ? <DemoDetail s={r.demo} /> : <AniListDetail m={r.media} />;
}

function AniListDetail({ m }: { m: MangaDetail }) {
  const title = mangaTitle(m);
  const snapshot = snapshotFromManga(m);
  const ref = { id: m.id, snapshot };
  const availability = availabilityFor({ seriesKey: seriesKeyFor(m.id), externalLinks: m.externalLinks });
  const official = availability.find((a) => a.kind === "external");
  const adaptations = animeAdaptations(m);
  const mappings = mappingsForManga(m.id);
  const recs = m.recommendations.nodes.map((n) => n.mediaRecommendation).filter((x): x is NonNullable<typeof x> => Boolean(x && x.type === "MANGA" && !x.isAdult));
  const tags = m.tags.filter((t) => !t.isMediaSpoiler && !t.isGeneralSpoiler).slice(0, 14);
  const reviewSnapshot = { ...snapshot, studio: snapshot.author, episodes: null, duration: null } as unknown as Partial<MediaSnapshot>;

  return (
    <article>
      <MangaDetailHero m={m} actions={<DetailActions manga={ref} readHref={official?.url ?? null} />} />
      <SectionNavManga
        items={[
          { id: "overview", label: "Resumen" },
          { id: "read", label: "Dónde leer" },
          { id: "anime", label: "Anime y continuidad" },
          { id: "related", label: "Relacionados" },
          { id: "characters", label: "Personajes" },
          { id: "recommendations", label: "Recomendaciones" },
          { id: "reviews", label: "Reseñas" },
          { id: "discussions", label: "Debates" },
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

      <DetailSection id="read" title="Dónde leer" jp="読む">
        <AvailabilityList options={availability} mangaTitle={title} />
        <div className="mt-4">
          <NoCatalogNotice chapters={m.chapters} volumes={m.volumes} status={m.status} />
        </div>
      </DetailSection>

      <DetailSection id="anime" title="Anime y continuidad" jp="物語は続く">
        {adaptations.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {adaptations.map((a) => {
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
                      {rec && rec.recommendedStartChapter ? `Tras ${rec.animeLabel.toLowerCase()}: capítulo ${rec.recommendedStartChapter} · ${meta?.label}` : "Punto de continuación aún no verificado"}
                    </p>
                    <Link href={`/manga/continue/${a.id}`} className="k-btn k-btn-outline k-btn-sm mt-3">
                      Continuar la historia
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">AniList no registra ninguna adaptación al anime de esta obra.</p>
        )}
      </DetailSection>

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
      <DetailSection id="reviews" title="Reseñas" jp="レビュー">
        <Suspense fallback={<div className="k-skeleton h-40" />}>
          <MediaReviews mediaId={m.id} snapshot={reviewSnapshot} />
        </Suspense>
        <AniListMangaReviews m={m} />
      </DetailSection>
      <DetailSection id="discussions" title="Debates por capítulo" jp="掲示板">
        <p className="mb-4 text-sm text-muted">Abre un debate con el número de capítulo en el título (p. ej. «Cap. 64») y marca «contiene spoilers» si hablas de lo que viene después: los lectores que van por detrás no lo verán sin aceptarlo.</p>
        <Suspense fallback={<div className="k-skeleton h-40" />}>
          <DiscussionList mediaId={m.id} snapshot={reviewSnapshot} limit={8} />
        </Suspense>
      </DetailSection>
    </article>
  );
}

function DemoDetail({ s }: { s: DemoSeries }) {
  const ref = { id: s.id, snapshot: demoSnapshot(s) };
  const first = sortChapters(s.chapters)[0];
  return (
    <article>
      <header className="relative isolate overflow-hidden">
        <div aria-hidden className="km-tone km-tone-fade absolute inset-0 -z-10 opacity-60" />
        <div className="container-k grid gap-10 pb-6 pt-10 md:grid-cols-[minmax(220px,300px)_1fr]">
          <div className="km-book mx-auto w-56 md:w-full">
            <div className="k-poster aspect-[2/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.cover} alt={`Portada de ${s.title}`} className="size-full object-cover" />
            </div>
          </div>
          <div>
            <p className="k-label text-primary-ink">KAZE Originals · obra de demostración</p>
            <h1 className="km-title mt-3 text-[clamp(2.2rem,1.2rem+3.6vw,4.6rem)]">{s.title}</h1>
            <p className="k-jp mt-2 text-muted" lang="ja">
              {s.titleNative}
            </p>
            <p className="mt-4 text-sm">
              <span className="text-muted">Creada por</span> <span className="font-semibold">{s.author}</span> ·{" "}
              {s.readingDirection === "rtl" ? "Se lee de derecha a izquierda" : s.readingDirection === "vertical" ? "Webtoon de lectura vertical" : "Se lee de izquierda a derecha"}
            </p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {s.genres.map((g) => (
                <li key={g} className="k-chip">
                  {genreLabel(g)}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <DetailActions manga={ref} firstChapterHref={`/manga/read/${s.slug}/${first.id}`} />
            </div>
            <p className="mt-8 max-w-3xl text-[0.9375rem] leading-relaxed">{s.description}</p>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted">
              <BookOpen className="size-4" aria-hidden /> {DEMO_LICENSE}
            </p>
          </div>
        </div>
      </header>
      <DetailSection id="chapters" title="Capítulos" jp="目次">
        <ChapterCatalog mangaId={s.id} slug={s.slug} chapters={s.chapters} volumes={s.volumes} tab="chapters" />
      </DetailSection>
      <section className="container-k mt-10">
        <div className="max-w-sm">
          <YourMangaEntry manga={ref} />
        </div>
      </section>
    </article>
  );
}
