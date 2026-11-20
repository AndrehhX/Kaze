import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { resolveManga } from "./load";
import { mangaTitle } from "@/lib/anilist/manga-types";
import { availabilityFor, catalogFor, seriesKeyFor } from "@/lib/manga/providers";
import { ChapterCatalog, NoCatalogNotice } from "@/components/manga/detail/chapters";
import { AvailabilityList } from "@/components/manga/detail/interactive";

export async function CatalogPage({ param, tab }: { param: string; tab: "chapters" | "volumes" }) {
  const r = await resolveManga(param);
  if (!r) notFound();
  const title = r.kind === "demo" ? r.demo.title : mangaTitle(r.media);
  const back = r.kind === "demo" ? `/manga/${r.demo.slug}` : `/manga/${r.media.id}`;
  const seriesKey = r.kind === "demo" ? seriesKeyFor(r.demo.slug) : seriesKeyFor(r.media.id);
  const catalog = catalogFor(seriesKey);
  const chapters = r.kind === "demo" ? r.demo.chapters : (catalog ? await catalog.listChapters(seriesKey) : []);
  const volumes = r.kind === "demo" ? r.demo.volumes : (catalog ? await catalog.listVolumes(seriesKey) : []);
  const mangaId = r.kind === "demo" ? r.demo.id : r.media.id;
  const slug = r.kind === "demo" ? r.demo.slug : String(r.media.id);

  return (
    <div className="container-k pb-12 pt-8">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden /> {title}
      </Link>
      <h1 className="km-title mt-3 text-title">{tab === "chapters" ? "Capítulos" : "Volúmenes"}</h1>
      <div className="mt-8">
        {chapters.length > 0 ? (
          <ChapterCatalog mangaId={mangaId} slug={slug} chapters={chapters} volumes={volumes} tab={tab} />
        ) : (
          <div className="space-y-6">
            <NoCatalogNotice chapters={r.kind === "anilist" ? r.media.chapters : null} volumes={r.kind === "anilist" ? r.media.volumes : null} status={r.kind === "anilist" ? r.media.status : null} />
            <div>
              <h2 className="k-label mb-3 text-muted">Dónde leer</h2>
              <AvailabilityList options={availabilityFor({ seriesKey, externalLinks: r.kind === "anilist" ? r.media.externalLinks : undefined })} mangaTitle={title} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
