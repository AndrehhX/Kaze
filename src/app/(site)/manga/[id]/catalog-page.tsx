import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { resolveManga } from "./load";
import { mangaTitle } from "@/lib/anilist/manga-types";
import { availabilityFor, seriesKeyFor } from "@/lib/manga/providers";
import { ChapterCatalog, NoCatalogNotice } from "@/components/manga/detail/chapters";
import { AvailabilityList } from "@/components/manga/detail/interactive";

export async function CatalogPage({ param, tab }: { param: string; tab: "chapters" | "volumes" }) {
  const r = await resolveManga(param);
  if (!r) notFound();
  const title = r.kind === "demo" ? r.demo.title : mangaTitle(r.media);
  const back = r.kind === "demo" ? `/manga/${r.demo.slug}` : `/manga/${r.media.id}`;
  return (
    <div className="container-k pb-12 pt-8">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden /> {title}
      </Link>
      <h1 className="km-title mt-3 text-title">{tab === "chapters" ? "Capítulos" : "Volúmenes"}</h1>
      <div className="mt-8">
        {r.kind === "demo" ? (
          <ChapterCatalog mangaId={r.demo.id} slug={r.demo.slug} chapters={r.demo.chapters} volumes={r.demo.volumes} tab={tab} />
        ) : (
          <div className="space-y-6">
            <NoCatalogNotice chapters={r.media.chapters} volumes={r.media.volumes} status={r.media.status} />
            <div>
              <h2 className="k-label mb-3 text-muted">Dónde leer</h2>
              <AvailabilityList options={availabilityFor({ seriesKey: seriesKeyFor(r.media.id), externalLinks: r.media.externalLinks })} mangaTitle={title} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
