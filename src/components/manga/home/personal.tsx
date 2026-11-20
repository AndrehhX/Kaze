"use client";

import Link from "next/link";
import { BookOpen, Sparkles, Users } from "lucide-react";
import { useMemo } from "react";
import type { MangaCard } from "@/lib/anilist/manga-types";
import { useMangaLibrary, continueReading } from "@/stores/manga";
import { useLibrary } from "@/stores/library";
import { buildTaste, recommendManga } from "@/lib/manga/recommend";
import { SafeImage, SectionHeader } from "@/components/ui/primitives";
import { Rail } from "@/components/ui/rail";
import { MangaCardView } from "../cards";
import { useFriendActivity } from "@/components/social/friends-activity";
import { useAuth } from "@/stores/auth";
import { DEMO_SERIES } from "@/lib/manga/demo/series";
import { sortChapters } from "@/lib/manga/catalog";
import { mangaHref } from "@/lib/manga/types";
import { progressKey } from "@/stores/manga";
import { useNow } from "@/lib/hooks";
import { relativeTime } from "@/lib/utils";

export function ContinueReadingRail() {
  const entries = useMangaLibrary((s) => s.entries);
  const progress = useMangaLibrary((s) => s.chapterProgress);
  const hydrated = useMangaLibrary((s) => s.hydrated);
  const items = useMemo(() => continueReading(entries), [entries]);
  if (!hydrated || !items.length) return null;
  return (
    <section aria-labelledby="mk-continue" className="container-k mt-12">
      <SectionHeader id="mk-continue" title="Continuar leyendo" jp="続きを読む" kicker="Justo donde lo dejaste" />
      <Rail label="Continuar leyendo" itemClassName="w-[78vw] xs:w-[60vw] sm:w-[42vw] md:w-[32vw] lg:w-[25vw] xl:w-[21vw]">
        {items.map((e) => {
          const p = e.lastChapterId ? progress[progressKey(e.mangaId, e.lastChapterId)] : undefined;
          const pct = p ? Math.round(((p.page + 1) / Math.max(1, p.pageCount)) * 100) : null;
          const readable = Boolean(e.media.slug && e.lastChapterId);
          const href = readable ? `/manga/read/${e.media.slug}/${e.lastChapterId}?page=${(e.lastPage ?? 0) + 1}` : mangaHref(e.mangaId, e.media.slug);
          return (
            <Link key={e.mangaId} href={href} className="k-card group flex h-full gap-3 overflow-hidden p-2.5">
              <div className="k-poster relative aspect-[2/3] w-20 shrink-0">
                <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="80px" className="object-cover" fallbackLabel={e.media.title} />
              </div>
              <div className="min-w-0 flex-1 py-1">
                <p className="clamp-2 text-sm font-semibold leading-snug group-hover:text-primary-ink">{e.media.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {e.lastChapterLabel ?? "Capítulo"}
                  {e.lastPage != null ? ` · pág. ${e.lastPage + 1}` : ""}
                </p>
                {pct != null && (
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--k-btn-ghost)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso del capítulo">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-ink">
                  <BookOpen className="size-3.5" aria-hidden /> {readable ? "Reanudar" : "Ver ficha"}
                </p>
              </div>
            </Link>
          );
        })}
      </Rail>
    </section>
  );
}

/** Rule-based recommendations explained in plain language, from the user's anime and manga lists. */
export function BasedOnYourAnime({ pool }: { pool: MangaCard[] }) {
  const anime = useLibrary((s) => s.entries);
  const manga = useMangaLibrary((s) => s.entries);
  const animeHydrated = useLibrary((s) => s.hydrated);
  const mangaHydrated = useMangaLibrary((s) => s.hydrated);
  const hydrated = animeHydrated && mangaHydrated;
  const recs = useMemo(() => {
    const taste = buildTaste(Object.values(anime), Object.values(manga));
    return recommendManga(pool, taste, new Set(Object.keys(manga).map(Number)), 14);
  }, [anime, manga, pool]);
  if (!hydrated) return null;
  if (!recs.length)
    return (
      <section className="container-k mt-14">
        <div className="km-frame flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
          <Sparkles className="size-6 text-primary-ink" aria-hidden />
          <p className="flex-1 text-sm text-muted">Añade anime o manga a tu biblioteca y aquí aparecerán lecturas basadas en tus gustos, con el motivo de cada sugerencia.</p>
          <Link href="/discover" className="k-btn k-btn-outline k-btn-sm">
            Explorar anime
          </Link>
        </div>
      </section>
    );
  return (
    <section aria-labelledby="mk-foryou" className="container-k k-offscreen-section mt-14">
      <SectionHeader id="mk-foryou" title="Basado en tu anime favorito" jp="あなたへ" kicker="Recomendaciones por reglas, con su motivo" />
      <Rail label="Basado en tu anime favorito">
        {recs.map((r) => (
          <div key={r.media.id}>
            <MangaCardView media={r.media} caption={r.reason} />
          </div>
        ))}
      </Rail>
    </section>
  );
}

/** Real friend activity on manga only; hidden entirely when there is none (no placeholder content). */
export function FriendsReading() {
  const signedIn = useAuth((s) => s.status === "signed-in");
  const { data } = useFriendActivity(40);
  const now = useNow();
  const manga = (data ?? []).filter((e) => (e.media_snapshot as { kind?: string })?.kind === "manga" && e.media_id);
  if (!signedIn || !manga.length) return null;
  return (
    <section aria-labelledby="mk-friends" className="container-k mt-14">
      <SectionHeader id="mk-friends" title="Lo que leen tus amigos" jp="友達" kicker="Actividad real de tu círculo" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {manga.slice(0, 9).map((e) => (
          <li key={e.id}>
            <Link href={`/manga/${e.media_id}`} className="k-card flex gap-3 p-2.5">
              <div className="k-poster relative h-20 w-14 shrink-0">
                <SafeImage src={e.media_snapshot?.cover ?? ""} alt="" fill sizes="56px" className="object-cover" />
              </div>
              <div className="min-w-0 text-sm">
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Users className="size-3.5" aria-hidden /> {e.user?.display_name || e.user?.username}
                </p>
                <p className="clamp-2 mt-1 font-semibold">{e.media_snapshot?.title}</p>
                <p className="text-xs text-muted">
                  {e.kind === "completed" ? "Lo terminó" : e.kind === "started" ? "Empezó a leerlo" : e.kind === "rated" ? `Lo puntuó ${e.payload.score}` : "Lo marcó como favorito"}
                  {now ? ` · ${relativeTime(new Date(e.created_at).getTime(), now)}` : ""}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The bundled original demo series, labelled as such (never presented as editorial picks of commercial manga). */
export function KazeOriginalsShelf() {
  return null;
}
