"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMangaLibrary } from "@/stores/manga";
import { computeMangaStats } from "@/lib/manga/stats";
import { mangaStatusMeta } from "@/lib/manga/types";
import { genreLabel } from "@/lib/anilist/browse-params";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useNow } from "@/lib/hooks";
import { LibraryKindSwitch } from "./kind-switch";

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="km-frame p-4">
      <p className="k-label text-muted">{label}</p>
      <p className="km-number mt-2 text-4xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Bars({ rows, label }: { rows: { key: string; label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{r.label}</span>
          <span className="h-3 overflow-hidden rounded-[var(--k-radius-chip)] bg-[var(--k-btn-ghost)]">
            <span className="block h-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Reading statistics. "Registrado" = what you logged in your list; "Medido" = what the KAZE reader actually observed. */
export function MangaStatsView() {
  const entries = useMangaLibrary((s) => s.entries);
  const sessions = useMangaLibrary((s) => s.sessions);
  const progress = useMangaLibrary((s) => s.chapterProgress);
  const continued = useMangaLibrary((s) => s.continued);
  const hydrated = useMangaLibrary((s) => s.hydrated);
  const now = useNow();
  const s = useMemo(() => (now ? computeMangaStats(Object.values(entries), sessions, Object.values(progress), continued, now) : null), [continued, entries, now, progress, sessions]);
  if (!hydrated || !s) return <div className="container-k mt-10"><Skeleton className="h-96" /></div>;
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("es", { month: "short", timeZone: "UTC" });
  const maxMonth = Math.max(1, ...s.completionsByMonth.map((m) => m.count));
  return (
    <div className="container-k pb-16 pt-8">
      <LibraryKindSwitch active="manga" />
      <p className="k-label text-primary-ink">統計 · Estadísticas de lectura</p>
      <h1 className="km-title mt-2 text-title">Tu año en manga</h1>
      {!s.totals.titles && !s.measured.sessions ? (
        <EmptyState className="mt-8" jp="統計" title="Aún no hay datos" body="Añade manga a tu biblioteca o lee en el lector de KAZE y tus estadísticas aparecerán aquí." action={<Link href="/manga" className="k-btn k-btn-primary k-btn-sm">Ir a manga</Link>} />
      ) : (
        <>
          <section aria-labelledby="st-list" className="mt-8">
            <h2 id="st-list" className="k-label mb-3 text-muted">Registrado en tu lista</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Títulos" value={s.totals.titles} />
              <Tile label="Completados" value={s.totals.completed} />
              <Tile label="Capítulos leídos" value={s.totals.chaptersLogged} hint="Suma de tu progreso registrado" />
              <Tile label="Volúmenes leídos" value={s.totals.volumesLogged} />
            </div>
          </section>
          <section aria-labelledby="st-measured" className="mt-8">
            <h2 id="st-measured" className="k-label mb-1 text-muted">Medido por el lector de KAZE</h2>
            <p className="mb-3 text-xs text-muted">Solo cuenta el tiempo con la pestaña visible y actividad en el último minuto. No estimamos tiempo a partir de capítulos.</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Tiempo activo" value={s.measured.activeMinutes >= 60 ? `${Math.floor(s.measured.activeMinutes / 60)} h ${s.measured.activeMinutes % 60} min` : `${s.measured.activeMinutes} min`} />
              <Tile label="Páginas vistas" value={s.measured.pagesRead} />
              <Tile label="Racha actual" value={`${s.measured.currentStreak} d`} hint={`Mejor racha: ${s.measured.longestStreak} días`} />
              <Tile label="Continuados desde anime" value={s.continuedFromAnime} hint="Abiertos con «Continuar la historia»" />
            </div>
          </section>
          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <section aria-labelledby="st-genres">
              <h2 id="st-genres" className="km-title mb-4 text-section">Géneros favoritos</h2>
              {s.genres.length ? <Bars label="Géneros" rows={s.genres.map((g) => ({ key: g.genre, label: genreLabel(g.genre), value: g.count }))} /> : <p className="text-sm text-muted">Sin datos.</p>}
            </section>
            <section aria-labelledby="st-authors">
              <h2 id="st-authors" className="km-title mb-4 text-section">Autores más leídos</h2>
              {s.authors.length ? <Bars label="Autores" rows={s.authors.map((a) => ({ key: a.author, label: a.author, value: a.count }))} /> : <p className="text-sm text-muted">Sin datos de autoría.</p>}
            </section>
            <section aria-labelledby="st-status">
              <h2 id="st-status" className="km-title mb-4 text-section">Distribución</h2>
              <Bars label="Estados" rows={s.statuses.map((x) => ({ key: x.status, label: mangaStatusMeta(x.status as never).label, value: x.count }))} />
              {s.meanScore != null && <p className="mt-4 text-sm text-muted">Tu puntuación media: <span className="font-semibold text-fg">{s.meanScore / 10}/10</span></p>}
            </section>
            <section aria-labelledby="st-months">
              <h2 id="st-months" className="km-title mb-4 text-section">Completados por mes</h2>
              <div className="flex h-40 items-end gap-1.5" role="img" aria-label={`Completados en los últimos 12 meses: ${s.completionsByMonth.map((m) => `${monthLabel(m.month)} ${m.count}`).join(", ")}`}>
                {s.completionsByMonth.map((m) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t-[min(var(--k-radius-btn),6px)] bg-primary/80" style={{ height: `${(m.count / maxMonth) * 100}%`, minHeight: m.count ? 4 : 1 }} />
                    <span className="text-[0.625rem] text-muted">{monthLabel(m.month)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
