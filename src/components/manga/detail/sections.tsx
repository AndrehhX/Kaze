import Link from "next/link";
import type { ReactNode } from "react";
import { Tv } from "lucide-react";
import { creditsOf, mangaTitle, originLabel, type MangaDetail } from "@/lib/anilist/manga-types";
import { genreLabel } from "@/lib/anilist/browse-params";
import { cleanDescription, formatLabel, formatNumber } from "@/lib/utils";
import { InkScore, lengthLabel, mangaStatusLabel } from "../cards";

export const RELATION_LABELS: Record<string, string> = {
  ADAPTATION: "Adaptación",
  SOURCE: "Obra original",
  SEQUEL: "Secuela",
  PREQUEL: "Precuela",
  SIDE_STORY: "Historia paralela",
  SPIN_OFF: "Spin-off",
  ALTERNATIVE: "Versión alternativa",
  PARENT: "Obra principal",
  SUMMARY: "Resumen",
  CHARACTER: "Comparte personajes",
  COMPILATION: "Recopilación",
  CONTAINS: "Contiene",
  OTHER: "Otra relación",
};

const fmtDate = (d: { year: number | null; month: number | null; day: number | null }) => (d?.year ? [d.day, d.month, d.year].filter(Boolean).join("/") : null);

export function DetailSection({ id, title, jp, children, aside }: { id: string; title: string; jp?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="container-k mt-14 scroll-mt-28">
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-line pb-3">
        <h2 id={`${id}-h`} className="km-title flex items-baseline gap-3 text-section">
          {title}
          {jp && (
            <span className="k-jp text-sm font-normal normal-case tracking-normal text-muted" lang="ja">
              {jp}
            </span>
          )}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Editorial header: layered banner + screentone, the cover as a printed volume, and the native title set vertically. */
export function MangaDetailHero({ m, actions }: { m: MangaDetail; actions: ReactNode }) {
  const title = mangaTitle(m);
  const { author, artist } = creditsOf({ staff: m.allStaff });
  const desc = cleanDescription(m.description);
  const rankTop = m.rankings.find((r) => r.allTime && r.type === "RATED");
  return (
    <header className="relative isolate overflow-hidden">
      {m.bannerImage && (
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[420px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.bannerImage} alt="" className="size-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/80 to-bg" />
        </div>
      )}
      <div aria-hidden className="km-tone km-tone-fade absolute right-0 top-0 -z-10 h-[520px] w-1/2 opacity-70" />
      <div className="container-k grid gap-10 pb-6 pt-10 md:grid-cols-[minmax(220px,300px)_1fr] lg:gap-14">
        <div className="relative mx-auto w-56 md:mx-0 md:w-full">
          <div className="km-book">
            <div className="k-poster aspect-[2/3] shadow-[0_40px_70px_-30px_rgb(0_0_0_/_0.8)]" style={{ backgroundColor: m.coverImage.color ?? undefined }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.coverImage.extraLarge || m.coverImage.large || ""} alt={`Portada de ${title}`} className="size-full object-cover" fetchPriority="high" />
            </div>
          </div>
          {m.title.native && (
            <p aria-hidden className="k-jp km-vertical absolute -right-10 top-0 hidden max-h-full overflow-hidden text-3xl leading-none text-muted lg:block" lang="ja">
              {m.title.native}
            </p>
          )}
        </div>
        <div className="min-w-0">
          <p className="k-label text-primary-ink">
            {originLabel(m.countryOfOrigin, m.format)} · {mangaStatusLabel(m.status)}
            {m.startDate?.year ? ` · ${m.startDate.year}${m.endDate?.year && m.endDate.year !== m.startDate.year ? `–${m.endDate.year}` : ""}` : ""}
          </p>
          <h1 className="km-title text-balance-k mt-3 text-[clamp(2.2rem,1.2rem+3.6vw,4.6rem)]">{title}</h1>
          {(m.title.romaji && m.title.romaji !== title) || m.title.native ? (
            <p className="mt-2 text-sm text-muted">
              {[m.title.romaji !== title ? m.title.romaji : null, m.title.native].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <p className="mt-4 text-sm">
            {author ? (
              <>
                <span className="text-muted">Historia</span> <Link href={`/manga/discover?author=${encodeURIComponent(author)}`} className="font-semibold hover:text-primary-ink">{author}</Link>
              </>
            ) : (
              <span className="text-muted">Autor no indicado en AniList</span>
            )}
            {artist && artist !== author && (
              <>
                <span className="text-muted"> · Arte</span> <Link href={`/manga/discover?author=${encodeURIComponent(artist)}`} className="font-semibold hover:text-primary-ink">{artist}</Link>
              </>
            )}
          </p>
          <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-y-4 border-y border-line py-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="k-label text-muted">Puntuación</dt>
              <dd className="mt-1">{m.averageScore ? <InkScore score={m.averageScore} className="text-base" /> : "Sin datos"}</dd>
            </div>
            <div>
              <dt className="k-label text-muted">Capítulos</dt>
              <dd className="mt-1 font-semibold">{m.chapters ?? (m.status === "RELEASING" ? "En curso" : "Desconocido")}</dd>
            </div>
            <div>
              <dt className="k-label text-muted">Volúmenes</dt>
              <dd className="mt-1 font-semibold">{m.volumes ?? (m.status === "RELEASING" ? "En curso" : "Desconocido")}</dd>
            </div>
            <div>
              <dt className="k-label text-muted">Lectores</dt>
              <dd className="mt-1 font-semibold">{formatNumber(m.popularity)}</dd>
            </div>
          </dl>
          {rankTop && <p className="mt-3 text-xs text-muted">#{rankTop.rank} mejor valorado de todos los tiempos en AniList</p>}
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {m.genres.map((g) => (
              <li key={g}>
                <Link href={`/manga/discover?genres=${encodeURIComponent(g)}`} className="k-chip">
                  {genreLabel(g)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6">{actions}</div>
          {desc && (
            <div className="mt-8 max-w-3xl">
              <h2 className="k-label text-muted">Sinopsis</h2>
              <p className="mt-2 whitespace-pre-line text-[0.9375rem] leading-relaxed">{desc}</p>
              <p className="mt-2 text-xs text-muted">Sinopsis de AniList (idioma original de la fuente).</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function SectionNavManga({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="Secciones de la ficha" className="k-nav sticky top-[var(--k-nav-h)] z-20 mt-6">
      <ul className="container-k scrollbar-none flex gap-1 overflow-x-auto">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className="k-nav-item">
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Related works with explicit relation types — an adaptation is never confused with a spin-off or sequel. */
export function RelatedWorks({ m }: { m: MangaDetail }) {
  const edges = m.relations.edges.filter((e) => !(e.node as { isAdult?: boolean }).isAdult);
  if (!edges.length) return <p className="text-sm text-muted">AniList no registra obras relacionadas.</p>;
  const order = ["ADAPTATION", "SOURCE", "PREQUEL", "SEQUEL", "PARENT", "SIDE_STORY", "SPIN_OFF", "ALTERNATIVE", "SUMMARY", "COMPILATION", "CONTAINS", "CHARACTER", "OTHER"];
  const sorted = [...edges].sort((a, b) => order.indexOf(a.relationType) - order.indexOf(b.relationType));
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((e) => {
        const n = e.node;
        const isAnime = n.type === "ANIME";
        const href = isAnime ? `/anime/${n.id}` : `/manga/${n.id}`;
        const t = n.title.english || n.title.romaji || "Sin título";
        return (
          <li key={`${e.relationType}-${n.id}`} className="km-frame flex gap-3 p-2.5">
            <Link href={href} className="k-poster relative h-24 w-16 shrink-0" tabIndex={-1} aria-hidden style={{ backgroundColor: n.coverImage.color ?? undefined }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={n.coverImage.large ?? ""} alt="" loading="lazy" className="size-full object-cover" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="k-label text-primary-ink">
                {RELATION_LABELS[e.relationType] ?? e.relationType} · {isAnime ? "Anime" : originLabel(null, n.format)}
              </p>
              <Link href={href} className="clamp-2 mt-1 text-sm font-semibold hover:text-primary-ink">
                {t}
              </Link>
              <p className="text-xs text-muted">{[formatLabel(n.format), (n as { seasonYear?: number | null }).seasonYear ?? n.startDate?.year].filter(Boolean).join(" · ")}</p>
              {isAnime && e.relationType === "ADAPTATION" && (
                <Link href={`/manga/continue/${n.id}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-ink hover:underline">
                  <Tv className="size-3.5" aria-hidden /> ¿Dónde sigo tras este anime?
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MangaCharacters({ m }: { m: MangaDetail }) {
  const edges = m.characters.edges;
  if (!edges.length) return <p className="text-sm text-muted">AniList no registra personajes para esta obra.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {edges.map((c) => (
        <li key={c.node.id}>
          <Link href={`/manga/characters/${c.node.id}`} className="group block">
            <div className="k-poster aspect-[3/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.node.image.large ?? ""} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <p className="mt-2 truncate text-sm font-semibold group-hover:text-primary-ink">{c.node.name.full}</p>
            <p className="text-xs text-muted">{c.role === "MAIN" ? "Protagonista" : c.role === "SUPPORTING" ? "Secundario" : "Fondo"}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MangaStaff({ m }: { m: MangaDetail }) {
  if (!m.allStaff.edges.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {m.allStaff.edges.map((s) => (
        <li key={`${s.node.id}-${s.role}`} className="flex items-center gap-3 border-b border-line py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.node.image.large ? <img src={s.node.image.large} alt="" loading="lazy" className="size-11 rounded-full object-cover" /> : <span className="size-11 rounded-full bg-elevated" />}
          <div className="min-w-0">
            <Link href={`/manga/discover?author=${encodeURIComponent(s.node.name.full)}`} className="block truncate text-sm font-semibold hover:text-primary-ink">
              {s.node.name.full}
            </Link>
            <p className="truncate text-xs text-muted">{s.role}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MangaInfo({ m }: { m: MangaDetail }) {
  const rows: [string, ReactNode][] = [
    ["Formato", originLabel(m.countryOfOrigin, m.format)],
    ["Estado", mangaStatusLabel(m.status)],
    ["Inicio", fmtDate(m.startDate) ?? "—"],
    ["Final", fmtDate(m.endDate) ?? (m.status === "RELEASING" ? "En publicación" : "—")],
    ["Extensión", lengthLabel(m)],
    ["Favoritos", formatNumber(m.favourites)],
    ["Sinónimos", m.synonyms.slice(0, 3).join(" · ") || "—"],
  ];
  return (
    <dl className="km-frame divide-y divide-line text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
      <div className="px-4 py-2.5">
        <a href={m.siteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-ink hover:underline">
          Ver en AniList ↗
        </a>
      </div>
    </dl>
  );
}

export function AniListMangaReviews({ m }: { m: MangaDetail }) {
  if (!m.reviews.nodes.length) return null;
  return (
    <div className="mt-6">
      <h3 className="k-label mb-3 text-muted">Reseñas destacadas en AniList</h3>
      <ul className="grid gap-3 md:grid-cols-3">
        {m.reviews.nodes.map((r) => (
          <li key={r.id} className="km-frame p-4 text-sm">
            <p className="clamp-3">{r.summary}</p>
            <p className="mt-2 text-xs text-muted">
              {r.user.name} · {r.score}/100 ·{" "}
              <a href={r.siteUrl} target="_blank" rel="noopener noreferrer" className="text-primary-ink hover:underline">
                leer en AniList ↗
              </a>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
