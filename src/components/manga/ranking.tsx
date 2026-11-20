import Link from "next/link";
import { creditsOf, mangaTitle, originLabel, type MangaCard } from "@/lib/anilist/manga-types";
import { genreLabel } from "@/lib/anilist/browse-params";
import { mangaHref } from "@/lib/manga/types";
import { InkScore } from "./cards";
import { lengthLabel, mangaStatusLabel } from "@/lib/manga/format";

/** Editorial ranked list: big outlined numerals, cover, credits — server-rendered from real AniList data. */
export function MangaRanking({ title, jp, kicker, explanation, media }: { title: string; jp: string; kicker: string; explanation: string; media: MangaCard[] }) {
  return (
    <div className="container-k pb-12 pt-8">
      <header className="relative">
        <span aria-hidden className="k-jp pointer-events-none absolute -top-4 right-0 select-none text-[6rem] leading-none text-fg opacity-[0.05]" lang="ja">
          {jp}
        </span>
        <p className="k-label text-primary-ink">{kicker}</p>
        <h1 className="km-title mt-2 text-title">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{explanation}</p>
      </header>
      <ol className="mt-8 grid gap-x-10 lg:grid-cols-2">
        {media.map((m, i) => {
          const credit = creditsOf(m).author;
          return (
            <li key={m.id} className="flex items-center gap-4 border-b border-line py-4">
              <span className="k-outline-num w-16 shrink-0 text-right text-5xl">{i + 1}</span>
              <Link href={mangaHref(m.id)} className="km-book w-16 shrink-0" tabIndex={-1} aria-hidden>
                <div className="k-poster aspect-[2/3]" style={{ backgroundColor: m.coverImage.color ?? undefined }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.coverImage.large ?? ""} alt="" loading={i < 6 ? "eager" : "lazy"} className="size-full object-cover" />
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={mangaHref(m.id)} className="font-display text-lg leading-tight hover:text-primary-ink">
                  {mangaTitle(m)}
                </Link>
                <p className="truncate text-xs text-muted">{[credit, originLabel(m.countryOfOrigin, m.format), m.startDate?.year].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 text-xs text-muted">
                  {mangaStatusLabel(m.status)} · {lengthLabel(m)} · {m.genres.slice(0, 3).map(genreLabel).join(", ")}
                </p>
              </div>
              <InkScore score={m.averageScore} className="shrink-0" />
            </li>
          );
        })}
      </ol>
      <p className="mt-8 text-xs text-muted">Fuente: AniList. Ninguna posición está editada a mano.</p>
    </div>
  );
}
