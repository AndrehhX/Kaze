"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Target } from "lucide-react";
import { useMemo, useState } from "react";
import { computeDna } from "@/lib/dna";
import { saveSeasonGoal, seasonProgress, useAchievements } from "./achievements";
import { toast } from "sonner";
import { statusMeta, LIBRARY_STATUSES, type LibraryEntry } from "@/lib/library/types";
import { useKazeMotion } from "@/lib/motion";
import { useSettings } from "@/stores/settings";
import { EmptyState } from "@/components/ui/primitives";
import { titleCase } from "@/lib/utils";
import { genreLabel } from "@/lib/anilist/browse-params";
import { Badge, type ProfileData } from "./profile";

const C = (i: number) => `var(--k-chart-${(i % 5) + 1})`;

/** Signature visual: a double helix whose rungs are your genres, length = share of your library. */
function Helix({ genres }: { genres: { name: string; share: number }[] }) {
  const { reduced } = useKazeMotion();
  const rungs = genres.slice(0, 10);
  const H = 520;
  const step = H / (rungs.length + 1);
  const path = (phase: number) => {
    let d = "";
    for (let y = 0; y <= H; y += 8) {
      const x = 160 + Math.sin(y / 52 + phase) * 110;
      d += `${y === 0 ? "M" : "L"}${x.toFixed(1)} ${y}`;
    }
    return d;
  };
  return (
    <svg viewBox={`0 0 320 ${H}`} className="mx-auto h-[min(70vh,520px)] w-full max-w-xs" role="img" aria-label={`Genre helix: ${rungs.map((g) => `${g.name} ${Math.round(g.share * 100)}%`).join(", ")}`}>
      <motion.path d={path(0)} fill="none" stroke="var(--k-primary)" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6 }} />
      <motion.path d={path(Math.PI)} fill="none" stroke="var(--k-accent)" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, delay: 0.1 }} />
      {rungs.map((g, i) => {
        const y = step * (i + 1);
        const x1 = 160 + Math.sin(y / 52) * 110;
        const x2 = 160 + Math.sin(y / 52 + Math.PI) * 110;
        const mid = (x1 + x2) / 2;
        const half = ((x2 - x1) / 2) * Math.max(0.15, Math.min(1, g.share * 1.6));
        return (
          <g key={g.name}>
            <line x1={x1} x2={x2} y1={y} y2={y} stroke="var(--k-line)" strokeWidth="2" />
            <motion.line x1={mid} x2={mid} y1={y} y2={y} stroke={C(i)} strokeWidth="7" strokeLinecap="round" initial={false} animate={{ x1: mid - half, x2: mid + half }} transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : 0.6 + i * 0.07 }} />
            <text x={Math.max(x1, x2) + 10 > 300 ? Math.min(x1, x2) - 10 : Math.max(x1, x2) + 10} y={y + 4} textAnchor={Math.max(x1, x2) + 10 > 300 ? "end" : "start"} className="fill-fg text-[11px] font-semibold">
              {g.name} {Math.round(g.share * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Bars({ items, label }: { items: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2" aria-label={label}>
      {items.map((it, i) => (
        <li key={it.label} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{it.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-line">
            <motion.span className="block h-full rounded-full" style={{ background: C(i) }} initial={{ width: 0 }} whileInView={{ width: `${(it.value / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.04 }} />
          </span>
          <span className="text-right tabular-nums">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`k-card p-5 ${className ?? ""}`}>
      <h3 className="font-display text-lg">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AnimeDna({ d }: { d: ProfileData }) {
  const dna = useMemo(() => computeDna(d.entries), [d.entries]);
  const gamification = useSettings((s) => s.gamification);
  const ach = useAchievements(d.entries, d.guest ? null : (d.profile?.id ?? null), d.isMe);
  if (d.listsHidden) return <EmptyState jp="秘" title="Este ADN es privado" />;
  if (dna.total < 1)
    return <EmptyState jp="遺" title="Aún no hay ADN que secuenciar" body="El ADN anime se calcula solo con datos reales de tu biblioteca. Añade y completa algunos títulos para ver cómo toma forma tu gusto." action={d.isMe ? <Link href="/discover" className="k-btn k-btn-primary k-btn-sm">Descubrir anime</Link> : undefined} />;
  const top = dna.genres[0];
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card title="Hélice de géneros">
          {dna.genres.length ? <Helix genres={dna.genres} /> : <p className="text-sm text-muted">Los géneros aparecen cuando empiezas algo.</p>}
        </Card>
        <div className="grid gap-6 sm:grid-cols-2">
          <Card title="Firma" className="sm:col-span-2">
            <p className="font-display text-2xl leading-snug">
              {top ? (
                <>
                  Alma de <span className="text-primary-ink">{top.name}</span>
                  {dna.genres[1] ? (
                    <>
                      {" "}con un toque de <span className="text-primary-ink">{dna.genres[1].name}</span>
                    </>
                  ) : null}
                  .
                </>
              ) : (
                "Todavía tomando forma."
              )}
            </p>
            <p className="mt-2 text-sm text-muted">
              {dna.completed} completados · {Math.round(dna.hours)} horas registradas · {dna.meanScore != null ? `nota media ${dna.meanScore}` : "sin notas todavía"}
              {dna.completionRate != null ? ` · termina el ${Math.round(dna.completionRate * 100)}% de lo que no abandona` : ""}
            </p>
          </Card>
          <Card title="Estudios favoritos">{dna.studios.length ? <Bars label="Estudios" items={dna.studios.map((s) => ({ label: s.name, value: s.count }))} /> : <p className="text-sm text-muted">Sin datos de estudios.</p>}</Card>
          <Card title="Épocas favoritas">{dna.eras.length ? <Bars label="Décadas" items={dna.eras.map((e) => ({ label: e.decade, value: e.count }))} /> : <p className="text-sm text-muted">Sin años de estreno.</p>}</Card>
          <Card title="Distribución de notas">
            {dna.scored ? <Bars label="Notas" items={dna.scoreBuckets.map((b) => ({ label: b.bucket, value: b.count }))} /> : <p className="text-sm text-muted">Puntúa títulos (0–100) para ver cómo calificas.</p>}
          </Card>
          <Card title="Distribución por estado">
            <Bars label="Statuses" items={LIBRARY_STATUSES.map((s) => ({ label: s.label, value: dna.statuses.find((x) => x.status === s.value)?.count ?? 0 }))} />
          </Card>
          <Card title="Formats">
            <Bars label="Formats" items={dna.formats.map((f) => ({ label: titleCase(f.name), value: f.count }))} />
          </Card>
          <Card title="Patrón de visionado">
            <p className="mb-3 text-xs text-muted">Días en que actualizaste cada título por última vez (tu hora local).</p>
            <div className="flex h-28 items-end gap-2" role="img" aria-label={dna.weekdays.map((w) => `${w.day} ${w.count}`).join(", ")}>
              {dna.weekdays.map((w, i) => {
                const max = Math.max(1, ...dna.weekdays.map((x) => x.count));
                return (
                  <div key={w.day} className="flex flex-1 flex-col items-center gap-1">
                    <motion.div className="w-full rounded-t" style={{ background: C(i) }} initial={{ height: 0 }} whileInView={{ height: `${(w.count / max) * 80 + 4}px` }} viewport={{ once: true }} />
                    <span className="text-[0.625rem] text-muted">{w.day}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
      {d.isMe && gamification && <SeasonGoal entries={d.entries} userId={d.guest ? null : (d.profile?.id ?? null)} remoteGoal={ach.goal} onSaved={() => ach.refetch()} />}
      {(gamification || !d.isMe) && (
        <Card title="Todos los logros">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ach.achievements.map((a) => (
              <Badge key={a.id} a={a} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Optional seasonal goal: saved to the account when signed in, otherwise on this device. */
function SeasonGoal({ entries, userId, remoteGoal, onSaved }: { entries: LibraryEntry[]; userId: string | null; remoteGoal: number | null; onSaved: () => void }) {
  const { season, year, done } = seasonProgress(entries);
  const key = `kaze:goal:${season}-${year}`;
  const [local, setLocal] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(key)) || 0;
    } catch {
      return 0;
    }
  });
  const target = userId ? (remoteGoal ?? local) : local;
  const save = async (n: number) => {
    setLocal(n);
    try {
      localStorage.setItem(key, String(n));
    } catch {}
    if (!userId) return;
    const { error } = await saveSeasonGoal(userId, n);
    if (error) toast.error("No se pudo guardar tu meta");
    else onSaved();
  };
  return (
    <section className="k-card flex flex-wrap items-center gap-5 p-5">
      <Target className="size-8 text-primary-ink" aria-hidden />
      <div className="min-w-48 flex-1">
        <h3 className="font-display text-lg">
          {titleCase(season)} {year} goal
        </h3>
        <p className="text-sm text-muted">{target ? `${done} de ${target} completados esta temporada${done >= target ? " · ¡meta cumplida!" : ""}` : "Ponte una meta tranquila: sin rachas ni castigos."}</p>
        {target > 0 && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={target} aria-label="Meta de temporada">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${Math.min(100, (done / target) * 100)}%` }} />
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        Target
        <input
          type="number"
          min={0}
          max={200}
          className="k-input !min-h-9 w-20 text-center"
          key={target}
          defaultValue={target || ""}
          placeholder="—"
          onBlur={(e) => {
            const n = Math.max(0, Math.min(200, Number(e.target.value) || 0));
            if (n !== target) save(n);
          }}
        />
      </label>
    </section>
  );
}

export function ProfileLists({ d }: { d: ProfileData }) {
  const [status, setStatus] = useState<LibraryEntry["status"]>("CURRENT");
  if (d.listsHidden) return <EmptyState jp="秘" title="Estas listas son privadas" />;
  const list = d.entries.filter((e) => e.status === status).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label="Estado">
        {LIBRARY_STATUSES.map((s) => (
          <button key={s.value} className="k-chip" aria-pressed={status === s.value} onClick={() => setStatus(s.value)}>
            {s.label} · {d.entries.filter((e) => e.status === s.value).length}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState title={`Nada en ${statusMeta(status).label}`} />
      ) : (
        <ul className="k-card divide-y divide-line">
          {list.map((e) => (
            <li key={e.mediaId}>
              <Link href={`/anime/${e.mediaId}`} className="flex items-center gap-4 p-3 hover:bg-[var(--k-btn-ghost)]">
                <span className="k-poster relative aspect-[2/3] w-11 shrink-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.media.cover && <img src={e.media.cover} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{e.media.title}</span>
                  <span className="block text-xs text-muted">{e.media.genres.slice(0, 3).map(genreLabel).join(", ")}</span>
                </span>
                <span className="text-sm tabular-nums text-muted">
                  {e.progress}/{e.media.episodes ?? "?"}
                </span>
                <span className="w-10 text-right font-semibold tabular-nums">{e.score ?? "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
