"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Play, Quote, Sparkles } from "lucide-react";
import { SafeImage } from "@/components/ui/primitives";
import { genreLabel } from "@/lib/anilist/browse-params";
import type { Achievement, Dna } from "@/lib/dna";
import type { LibraryEntry } from "@/lib/library/types";
import { levelFromXp, levelTier, experience, type Showcase } from "@/lib/profile-custom";
import { formatNumber } from "@/lib/utils";
import type { Profile } from "@/stores/auth";

export type ShowcaseData = {
  entries: LibraryEntry[];
  achievements: Achievement[];
  dna: Dna;
  profile: Profile;
  badgeNode: (a: Achievement) => ReactNode;
};

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-surface/85 p-5 shadow-lg backdrop-blur-md">
      <h2 id={id} className="font-display mb-4 text-section">{title}</h2>
      {children}
    </section>
  );
}

function Featured({ s, d }: { s: Extract<Showcase, { type: "featured" }>; d: ShowcaseData }) {
  const favorites = d.entries.filter((e) => e.favorite);
  const anime = (s.mediaId && d.entries.find((e) => e.mediaId === s.mediaId)) || favorites[0] || null;
  if (!anime) return null;
  return (
    <section aria-label="Anime destacado" className="relative overflow-hidden rounded-2xl border border-line bg-surface/85 p-6 shadow-xl backdrop-blur-md">
      <div className="flex flex-col items-center gap-6 md:flex-row">
        <div className="k-poster relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl shadow-lg">
          <SafeImage src={anime.media.cover ?? ""} alt={anime.media.title} fill sizes="160px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="k-chip !bg-primary/20 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="mr-1 inline size-3" /> Anime destacado
            </span>
            {anime.score != null && <span className="text-xs font-semibold text-accent">★ {anime.score}/100</span>}
          </div>
          <h3 className="font-display truncate text-2xl font-bold text-fg">{anime.media.title}</h3>
          <p className="line-clamp-2 text-sm text-muted">{anime.media.genres?.map(genreLabel).join(" · ") || "Anime favorito"}</p>
          <div className="pt-2">
            <Link href={`/anime/${anime.mediaId}`} className="k-btn k-btn-primary k-btn-sm gap-2">
              <Play className="size-4" /> Ver anime
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Favorites({ d }: { d: ShowcaseData }) {
  const favorites = d.entries.filter((e) => e.favorite);
  return (
    <Card id="sc-fav" title={`Animes favoritos (${favorites.length})`}>
      {favorites.length ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {favorites.slice(0, 12).map((e, i) => (
            <li key={e.mediaId} style={{ rotate: `${((i % 3) - 1) * 1.5}deg` }} className="transition-transform hover:scale-105">
              <Link href={`/anime/${e.mediaId}`} className="k-poster relative block aspect-[2/3] overflow-hidden rounded-lg shadow-md" title={e.media.title}>
                <SafeImage src={e.media.cover ?? ""} alt={e.media.title} fill sizes="140px" className="object-cover" />
              </Link>
              <p className="mt-1 truncate text-center text-xs font-medium">{e.media.title}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-muted">Aún no hay animes en favoritos. Márcalos con el corazón en el catálogo.</p>
      )}
    </Card>
  );
}

function Characters({ d }: { d: ShowcaseData }) {
  const list = d.profile.favorite_characters ?? [];
  if (!list.length) return null;
  return (
    <Card id="sc-chars" title="Personajes favoritos">
      <ul className="flex flex-wrap gap-4">
        {list.slice(0, 12).map((c) => (
          <li key={c.id} className="w-20 text-center">
            <div className="relative mx-auto size-20 overflow-hidden rounded-full bg-elevated shadow-sm ring-2 ring-line">
              {c.image && <SafeImage src={c.image} alt="" fill sizes="80px" className="object-cover" />}
            </div>
            <p className="mt-1.5 truncate text-xs font-medium">{c.name}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Watching({ d }: { d: ShowcaseData }) {
  const watching = d.entries.filter((e) => e.status === "CURRENT").slice(0, 8);
  if (!watching.length) return null;
  return (
    <Card id="sc-watch" title="Viendo ahora">
      <ul className="grid gap-3 sm:grid-cols-2">
        {watching.map((e) => (
          <li key={e.mediaId}>
            <Link href={`/anime/${e.mediaId}`} className="k-card flex items-center gap-3 p-2.5 transition-colors hover:border-primary">
              <div className="k-poster relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded">
                <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="48px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{e.media.title}</p>
                <p className="text-xs text-muted">Episodio {e.progress}/{e.media.episodes ?? "?"}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Stats({ d }: { d: ShowcaseData }) {
  const items: [string, string | number][] = [
    ["Títulos", d.dna.total],
    ["Completados", d.dna.completed],
    ["Episodios", formatNumber(d.dna.episodes)],
    ["Horas", formatNumber(Math.round(d.dna.hours))],
    ["Nota media", d.dna.meanScore ? `${d.dna.meanScore}%` : "—"],
    ["Logros", `${d.achievements.filter((a) => a.earned).length}/${d.achievements.length}`],
  ];
  return (
    <Card id="sc-stats" title="Estadísticas">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-bg/50 p-3">
            <dt className="k-label text-muted">{k}</dt>
            <dd className="font-display mt-1 text-2xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Genres({ d }: { d: ShowcaseData }) {
  const top = d.dna.genres.slice(0, 6);
  if (!top.length) return null;
  const max = top[0].count;
  return (
    <Card id="sc-genres" title="Mis géneros">
      <ul className="space-y-2.5">
        {top.map((g) => (
          <li key={g.name}>
            <div className="flex justify-between text-sm"><span>{genreLabel(g.name)}</span><span className="text-muted">{g.count}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-fg/10">
              <div className="h-full rounded-full [background:linear-gradient(90deg,var(--k-primary),var(--k-accent))]" style={{ width: `${(g.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Badges({ s, d }: { s: Extract<Showcase, { type: "badges" }>; d: ShowcaseData }) {
  const chosen = s.ids.map((id) => d.achievements.find((a) => a.id === id)).filter((a): a is Achievement => Boolean(a));
  const list = chosen.length ? chosen : d.achievements.filter((a) => a.earned).slice(0, 6);
  if (!list.length) return null;
  return (
    <Card id="sc-badges" title="Insignias destacadas">
      <ul className="grid gap-2 sm:grid-cols-2">{list.map((a) => <Fragment key={a.id}>{d.badgeNode(a)}</Fragment>)}</ul>
    </Card>
  );
}

function TextBlock({ s, index }: { s: Extract<Showcase, { type: "text" }>; index: number }) {
  if (!s.title.trim() && !s.body.trim()) return null;
  return (
    <section aria-label={s.title || "Texto"} className="relative overflow-hidden rounded-2xl border border-line bg-surface/85 p-6 shadow-lg backdrop-blur-md">
      <Quote aria-hidden className="absolute right-4 top-4 size-10 text-primary/20" />
      {s.title.trim() && <h2 id={`sc-text-${index}`} className="font-display text-xl">{s.title}</h2>}
      {s.body.trim() && <p className="mt-2 whitespace-pre-line break-words text-fg/90">{s.body}</p>}
    </section>
  );
}

export function ShowcaseList({ showcases, d }: { showcases: Showcase[]; d: ShowcaseData }) {
  return (
    <>
      {showcases.map((s, i) => {
        const key = `${s.type}-${i}`;
        switch (s.type) {
          case "featured":
            return <Featured key={key} s={s} d={d} />;
          case "favorites":
            return <Favorites key={key} d={d} />;
          case "characters":
            return <Characters key={key} d={d} />;
          case "watching":
            return <Watching key={key} d={d} />;
          case "stats":
            return <Stats key={key} d={d} />;
          case "genres":
            return <Genres key={key} d={d} />;
          case "badges":
            return <Badges key={key} s={s} d={d} />;
          case "text":
            return <TextBlock key={key} s={s} index={i} />;
        }
      })}
    </>
  );
}

/** Nivel estilo Steam: número dentro de un anillo cuyo color cambia cada 10 niveles. */
export function LevelCard({ d }: { d: Pick<ShowcaseData, "dna" | "achievements" | "entries"> }) {
  const xp = experience({
    episodes: d.dna.episodes,
    completed: d.dna.completed,
    achievements: d.achievements.filter((a) => a.earned).length,
    favorites: d.entries.filter((e) => e.favorite).length,
  });
  const l = levelFromXp(xp);
  const color = levelTier(l.level);
  return (
    <section aria-label={`Nivel ${l.level}`} className="rounded-2xl border border-line bg-surface/85 p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-4">
        <span className="font-display grid size-14 shrink-0 place-items-center rounded-full text-xl font-bold" style={{ boxShadow: `inset 0 0 0 3px ${color}`, color }}>
          {l.level}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg">Nivel {l.level}</p>
          <p className="text-xs text-muted">{formatNumber(l.xp)} XP · faltan {formatNumber(Math.max(0, l.next - l.xp))} para el {l.level + 1}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full" style={{ width: `${Math.round(l.progress * 100)}%`, background: color }} />
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted">Sube viendo episodios, completando animes, ganando logros y marcando favoritos.</p>
    </section>
  );
}
