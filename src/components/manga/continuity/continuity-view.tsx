"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, BadgeCheck, BookOpen, ChevronDown, CircleHelp, Eye, EyeOff, Send, ShieldQuestion } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { AdaptationMapping } from "@/lib/manga/continuity/types";
import { VERIFICATION_META } from "@/lib/manga/continuity/types";
import { episodeCoverage, presentRecommendation, validateSubmission } from "@/lib/manga/continuity/engine";
import { parseChapterNumber, type ReadingAvailability } from "@/lib/manga/catalog";
import { useLibrary } from "@/stores/library";
import { useMangaLibrary } from "@/stores/manga";
import { useAuth } from "@/stores/auth";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";
import type { MangaSnapshot } from "@/lib/manga/types";
import { AvailabilityList } from "../detail/interactive";

export type ContinuityAnime = { id: number; title: string; cover: string | null; color: string | null; episodes: number | null; format: string | null; year: number | null };
export type ContinuityManga = { id: number; title: string; cover: string | null; chapters: number | null; volumes: number | null; status: string | null; snapshot: MangaSnapshot; relation: string };

const STATUS_ICON = { verified: BadgeCheck, approximate: AlertTriangle, pending: ShieldQuestion, unknown: CircleHelp } as const;

export function ContinuityView({ anime, timeline, currentIds, manga, relatedManga, availability }: { anime: ContinuityAnime; timeline: AdaptationMapping[]; currentIds: string[]; manga: ContinuityManga | null; relatedManga: ContinuityManga[]; availability: ReadingAvailability[] }) {
  const animeEntry = useLibrary((s) => s.entries[anime.id]);
  const upsertManga = useMangaLibrary((s) => s.upsert);
  const markContinued = useMangaLibrary((s) => s.markContinued);
  const { reduced } = useKazeMotion();
  const [selectedId, setSelectedId] = useState<string | null>(currentIds[0] ?? null);
  const [revealLater, setRevealLater] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const selected = timeline.find((t) => t.id === selectedId) ?? null;
  const selectedIdx = selected ? timeline.indexOf(selected) : -1;
  const rec = presentRecommendation(selected);
  const watchedEp = animeEntry?.progress ?? null;
  const coverage = selected && selected.animeId === anime.id ? episodeCoverage(selected, animeEntry?.status === "COMPLETED" ? (selected.episodeRange?.to ?? null) : watchedEp) : "unknown";
  const maxChapter = useMemo(() => {
    const nums = timeline.flatMap((t) => [t.mangaChapterEnd, t.continuationChapter, t.mangaChapterStart].map(parseChapterNumber).filter((n): n is number => n != null));
    return Math.max(manga?.chapters ?? 0, ...nums, 1);
  }, [manga?.chapters, timeline]);

  const startReading = (chapter: string | null) => {
    if (!manga) return;
    const n = parseChapterNumber(chapter);
    upsertManga({ id: manga.id, snapshot: manga.snapshot }, { status: "CURRENT", progress: n ? Math.max(0, Math.floor(n) - 1) : 0 });
    markContinued(manga.id);
    toast.success(n ? `Guardado: empiezas en el capítulo ${chapter}` : "Guardado en «Leyendo» desde el capítulo 1", { description: manga.title });
  };

  return (
    <div className="container-k pb-16 pt-8">
      {/* header: anime → manga */}
      <header className="grid items-center gap-6 md:grid-cols-[auto_auto_auto_1fr]">
        <Link href={`/anime/${anime.id}`} className="k-poster relative aspect-[2/3] w-24 shrink-0" style={{ backgroundColor: anime.color ?? undefined }} aria-label={`Anime: ${anime.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {anime.cover && <img src={anime.cover} alt="" className="size-full object-cover" />}
        </Link>
        <span aria-hidden className="km-number hidden text-4xl text-primary-ink md:block">
          →
        </span>
        {manga ? (
          <Link href={`/manga/${manga.id}`} className="km-book w-24 shrink-0" aria-label={`Manga: ${manga.title}`}>
            <div className="k-poster aspect-[2/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {manga.cover && <img src={manga.cover} alt="" className="size-full object-cover" />}
            </div>
          </Link>
        ) : (
          <span className="hidden md:block" />
        )}
        <div className="min-w-0">
          <p className="k-label text-primary-ink">物語は続く · La historia continúa</p>
          <h1 className="km-title mt-2 text-[clamp(1.8rem,1.2rem+2.4vw,3.2rem)]">{anime.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {manga ? (
              <>
                Continúa en el manga <Link href={`/manga/${manga.id}`} className="font-semibold text-fg hover:text-primary-ink">{manga.title}</Link>
              </>
            ) : (
              "No hay un manga original verificado para este anime."
            )}
            {watchedEp != null && animeEntry && ` · En tu biblioteca: ${animeEntry.status === "COMPLETED" ? "completado" : `episodio ${watchedEp}${anime.episodes ? ` de ${anime.episodes}` : ""}`}`}
          </p>
        </div>
      </header>

      {timeline.length > 0 && (
        <section aria-labelledby="ct-season" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="ct-season" className="k-label text-muted">
              ¿Qué terminaste de ver?
            </h2>
            <button type="button" className="k-btn k-btn-ghost k-btn-sm" aria-pressed={revealLater} onClick={() => setRevealLater((v) => !v)}>
              {revealLater ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {revealLater ? "Ocultar temporadas posteriores" : "Mostrar temporadas posteriores"}
            </button>
          </div>
          <div role="radiogroup" aria-label="Temporada o película terminada" className="mt-3 flex flex-wrap gap-2">
            {timeline.map((t, i) => {
              const hidden = !revealLater && selectedIdx >= 0 && i > selectedIdx && !currentIds.includes(t.id);
              return (
                <button key={t.id} type="button" role="radio" aria-checked={selectedId === t.id} className="k-chip" data-active={selectedId === t.id} onClick={() => setSelectedId(t.id)} disabled={hidden} title={hidden ? "Oculto para evitar spoilers" : undefined}>
                  {hidden ? "• • •" : t.animeLabel}
                  {t.animeId === anime.id && <span className="text-[0.625rem] text-primary-ink">(este)</span>}
                </button>
              );
            })}
          </div>

          {/* timeline: anime blocks above, manga chapter axis below, recommendation marker */}
          <figure className="km-frame mt-6 p-5" aria-label="Correspondencia entre temporadas y capítulos">
            <div className="relative h-36">
              <div aria-hidden className="km-tone absolute inset-x-0 top-[72px] h-6 opacity-60" />
              <div className="absolute inset-x-0 top-[72px] h-6 border-y border-line" />
              {timeline.map((t, i) => {
                const s = parseChapterNumber(t.mangaChapterStart);
                const e = parseChapterNumber(t.mangaChapterEnd) ?? (s != null ? s : null);
                if (s == null) return null;
                const hidden = !revealLater && selectedIdx >= 0 && i > selectedIdx && !currentIds.includes(t.id);
                const left = ((s - 1) / maxChapter) * 100;
                const width = (((e ?? s) - s + 1) / maxChapter) * 100;
                const active = t.id === selectedId;
                return (
                  <div key={t.id} className="absolute top-2" style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}>
                    <div className={cn("h-14 border-x-2 border-t-2 px-1.5 pt-1 text-[0.6875rem] font-semibold leading-tight", active ? "border-primary bg-primary/15 text-fg" : "border-line text-muted", hidden && "blur-[3px]")} aria-hidden={hidden}>
                      <span className="line-clamp-2">{hidden ? "Oculto" : t.animeLabel}</span>
                    </div>
                    <div className={cn("h-6 transition-colors", active ? "bg-primary" : t.mangaChapterEnd ? "bg-[var(--k-btn-ghost)]" : "bg-transparent")} />
                    {!hidden && (
                      <p className="mt-1 whitespace-nowrap text-[0.625rem] text-muted">
                        cap. {t.mangaChapterStart}
                        {t.mangaChapterEnd ? `–${t.mangaChapterEnd}` : "–?"}
                      </p>
                    )}
                  </div>
                );
              })}
              {rec.kind === "recommendation" && rec.chapter && (
                <motion.div key={rec.chapter} initial={reduced ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="absolute top-[60px] -translate-x-1/2" style={{ left: `${(((parseChapterNumber(rec.chapter) ?? 1) - 1) / maxChapter) * 100}%` }}>
                  <div className="mx-auto h-[52px] w-[3px] bg-accent shadow-[0_0_12px_var(--k-accent)]" />
                  <p className="mt-1 whitespace-nowrap rounded-[var(--k-radius-chip)] bg-accent px-2 py-0.5 text-[0.6875rem] font-bold text-black">Empieza aquí · {rec.chapter}</p>
                </motion.div>
              )}
            </div>
            <figcaption className="mt-6 text-xs text-muted">Arriba, lo que adapta cada temporada o película; abajo, los capítulos del manga (escala aproximada hasta el cap. {maxChapter}). Los rangos solo aparecen cuando hay una fuente.</figcaption>
          </figure>
        </section>
      )}

      {/* recommendation */}
      <section aria-labelledby="ct-rec" className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <AnimatePresence mode="wait">
          <motion.div key={selected?.id ?? "none"} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="km-frame km-stage relative overflow-hidden p-6">
            <div aria-hidden className="km-tone km-tone-fade absolute inset-0 opacity-40" />
            <div className="relative">
              {selected && <StatusBadge mapping={selected} />}
              <h2 id="ct-rec" className="km-title mt-4 text-[clamp(1.6rem,1.1rem+2vw,2.6rem)]">
                {rec.kind === "recommendation" ? rec.headline : "Capítulo de continuación aún no verificado."}
              </h2>
              {rec.kind === "recommendation" && rec.volume && <p className="mt-2 text-sm text-muted">Está en el volumen {rec.volume}.</p>}
              {selected?.continuationChapter && selected.recommendedStartChapter !== selected.continuationChapter && <p className="mt-1 text-sm text-muted">Primer capítulo sin adaptar: {selected.continuationChapter}.</p>}
              {coverage === "mid-season" && selected && (
                <p className="mt-4 flex gap-2 rounded-[var(--k-radius-card)] bg-[var(--k-btn-ghost)] p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <span>
                    Vas por el episodio {watchedEp} de {selected.episodeRange?.to}. La correspondencia exacta episodio a capítulo no está verificada: termina la temporada o, si prefieres leer ya, empieza en el capítulo {selected.mangaChapterStart}, donde arranca esta temporada.
                  </span>
                </p>
              )}
              {selected?.adaptationNotes && <p className="mt-4 text-sm leading-relaxed">{selected.adaptationNotes}</p>}
              {selected?.skippedMaterialWarning && (
                <p className="mt-3 flex gap-2 text-sm text-muted">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {selected.skippedMaterialWarning}
                </p>
              )}
              {selected?.basis && <p className="mt-3 text-xs text-muted">Base de la estimación: {selected.basis}</p>}
              {selected && selected.alternativeStarts.length > 0 && (
                <div className="mt-4">
                  <p className="k-label text-muted">Alternativas</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {selected.alternativeStarts.map((a) => (
                      <li key={a.chapter}>
                        <span className="font-semibold">Capítulo {a.chapter}:</span> <span className="text-muted">{a.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {manga && rec.kind === "recommendation" && (
                  <button type="button" className="k-btn k-btn-primary" onClick={() => startReading(rec.chapter)}>
                    <BookOpen className="size-4" aria-hidden /> Guardar y empezar en el cap. {rec.chapter}
                  </button>
                )}
                {manga && (
                  <button type="button" className={cn("k-btn", rec.kind === "recommendation" ? "k-btn-ghost" : "k-btn-primary")} onClick={() => startReading(null)}>
                    Empezar desde el capítulo 1
                  </button>
                )}
                {manga && (
                  <Link href={`/manga/${manga.id}`} className="k-btn k-btn-outline">
                    Ficha del manga
                  </Link>
                )}
              </div>
              {selected && selected.sourceReferences.length > 0 && (
                <div className="mt-6 border-t border-line pt-4">
                  <button type="button" className="flex items-center gap-1.5 text-sm font-semibold" aria-expanded={showSources} onClick={() => setShowSources((v) => !v)}>
                    Fuentes consultadas ({selected.sourceReferences.length}) <ChevronDown className={cn("size-4 transition-transform", showSources && "rotate-180")} aria-hidden />
                  </button>
                  {showSources && (
                    <ul className="mt-2 space-y-1.5 text-xs">
                      {selected.sourceReferences.map((s) => (
                        <li key={s.url}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary-ink hover:underline">
                            {s.title}
                          </a>{" "}
                          <span className="text-muted">
                            · {s.publisher} · consultado {s.accessedAt}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    Revisión {selected.revision} · actualizado {selected.updatedAt}
                    {selected.verifiedAt ? ` · verificado ${selected.verifiedAt}` : ""}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="space-y-6">
          <div>
            <h2 className="k-label mb-3 text-muted">Leer manga en KAZE</h2>
            {manga ? (
              <Link href={`/manga/${manga.id}#chapters`} className="k-btn k-btn-primary inline-flex w-full items-center justify-center gap-2">
                <BookOpen className="size-4" aria-hidden /> Ver capítulos de {manga.title}
              </Link>
            ) : (
              <p className="text-sm text-muted">Sin manga original identificado.</p>
            )}
          </div>
          {relatedManga.length > 0 && (
            <div>
              <h2 className="k-label mb-3 text-muted">Manga relacionado según AniList</h2>
              <ul className="space-y-2">
                {relatedManga.map((m) => (
                  <li key={m.id}>
                    <Link href={`/manga/${m.id}`} className="km-frame flex items-center gap-3 p-2 hover:bg-[var(--k-btn-ghost)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {m.cover ? <img src={m.cover} alt="" className="h-14 w-10 object-cover" loading="lazy" /> : <span className="h-14 w-10 bg-elevated" />}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{m.title}</span>
                        <span className="text-xs text-muted">{m.relation}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SubmitMapping anime={anime} manga={manga} seasonId={selected?.animeId === anime.id ? selected.animeSeason : "s1"} />
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ mapping }: { mapping: AdaptationMapping }) {
  const meta = VERIFICATION_META[mapping.verificationStatus];
  const Icon = STATUS_ICON[mapping.verificationStatus];
  const tone = { ok: "text-success border-success/50", warn: "text-accent border-accent/60", info: "text-primary-ink border-primary/50", muted: "text-muted border-line" }[meta.tone];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("inline-flex items-center gap-1.5 rounded-[var(--k-radius-chip)] border px-2.5 py-1 text-xs font-bold", tone)}>
        <Icon className="size-3.5" aria-hidden /> {meta.label}
      </span>
      <span className="text-xs text-muted">{meta.description}</span>
    </div>
  );
}

/** Community submission: lands as "pending" for moderators; never shown as verified. */
function SubmitMapping({ anime, manga, seasonId }: { anime: ContinuityAnime; manga: ContinuityManga | null; seasonId: string }) {
  const userId = useAuth((s) => s.user?.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ season: seasonId, end: "", cont: "", notes: "", sources: "" });
  const [busy, setBusy] = useState(false);
  if (!manga) return null;
  const submit = async () => {
    const parsed = validateSubmission({ animeId: anime.id, animeSeason: form.season.trim(), mangaId: manga.id, mangaChapterEnd: form.end.trim() || null, continuationChapter: form.cont.trim(), notes: form.notes, sourceUrls: form.sources.split(/\s+/).filter(Boolean) });
    if (!parsed.ok) return toast.error(parsed.errors[0]);
    const db = getSupabaseBrowser();
    if (!db || !userId) return toast.error("Inicia sesión para enviar una corrección");
    setBusy(true);
    const s = parsed.submission;
    const { error } = await db.from("adaptation_mapping_submissions").insert({ user_id: userId, anime_id: s.animeId, anime_season_identifier: s.animeSeason, manga_id: s.mangaId, manga_chapter_end: s.mangaChapterEnd, continuation_chapter: s.continuationChapter, notes: s.notes, source_urls: s.sourceUrls });
    setBusy(false);
    if (error) return toast.error(error.code === "23505" ? "Ya tienes un envío pendiente para esta temporada" : "No se pudo enviar. Es posible que la base de datos aún no tenga las tablas de manga.");
    toast.success("Enviado para revisión", { description: "Se mostrará como pendiente hasta que un moderador lo revise." });
    setOpen(false);
  };
  return (
    <div className="km-frame p-4">
      <button type="button" className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-2">
          <Send className="size-4" aria-hidden /> Proponer o corregir el punto de continuación
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-sm">
          {!isSupabaseConfigured || !userId ? (
            <p className="text-muted">Necesitas una cuenta para enviar correcciones. Los envíos llegan a revisión y nunca se publican como verificados automáticamente.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-muted">
                  Temporada
                  <input className="k-input mt-1" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} />
                </label>
                <label className="text-xs text-muted">
                  Último cap. adaptado
                  <input className="k-input mt-1" inputMode="decimal" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                </label>
                <label className="text-xs text-muted">
                  Continuar en
                  <input className="k-input mt-1" inputMode="decimal" value={form.cont} onChange={(e) => setForm({ ...form, cont: e.target.value })} required />
                </label>
              </div>
              <label className="block text-xs text-muted">
                Fuentes públicas (URLs https, separadas por espacios)
                <textarea className="k-input mt-1 !min-h-16" value={form.sources} onChange={(e) => setForm({ ...form, sources: e.target.value })} />
              </label>
              <label className="block text-xs text-muted">
                Notas sin spoilers
                <textarea className="k-input mt-1 !min-h-16" maxLength={600} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              <button type="button" className="k-btn k-btn-primary k-btn-sm" onClick={submit} disabled={busy}>
                Enviar para revisión
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
