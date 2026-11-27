"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Download, Share2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLibrary } from "@/stores/library";
import { useProgress } from "@/stores/progress";
import { useAuth } from "@/stores/auth";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { genreLabel } from "@/lib/anilist/browse-params";
import { useKazeMotion } from "@/lib/motion";
import { computeWrapped, type Wrapped, type WrappedProgress, type WrappedTop } from "@/lib/wrapped";
import { drawWrappedCard } from "./share-card";
import { useSupporter } from "@/components/support/use-supporter";
import { activeTier } from "@/lib/support/tiers";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

/** Progreso del año: Supabase si hay sesión (paginado), si no el progreso guardado en este navegador. */
function useYearProgress(year: number) {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const local = useProgress((s) => s.items);
  const remote = useQuery({
    queryKey: ["wrapped-progress", user?.id, year],
    enabled: isSupabaseConfigured && status === "signed-in" && Boolean(user),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const db = getSupabaseBrowser()!;
      const out: WrappedProgress[] = [];
      for (let from = 0; from < 10_000; from += 1000) {
        const { data, error } = await db
          .from("watch_progress")
          .select("series_id, episode_id, position_seconds, duration_seconds, completed, updated_at")
          .eq("user_id", user!.id)
          .gte("updated_at", `${year}-01-01T00:00:00Z`)
          .lt("updated_at", `${year + 1}-01-01T00:00:00Z`)
          .range(from, from + 999);
        if (error) throw error;
        for (const r of data ?? []) {
          out.push({
            seriesId: r.series_id,
            episodeId: r.episode_id,
            position: r.position_seconds,
            duration: r.duration_seconds,
            completed: r.completed,
            updatedAt: new Date(r.updated_at).getTime(),
          });
        }
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
  const localList = useMemo<WrappedProgress[]>(
    () => Object.values(local).map((p) => ({ ...p, seriesTitle: p.seriesTitle ?? null, thumbnail: p.thumbnail ?? null })),
    [local],
  );
  if (status === "signed-in") {
    // Mezcla: lo remoto manda, lo local aporta títulos y miniaturas.
    const byKey = new Map(localList.map((p) => [`${p.seriesId}::${p.episodeId}`, p]));
    const merged = (remote.data ?? []).map((r) => {
      const l = byKey.get(`${r.seriesId}::${r.episodeId}`);
      return { ...r, seriesTitle: l?.seriesTitle ?? null, thumbnail: l?.thumbnail ?? null };
    });
    return { data: merged, loading: remote.isLoading };
  }
  return { data: localList, loading: status === "loading" };
}

/** Completa títulos y portadas del top que no están en la biblioteca. */
function useTopDetails(top: WrappedTop[]) {
  const missing = top.filter((t) => !t.cover && /^\d+$/.test(t.seriesId)).map((t) => t.seriesId);
  const q = useQuery({
    queryKey: ["wrapped-top", missing.join(",")],
    enabled: missing.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(`/api/anilist/batch?ids=${missing.join(",")}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { media: { id: number; title: { english: string | null; romaji: string | null }; coverImage: { extraLarge: string | null; large: string | null; color: string | null } }[] };
      return json.media ?? [];
    },
  });
  return useMemo(
    () =>
      top.map((t) => {
        const m = q.data?.find((x) => String(x.id) === t.seriesId);
        return m ? { ...t, title: m.title.english || m.title.romaji || t.title, cover: m.coverImage.extraLarge || m.coverImage.large, color: m.coverImage.color } : t;
      }),
    [top, q.data],
  );
}

function Slide({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "accent" }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            tone === "primary"
              ? "radial-gradient(circle at 20% 15%, var(--k-primary), transparent 55%), radial-gradient(circle at 85% 90%, var(--k-accent), transparent 50%)"
              : "radial-gradient(circle at 80% 10%, var(--k-accent), transparent 55%), radial-gradient(circle at 10% 90%, var(--k-primary), transparent 50%)",
        }}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">{children}</div>
    </div>
  );
}

const Big = ({ children }: { children: React.ReactNode }) => <p className="font-display text-[clamp(3.5rem,16vw,6.5rem)] leading-none tabular-nums">{children}</p>;
const Label = ({ children }: { children: React.ReactNode }) => <p className="k-label text-primary-ink">{children}</p>;

export function WrappedView({ year }: { year: number }) {
  const entriesMap = useLibrary((s) => s.entries);
  const hydrated = useLibrary((s) => s.hydrated);
  const profile = useAuth((s) => s.profile);
  const entries = useMemo(() => Object.values(entriesMap), [entriesMap]);
  const { data: progress, loading } = useYearProgress(year);
  const w: Wrapped = useMemo(() => computeWrapped(year, entries, progress), [year, entries, progress]);
  const top = useTopDetails(w.top);
  const { reduced } = useKazeMotion();
  const [i, setI] = useState(0);
  const name = profile?.display_name || profile?.username || "Tú";
  const tormenta = activeTier(useSupporter(profile?.id).data) >= 3;

  const empty = w.episodes === 0 && w.completedTitles === 0;
  const hours = Math.floor(w.minutes / 60);

  const slides: { key: string; node: React.ReactNode; tone?: "primary" | "accent" }[] = empty
    ? []
    : [
        {
          key: "intro",
          node: (
            <>
              <p className="k-jp text-6xl text-primary-ink" lang="ja">風</p>
              <Label>KAZE Wrapped{tormenta ? " · ⚡ Edición Tormenta" : ""}</Label>
              <h1 className="font-display mt-3 text-5xl leading-tight">Tu {year} en anime</h1>
              <p className="mt-4 text-muted">{name}, esto es lo que viviste este año. Toca para avanzar.</p>
            </>
          ),
        },
        {
          key: "time",
          tone: "accent",
          node: (
            <>
              <Label>Tiempo viendo anime</Label>
              <Big>{hours > 0 ? hours : w.minutes}</Big>
              <p className="font-display text-2xl">{hours > 0 ? (hours === 1 ? "hora" : "horas") : "minutos"}</p>
              <p className="mt-6 text-muted">
                {w.episodes} episodios de {w.series} {w.series === 1 ? "serie" : "series"}
                {hours >= 4 ? ` · equivale a ${Math.round(w.minutes / 120)} películas de 2 h` : ""}
              </p>
              {w.completedTitles > 0 && <p className="mt-2 text-sm text-muted">Terminaste {w.completedTitles} {w.completedTitles === 1 ? "anime" : "animes"} completos.</p>}
            </>
          ),
        },
        ...(top.length
          ? [
              {
                key: "top",
                node: (
                  <>
                    <Label>Tu anime número 1</Label>
                    {top[0].cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={top[0].cover} alt="" className="mt-4 h-56 w-40 rounded-2xl object-cover shadow-[var(--k-shadow-pop)]" style={{ backgroundColor: top[0].color ?? undefined }} />
                    )}
                    <h2 className="font-display mt-4 text-3xl leading-tight">{top[0].title}</h2>
                    <p className="text-muted">
                      {top[0].episodes} episodios · {top[0].minutes >= 60 ? `${Math.round(top[0].minutes / 60)} h` : `${top[0].minutes} min`}
                    </p>
                    {top.length > 1 && (
                      <ol className="mt-6 w-full space-y-2 text-left">
                        {top.slice(1).map((t, n) => (
                          <li key={t.seriesId} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2">
                            <span className="font-display w-6 text-primary-ink">{n + 2}</span>
                            <span className="min-w-0 flex-1 truncate">{t.title}</span>
                            <span className="text-xs text-muted">{t.episodes} ep.</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                ),
              },
            ]
          : []),
        ...(w.topGenres.length
          ? [
              {
                key: "genres",
                tone: "accent" as const,
                node: (
                  <>
                    <Label>Tus géneros</Label>
                    <h2 className="font-display mt-2 text-4xl">{genreLabel(w.topGenres[0].name)}</h2>
                    <div className="mt-8 w-full space-y-3">
                      {w.topGenres.slice(0, 5).map((g) => (
                        <div key={g.name} className="text-left">
                          <div className="flex justify-between text-sm"><span>{genreLabel(g.name)}</span><span className="text-muted">{g.count}</span></div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                            <motion.div
                              className="h-full rounded-full [background:linear-gradient(90deg,var(--k-primary),var(--k-accent))]"
                              initial={{ width: 0 }}
                              animate={{ width: `${(g.count / w.topGenres[0].count) * 100}%` }}
                              transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ),
              },
            ]
          : []),
        ...(w.episodes > 0
          ? [
              {
                key: "rhythm",
                node: (
                  <>
                    <Label>Tu ritmo</Label>
                    {w.busiestMonth != null && <h2 className="font-display mt-2 text-3xl">Tu mes más otaku fue {MONTHS[w.busiestMonth]}</h2>}
                    <div className="mt-6 flex h-28 w-full items-end gap-1">
                      {w.months.map((n, m) => (
                        <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                          <motion.div
                            className="w-full rounded-t-md [background:linear-gradient(180deg,var(--k-accent),var(--k-primary))]"
                            initial={{ height: 0 }}
                            animate={{ height: `${(n / Math.max(...w.months, 1)) * 100}%` }}
                            transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : m * 0.04 }}
                            style={{ minHeight: n ? 4 : 0 }}
                          />
                          <span className="text-[10px] uppercase text-muted">{MONTHS[m][0]}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 space-y-1 text-muted">
                      {w.favoriteWeekday != null && <p>Tu día favorito: los <strong className="text-fg">{WEEKDAYS[w.favoriteWeekday]}</strong></p>}
                      {w.bestDay && w.bestDay.episodes > 1 && <p>Récord: <strong className="text-fg">{w.bestDay.episodes} episodios</strong> en un solo día</p>}
                      {w.nightShare >= 0.2 && <p><strong className="text-fg">{Math.round(w.nightShare * 100)}%</strong> lo viste de madrugada 🌙</p>}
                    </div>
                  </>
                ),
              },
            ]
          : []),
        {
          key: "personality",
          tone: "accent",
          node: (
            <>
              <Label>Tu personalidad otaku</Label>
              <p className="k-jp mt-4 text-5xl text-primary-ink" lang="ja">{w.personality.jp}</p>
              <h2 className="font-display mt-3 text-4xl leading-tight">{w.personality.name}</h2>
              <p className="mt-4 text-fg/85">{w.personality.description}</p>
            </>
          ),
        },
        {
          key: "share",
          node: <ShareSlide w={w} top={top} name={name} tormenta={tormenta} />,
        },
      ];

  const go = useCallback((d: number) => setI((cur) => Math.max(0, Math.min(slides.length - 1, cur + d))), [slides.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!hydrated || loading) {
    return <div className="grid min-h-[80dvh] place-items-center"><div className="k-skeleton h-[70dvh] w-[min(92vw,420px)] rounded-3xl" /></div>;
  }

  if (empty) {
    return (
      <div className="container-k grid min-h-[70dvh] place-items-center py-16">
        <div className="k-card max-w-md p-8 text-center">
          <Sparkles className="mx-auto size-8 text-primary-ink" aria-hidden />
          <h1 className="font-display mt-4 text-3xl">Tu Wrapped {year} aún está vacío</h1>
          <p className="mt-3 text-sm text-muted">Mira algunos episodios o marca animes como completados en tu biblioteca y vuelve: aquí aparecerá tu resumen del año.</p>
          <Link href="/discover" className="k-btn k-btn-primary mt-6">Descubrir anime</Link>
        </div>
      </div>
    );
  }

  const slide = slides[Math.min(i, slides.length - 1)];
  return (
    <div className="grid min-h-[calc(100dvh-var(--k-nav-h))] place-items-center py-4">
      <div className="relative h-[min(86dvh,780px)] w-[min(94vw,440px)] overflow-hidden rounded-[28px] border border-line bg-surface shadow-[var(--k-shadow-pop)]">
        {/* Barras de progreso */}
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
          {slides.map((s, n) => (
            <button key={s.key} type="button" aria-label={`Ir a la pantalla ${n + 1}`} onClick={() => setI(n)} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <span className="block h-full rounded-full bg-white transition-[width] duration-300" style={{ width: n <= i ? "100%" : "0%" }} />
            </button>
          ))}
        </div>
        <Link href="/" aria-label="Cerrar" className="absolute right-3 top-6 z-20 grid size-9 place-items-center rounded-full bg-black/30 text-white hover:bg-black/50">
          <X className="size-4" />
        </Link>

        <AnimatePresence mode="wait">
          <motion.div
            key={slide.key}
            className="absolute inset-0"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
            transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <Slide tone={slide.tone}>{slide.node}</Slide>
          </motion.div>
        </AnimatePresence>

        {/* Zonas táctiles: izquierda = atrás, derecha = adelante (no en la última pantalla) */}
        {i < slides.length - 1 && (
          <>
            <button type="button" aria-label="Anterior" className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={() => go(-1)} />
            <button type="button" aria-label="Siguiente" className="absolute inset-y-0 right-0 z-10 w-2/3" onClick={() => go(1)} />
          </>
        )}
        <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-2">
          <button type="button" onClick={() => go(-1)} disabled={i === 0} className="k-btn k-btn-ghost k-btn-sm disabled:opacity-30" aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => go(1)} disabled={i === slides.length - 1} className="k-btn k-btn-ghost k-btn-sm disabled:opacity-30" aria-label="Siguiente">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareSlide({ w, top, name, tormenta = false }: { w: Wrapped; top: WrappedTop[]; name: string; tormenta?: boolean }) {
  const [busy, setBusy] = useState(false);
  const makeBlob = async () => {
    const canvas = await drawWrappedCard({ w, top, name, edition: tormenta ? "tormenta" : null });
    return new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
  };
  const download = async () => {
    setBusy(true);
    try {
      const blob = await makeBlob();
      if (!blob) throw new Error("sin imagen");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kaze-wrapped-${w.year}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      toast.error("No se pudo generar la imagen");
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    setBusy(true);
    try {
      const blob = await makeBlob();
      const file = blob ? new File([blob], `kaze-wrapped-${w.year}.png`, { type: "image/png" }) : null;
      const text = `Mi ${w.year} en anime: ${Math.floor(w.minutes / 60)} h, ${w.episodes} episodios. Soy "${w.personality.name}". ¿Y tú? 👉 www.orunei.sbs/wrapped`;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else if (navigator.share) await navigator.share({ text, url: `${location.origin}/wrapped` });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Texto copiado para compartir");
      }
    } catch {
      /* el usuario canceló */
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Label>Comparte tu año</Label>
      <h2 className="font-display mt-2 text-4xl">Eso fue tu {w.year}</h2>
      <div className="mt-6 grid w-full grid-cols-2 gap-3 text-left">
        {[
          ["Horas", String(Math.floor(w.minutes / 60))],
          ["Episodios", String(w.episodes)],
          ["Series", String(w.series)],
          ["Personalidad", w.personality.name],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-black/20 p-3">
            <p className="text-xs text-muted">{k}</p>
            <p className="font-display truncate text-xl">{v}</p>
          </div>
        ))}
      </div>
      <div className="relative z-30 mt-6 flex w-full flex-col gap-2">
        <button type="button" onClick={share} disabled={busy} className="k-btn k-btn-primary">
          <Share2 className="size-4" /> Compartir
        </button>
        <button type="button" onClick={download} disabled={busy} className="k-btn k-btn-outline">
          <Download className="size-4" /> Descargar imagen
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">{name}, ¡gracias por ver anime en KAZE!</p>
    </>
  );
}
