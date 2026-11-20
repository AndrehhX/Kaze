import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMangaCharacter } from "@/lib/anilist/manga-service";
import { mangaTitle, originLabel } from "@/lib/anilist/manga-types";
import { cleanDescription } from "@/lib/utils";
import { Spoiler } from "@/components/social/spoiler";

type Props = { params: Promise<{ id: string }> };

async function load(raw: string) {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) return null;
  return getMangaCharacter(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).id).catch(() => null);
  return { title: c ? `${c.name.full} — personaje` : "Personaje" };
}

export default function CharacterPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="container-k mt-10 k-skeleton h-96" />}>
      <CharacterContent params={params} />
    </Suspense>
  );
}

async function CharacterContent({ params }: Props) {
  const c = await load((await params).id);
  if (!c) notFound();
  // AniList marks spoilers with ~!…!~; we hide that text behind an explicit reveal instead of deleting it.
  const raw = c.description ?? "";
  const spoiler = [...raw.matchAll(/~!([\s\S]*?)!~/g)].map((m) => cleanDescription(m[1])).filter(Boolean).join("\n\n");
  const safe = cleanDescription(raw);
  const manga = c.media.edges.filter((e) => e.node.type === "MANGA" && !e.node.isAdult);
  const anime = c.media.edges.filter((e) => e.node.type === "ANIME" && !e.node.isAdult);
  return (
    <div className="container-k pb-16 pt-10">
      <div className="grid gap-10 md:grid-cols-[260px_1fr]">
        <div className="k-poster aspect-[3/4] w-full max-w-[260px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.image.large && <img src={c.image.large} alt={c.name.full} className="size-full object-cover" />}
        </div>
        <div>
          <p className="k-label text-primary-ink">Personaje · キャラクター</p>
          <h1 className="km-title mt-2 text-title">{c.name.full}</h1>
          {c.name.native && <p className="k-jp mt-1 text-muted" lang="ja">{c.name.native}</p>}
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {c.gender && (
              <div>
                <dt className="inline text-muted">Género: </dt>
                <dd className="inline">{c.gender}</dd>
              </div>
            )}
            {c.age && (
              <div>
                <dt className="inline text-muted">Edad: </dt>
                <dd className="inline">{c.age}</dd>
              </div>
            )}
          </dl>
          {safe && <p className="mt-5 max-w-3xl whitespace-pre-line text-[0.9375rem] leading-relaxed">{safe}</p>}
          {spoiler && (
            <div className="mt-4 max-w-3xl">
              <Spoiler active>
                <p className="whitespace-pre-line text-sm">{spoiler}</p>
              </Spoiler>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">Descripción de AniList (idioma original de la fuente).</p>
        </div>
      </div>
      {[
        { title: "Aparece en manga", list: manga, href: (id: number) => `/manga/${id}` },
        { title: "Aparece en anime", list: anime, href: (id: number) => `/anime/${id}` },
      ].map((g) =>
        g.list.length ? (
          <section key={g.title} className="mt-12">
            <h2 className="km-title mb-4 border-b border-line pb-3 text-section">{g.title}</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
              {g.list.map((e) => (
                <li key={e.node.id}>
                  <Link href={g.href(e.node.id)} className="group block">
                    <div className="k-poster aspect-[2/3]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.node.coverImage.large ?? ""} alt="" loading="lazy" className="size-full object-cover" />
                    </div>
                    <p className="clamp-2 mt-2 text-sm font-semibold group-hover:text-primary-ink">{mangaTitle(e.node)}</p>
                    <p className="text-xs text-muted">{e.characterRole === "MAIN" ? "Protagonista" : e.characterRole === "SUPPORTING" ? "Secundario" : "Aparición"} · {e.node.type === "MANGA" ? originLabel(e.node.countryOfOrigin, e.node.format) : "Anime"}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
