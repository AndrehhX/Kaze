"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LayoutGroup, motion } from "motion/react";
import { Captions, Keyboard, Popcorn, Sparkles, Volume2 } from "lucide-react";
import { useState } from "react";
import type { PlaybackGrant } from "@/lib/media/types";
import { Player } from "./player";
import { useSettings } from "@/stores/settings";
import { useProgress } from "@/stores/progress";
import { useKazeMotion } from "@/lib/motion";
import { DemoBadge, ErrorPanel, Skeleton } from "@/components/ui/primitives";
import { cn, formatDuration } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";

export async function requestGrant(
  seriesId: string,
  episodeId: string,
  preferredAudio?: "latino" | "sub"
): Promise<PlaybackGrant> {
  const res = await fetch("/api/playback/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesId, episodeId, preferredAudio }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(body?.error ?? "Reproducción no disponible"), { status: res.status, reason: body?.reason });
  return body.grant as PlaybackGrant;
}

export function usePlaybackGrant(seriesId: string, episodeId: string, preferredAudio?: "latino" | "sub") {
  return useQuery({
    queryKey: ["grant", seriesId, episodeId, preferredAudio],
    queryFn: () => requestGrant(seriesId, episodeId, preferredAudio),
    staleTime: 60 * 60_000,
    retry: 1,
  });
}

const SHORTCUTS: [string, string][] = [
  ["Espacio / K", "Reproducir o pausar"],
  ["J / L", "Retroceder / avanzar 10s"],
  ["← / →", "Retroceder / avanzar 5s"],
  ["↑ / ↓", "Volumen"],
  ["M", "Silenciar"],
  ["C", "Subtítulos"],
  ["F", "Pantalla completa"],
  ["T", "Modo teatro"],
  ["I", "Picture-in-picture"],
  ["Shift + N / P", "Siguiente / episodio previo"],
  ["0–9", "Saltar a 0–90%"],
];

export function WatchClient({ seriesId, episodeId }: { seriesId: string; episodeId: string }) {
  const router = useRouter();
  const [preferredAudio, setPreferredAudio] = useState<"latino" | "sub">("latino");
  const { data: grant, isLoading, error, refetch } = usePlaybackGrant(seriesId, episodeId, preferredAudio);
  const theater = useSettings((s) => s.player.theater);
  const items = useProgress((s) => s.items);
  const { m, reduced } = useKazeMotion();
  const [help, setHelp] = useState(false);

  if (error)
    return (
      <div className="container-k pt-10">
        <ErrorPanel
          title={(error as { status?: number }).status === 404 || (error as { status?: number }).status === 403 ? "Este episodio no está disponible" : "No se pudo iniciar la reproducción"}
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      </div>
    );

  const go = (id: string) => router.push(`/watch/${seriesId}/${id}`);

  return (
    <LayoutGroup>
      <div className={cn("overflow-x-clip pt-4 transition-colors duration-500", theater && "bg-black/40")}>
        <div className={cn("mx-auto grid gap-6", theater ? "max-w-[1800px] px-0 sm:px-4" : "container-k lg:grid-cols-[1fr_340px]")}>
          <motion.div layout={!reduced} transition={m.spring} className="min-w-0">
            {isLoading || !grant ? (
              <Skeleton className="aspect-video w-full !rounded-[var(--k-radius-panel)]" />
            ) : (
              <Player key={`${grant.episode.id}-${preferredAudio}`} grant={grant} onNavigateEpisode={go} />
            )}
            {grant && (
              <div className={cn("mt-5", theater && "container-k")}>
                {/* Selector de Audio y Subtítulos debajo del reproductor */}
                <div className="mb-5 rounded-2xl border border-line bg-surface/85 p-3.5 sm:p-4 backdrop-blur shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                        <Volume2 className="size-3.5 text-primary" /> Audio:
                      </span>
                      <div className="inline-flex rounded-xl bg-elevated p-1 border border-line">
                        <button
                          type="button"
                          onClick={() => setPreferredAudio("latino")}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                            preferredAudio === "latino"
                              ? "bg-primary text-black shadow-sm"
                              : "text-muted hover:text-fg"
                          )}
                        >
                          <span>🇲🇽</span>
                          <span>Español Latino (DUB)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreferredAudio("sub")}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                            preferredAudio === "sub"
                              ? "bg-primary text-black shadow-sm"
                              : "text-muted hover:text-fg"
                          )}
                        >
                          <span>🇯🇵</span>
                          <span>Japonés (SUB)</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Captions className="size-4 text-accent" />
                      <span className="text-muted font-medium">Subtítulos:</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors",
                          preferredAudio === "sub"
                            ? "border-accent/40 bg-accent/15 text-accent"
                            : "border-line bg-elevated text-muted"
                        )}
                      >
                        {preferredAudio === "sub" ? "Español (Integrados)" : "No necesarios (Doblaje)"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-line/60 flex flex-wrap items-center justify-between gap-2 text-[0.75rem] text-muted">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>
                        Servidor: <strong className="text-fg">{grant.serverName ?? "Stream Ultra HD"}</strong>
                      </span>
                      {grant.audioLanguage && (
                        <span className="rounded bg-line px-1.5 py-0.5 text-[0.6875rem] uppercase font-mono text-fg/80">
                          {grant.audioLanguage === "ja" ? "Audio Japonés" : "Audio Latino"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-primary-ink font-medium">
                      <Sparkles className="size-3.5" />
                      <span>Calidad 1080p disponible</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {grant.series.demo && <DemoBadge />}
                  <span className="k-label text-muted truncate max-w-full">
                    {grant.series.title} · Episodio {grant.episode.number}
                  </span>
                </div>
                <h1 className="font-display mt-2 text-section break-words">{grant.episode.title}</h1>
                <p className="mt-2 max-w-3xl text-sm text-muted">{grant.episode.synopsis}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link href={`/watch-parties?series=${seriesId}&episode=${grant.episode.id}`} className="k-btn k-btn-outline k-btn-sm">
                    <Popcorn className="size-4" aria-hidden /> Ver juntos
                  </Link>
                  <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setHelp(true)}>
                    <Keyboard className="size-4" aria-hidden /> Atajos
                  </button>
                </div>
                <p className="mt-5 text-xs text-muted">
                  {grant.series.license.attribution}{" "}
                  <a className="underline" href={grant.series.license.url} target="_blank" rel="noreferrer">
                    {grant.series.license.name}
                  </a>
                </p>
              </div>
            )}
          </motion.div>

          {!theater && (
            <motion.aside initial={reduced ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={m.spring} className="min-w-0">
              <div className="k-card p-4">
                <p className="k-label text-muted">{grant?.series.title ?? "Episodios"}</p>
                <p className="k-jp text-xs text-muted" lang="ja">
                  {grant?.series.titleJp}
                </p>
                <ol className="mt-3 space-y-1.5">
                  {(grant?.episodes ?? []).map((ep) => {
                    const p = items[`${seriesId}::${ep.id}`];
                    const active = ep.id === episodeId;
                    return (
                      <li key={ep.id}>
                        <Link
                          href={`/watch/${seriesId}/${ep.id}`}
                          aria-current={active ? "page" : undefined}
                          className={cn("flex items-center gap-3 rounded-[min(var(--k-radius-btn),12px)] p-2 transition-colors hover:bg-[var(--k-btn-ghost)]", active && "bg-primary/15")}
                        >
                          {ep.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ep.thumbnail} alt="" loading="lazy" className="aspect-video w-24 shrink-0 rounded-[min(var(--k-radius-card),8px)] object-cover bg-elevated" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="grid aspect-video w-24 shrink-0 place-items-center rounded-[min(var(--k-radius-card),8px)] bg-gradient-to-br from-primary/40 to-accent/30">
                              <span className="k-outline-num text-2xl">{String(ep.number).padStart(2, "0")}</span>
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{ep.title}</span>
                            <span className="block text-xs text-muted">
                              {formatDuration(ep.duration)}
                              {p?.completed ? " · Visto" : p ? ` · ${formatDuration(p.position)}` : ""}
                            </span>
                            <span className="mt-1 block h-0.5 overflow-hidden rounded bg-line">
                              <span className="block h-full bg-primary" style={{ width: `${p ? (p.completed ? 100 : (p.position / Math.max(1, p.duration)) * 100) : 0}%` }} />
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </motion.aside>
          )}
        </div>
      </div>

      <Dialog open={help} onOpenChange={setHelp} title="Atajos de teclado" description="Haz foco en el reproductor (clic o Tab).">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-5 pb-6 pt-2 text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
              </dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </LayoutGroup>
  );
}
