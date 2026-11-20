import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { MediaDetail } from "@/lib/anilist/types";
import { lookupContinuity, presentRecommendation, strongest } from "@/lib/manga/continuity/engine";
import { VERIFICATION_META } from "@/lib/manga/continuity/types";
import { RELATION_LABELS } from "./detail/sections";

/**
 * Anime → manga bridge on anime pages. Uses AniList relation types verbatim, so the original manga ("Obra original")
 * is never confused with a spin-off or an alternative version.
 */
export function AnimeMangaBridge({ media }: { media: MediaDetail }) {
  const manga = media.relations.edges.filter((e) => e.node.type === "MANGA" && !e.node.isAdult);
  if (!manga.length) return <p className="text-sm text-muted">AniList no registra manga relacionado con este anime.</p>;
  const lookup = lookupContinuity(media.id);
  const headline = lookup.status === "found" ? presentRecommendation(strongest(lookup.current)) : presentRecommendation(null);
  const order = ["SOURCE", "PREQUEL", "SEQUEL", "SIDE_STORY", "SPIN_OFF", "ALTERNATIVE", "ADAPTATION", "OTHER"];
  const sorted = [...manga].sort((a, b) => order.indexOf(a.relationType) - order.indexOf(b.relationType));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="km-frame km-stage relative overflow-hidden p-6">
        <div aria-hidden className="km-tone km-tone-fade absolute inset-0 opacity-50" />
        <div className="relative">
          <p className="k-label text-primary-ink">物語は続く · Continuar la historia</p>
          <p className="km-title mt-3 text-2xl">{headline.headline}</p>
          {headline.kind === "recommendation" && (
            <p className="mt-2 text-sm text-muted">
              {headline.volume ? `Volumen ${headline.volume} · ` : ""}
              {VERIFICATION_META[headline.status].label}
            </p>
          )}
          <Link href={`/manga/continue/${media.id}`} className="k-btn k-btn-primary mt-5">
            <BookOpen className="size-4" aria-hidden /> Ver la continuidad paso a paso
          </Link>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sorted.map((e) => (
          <li key={e.node.id} className="km-frame flex gap-3 p-2.5">
            <Link href={`/manga/${e.node.id}`} className="k-poster relative h-24 w-16 shrink-0" tabIndex={-1} aria-hidden style={{ backgroundColor: e.node.coverImage.color ?? undefined }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.node.coverImage.large ?? ""} alt="" loading="lazy" className="size-full object-cover" />
            </Link>
            <div className="min-w-0">
              <p className="k-label text-primary-ink">{RELATION_LABELS[e.relationType] ?? e.relationType}</p>
              <Link href={`/manga/${e.node.id}`} className="clamp-2 mt-1 text-sm font-semibold hover:text-primary-ink">
                {e.node.title.english || e.node.title.romaji}
              </Link>
              <p className="text-xs text-muted">{e.node.format === "NOVEL" ? "Novela ligera" : e.node.format === "ONE_SHOT" ? "One-shot" : "Manga"}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
