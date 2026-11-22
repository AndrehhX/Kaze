"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, PlayCircle } from "lucide-react";
import type { ScheduleItem } from "@/lib/anilist/service";

const FORMAT_LABELS: Record<string, string> = {
  TV: "Serie",
  TV_SHORT: "Corto",
  MOVIE: "Película",
  SPECIAL: "Especial",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Musical",
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function countdown(seconds: number) {
  if (seconds < 60) return "en menos de 1 min";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `en ${d} d ${h} h`;
  if (h > 0) return `en ${h} h ${m} min`;
  return `en ${m} min`;
}

export function ScheduleView({ items }: { items: ScheduleItem[] }) {
  // La hora local solo existe en el navegador: se renderiza tras montar para evitar desajustes de hidratación.
  const [now, setNow] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyJapan, setOnlyJapan] = useState(true);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => {
    if (now === null) return [];
    const base = new Date(now);
    base.setHours(0, 0, 0, 0);
    const weekday = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric" });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const label = i === 0 ? "Hoy" : i === 1 ? "Mañana" : weekday.format(d).replace(".", "");
      return { key: dayKey(d), label };
    });
  }, [now]);

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      if (onlyJapan && it.media.countryOfOrigin && it.media.countryOfOrigin !== "JP") continue;
      const key = dayKey(new Date(it.airingAt * 1000));
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.airingAt - b.airingAt);
    return map;
  }, [items, onlyJapan]);

  const active = selected ?? days[0]?.key ?? null;
  const list = active ? byDay.get(active) ?? [] : [];
  const time = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  return (
    <div className="container-k pt-8 pb-16">
      <header className="relative overflow-hidden">
        <span className="k-jp pointer-events-none absolute -top-8 right-0 select-none text-[10rem] font-bold leading-none text-fg/[0.05]" lang="ja" aria-hidden>
          放送予定
        </span>
        <p className="k-label text-primary-ink">Calendario de emisión</p>
        <h1 className="font-display text-title mt-2">Qué sale esta semana</h1>
        <p className="mt-2 text-sm text-muted">
          Horarios en tu zona horaria{tz ? ` (${tz})` : ""}. Se actualiza cada hora.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="tablist" aria-label="Días">
        {now === null
          ? Array.from({ length: 7 }, (_, i) => <span key={i} className="k-skeleton h-9 w-20 rounded-full" />)
          : days.map((d) => {
              const count = byDay.get(d.key)?.length ?? 0;
              return (
                <button
                  key={d.key}
                  type="button"
                  role="tab"
                  aria-selected={d.key === active}
                  data-active={d.key === active}
                  onClick={() => setSelected(d.key)}
                  className="k-chip capitalize"
                >
                  {d.label}
                  <span className="ml-1 text-xs opacity-70">{count}</span>
                </button>
              );
            })}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyJapan} onChange={(e) => setOnlyJapan(e.target.checked)} className="accent-[var(--k-primary)]" />
          Solo anime japonés
        </label>
      </div>

      <section className="mt-6" aria-live="polite">
        {now === null ? (
          <div className="grid gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="k-skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="k-card flex flex-col items-center gap-2 p-10 text-center">
            <CalendarClock className="size-8 text-primary-ink" aria-hidden />
            <p className="font-display text-lg">No hay episodios programados este día</p>
            <p className="text-sm text-muted">Prueba otro día o desactiva el filtro de anime japonés.</p>
          </div>
        ) : (
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {list.map((it) => {
              const secondsLeft = it.airingAt - Math.floor(now / 1000);
              const aired = secondsLeft <= 0;
              const title = it.media.title.english || it.media.title.romaji || "Anime";
              return (
                <li key={it.id} className="min-w-0">
                  <Link
                    href={`/anime/${it.media.id}`}
                    prefetch={false}
                    className="k-card group flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--k-hover-glow)] sm:gap-4"
                  >
                    <time dateTime={new Date(it.airingAt * 1000).toISOString()} className="w-12 shrink-0 text-center font-display text-base tabular-nums sm:w-14 sm:text-lg">
                      {time.format(new Date(it.airingAt * 1000))}
                    </time>
                    {it.media.coverImage.large ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.media.coverImage.large}
                        alt=""
                        loading="lazy"
                        width={48}
                        height={68}
                        className="h-[68px] w-12 shrink-0 rounded-lg object-cover"
                        style={{ backgroundColor: it.media.coverImage.color ?? undefined }}
                      />
                    ) : (
                      <div className="h-[68px] w-12 shrink-0 rounded-lg bg-surface" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium group-hover:text-primary-ink">{title}</p>
                      <p className="text-sm text-muted">
                        Episodio {it.episode}
                        {it.media.episodes ? ` de ${it.media.episodes}` : ""}
                        {it.media.format ? ` · ${FORMAT_LABELS[it.media.format] ?? it.media.format}` : ""}
                      </p>
                      {/* En móvil el estado va debajo para dejar sitio al título. */}
                      <p className={`mt-0.5 text-xs sm:hidden ${aired ? "font-medium text-primary-ink" : "text-muted"}`}>
                        {aired ? "Ya salió" : countdown(secondsLeft)}
                      </p>
                    </div>
                    {aired ? (
                      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary-ink sm:flex">
                        <PlayCircle className="size-3.5" aria-hidden /> Ya salió
                      </span>
                    ) : (
                      <span className="hidden shrink-0 items-center gap-1 text-xs text-muted sm:flex">
                        <Clock className="size-3.5" aria-hidden /> {countdown(secondsLeft)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
