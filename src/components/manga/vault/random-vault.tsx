"use client";

import { Dices, Loader2, RotateCcw, SlidersHorizontal, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { MangaCard } from "@/lib/anilist/manga-types";
import { mangaApi } from "@/lib/manga/client-api";
import { DEFAULT_RANDOM_FILTERS, eligiblePool, pickRandom, poolQuery, randomPage, type RandomFilters } from "@/lib/manga/random";
import { LENGTHS, MANGA_FORMATS } from "@/lib/anilist/manga-params";
import { FALLBACK_GENRES, genreLabel } from "@/lib/anilist/browse-params";
import { useMangaLibrary } from "@/stores/manga";
import { useKazeMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { MangaVault, type VaultItem } from "./vault";
import { vaultItemFromCard } from "./items";

type Phase = "idle" | "loading" | "spinning" | "landed" | "empty" | "error";

/**
 * Random discovery: the server pool is built from the filters (random AniList page inside the result set),
 * the client re-applies every filter plus library exclusions, then a crypto-random winner is chosen
 * BEFORE the animation starts. The shelf only dramatizes a choice that was already fair.
 */
export function RandomVault() {
  const [filters, setFilters] = useState<RandomFilters>(DEFAULT_RANDOM_FILTERS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pool, setPool] = useState<MangaCard[]>([]);
  const [shelf, setShelf] = useState<VaultItem[]>([]);
  const [sel, setSel] = useState(0);
  const [winner, setWinner] = useState<MangaCard | null>(null);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const recent = useRef<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const library = useMangaLibrary((s) => s.entries);
  const upsert = useMangaLibrary((s) => s.upsert);
  const { reduced } = useKazeMotion();

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const set = <K extends keyof RandomFilters>(k: K, v: RandomFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const spin = async () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("loading");
    setWinner(null);
    try {
      // 1st call tells us how big the filtered result set is; 2nd call samples a random page of it.
      const first = await mangaApi.browse(poolQuery(filters, 1));
      const page = randomPage(first.pageInfo.total, 50, 20);
      const sample = page === 1 ? first : await mangaApi.browse(poolQuery(filters, page));
      let eligible = eligiblePool(sample.media, filters, library, recent.current);
      if (!eligible.length && page !== 1) eligible = eligiblePool(first.media, filters, library, recent.current);
      setEligibleCount(eligible.length);
      if (!eligible.length) {
        setPhase("empty");
        return;
      }
      const win = pickRandom(eligible)!;
      recent.current = [win.id, ...recent.current].slice(0, 8);
      setPool(eligible);
      animateTo(eligible, win);
    } catch {
      setPhase("error");
    }
  };

  const animateTo = (eligible: MangaCard[], win: MangaCard) => {
    const N = eligible.length;
    const w = eligible.findIndex((m) => m.id === win.id);
    if (reduced || N === 1) {
      setShelf(eligible.map((m) => vaultItemFromCard(m)));
      setSel(w);
      setWinner(win);
      setPhase("landed");
      return;
    }
    // Cyclic shelf: index i shows eligible[i % N], so the run can travel ~30 volumes and land on the winner.
    let target = w;
    while (target < 26) target += N;
    const items = Array.from({ length: target + 14 }, (_, i) => vaultItemFromCard(eligible[i % N], `${eligible[i % N].id}-${i}`));
    setShelf(items);
    setSel(0);
    setPhase("spinning");
    let t = 0;
    for (let k = 1; k <= target; k++) {
      const progress = k / target;
      t += 28 + 360 * Math.pow(progress, 3.2); // fast start, long deceleration
      timers.current.push(setTimeout(() => setSel(k), t));
    }
    timers.current.push(
      setTimeout(() => {
        setWinner(win);
        setPhase("landed");
      }, t + 380),
    );
  };

  const accept = () => {
    if (!winner) return;
    upsert(winner, { status: "PLANNING" });
    toast.success("Añadido a «Por leer»", { description: winner.title.english || winner.title.romaji || "" });
  };

  const genres = useMemo(() => FALLBACK_GENRES.filter((g) => g !== "Ecchi"), []);

  return (
    <div className="container-k pb-12 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="k-label text-primary-ink">運命の棚 · Ruleta de manga</p>
          <h1 className="km-title mt-2 text-title">¿Qué leo ahora?</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Elige filtros y gira. El ganador se sortea de forma aleatoria entre todos los títulos que cumplen tus filtros; la animación solo lo revela.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="k-btn k-btn-ghost" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="size-4" aria-hidden /> Filtros
          </button>
          <button type="button" className="k-btn k-btn-primary" onClick={spin} disabled={phase === "loading" || phase === "spinning"}>
            {phase === "loading" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Dices className="size-4" aria-hidden />}
            {phase === "landed" ? "Girar otra vez" : "Girar la ruleta"}
          </button>
        </div>
      </header>

      {showFilters && (
        <section aria-label="Filtros de la ruleta" className="km-frame mt-6 grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
          <fieldset className="xl:col-span-2">
            <legend className="k-label mb-2 text-muted">Géneros (todos los marcados)</legend>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <button key={g} type="button" className="k-chip" aria-pressed={filters.genres.includes(g)} onClick={() => set("genres", filters.genres.includes(g) ? filters.genres.filter((x) => x !== g) : [...filters.genres, g])}>
                  {genreLabel(g)}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted">
              Formato
              <select className="k-input mt-1" value={filters.format ?? ""} onChange={(e) => set("format", (e.target.value || null) as RandomFilters["format"])}>
                <option value="">Cualquiera</option>
                {MANGA_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Origen
              <select className="k-input mt-1" value={filters.country ?? ""} onChange={(e) => set("country", (e.target.value || null) as RandomFilters["country"])}>
                <option value="">Cualquiera</option>
                <option value="JP">Manga (Japón)</option>
                <option value="KR">Manhwa (Corea)</option>
                <option value="CN">Manhua (China)</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Estado
              <select className="k-input mt-1" value={filters.status ?? ""} disabled={filters.completedOnly} onChange={(e) => set("status", (e.target.value || null) as RandomFilters["status"])}>
                <option value="">Cualquiera</option>
                <option value="RELEASING">En publicación</option>
                <option value="FINISHED">Finalizado</option>
                <option value="HIATUS">En pausa</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Extensión
              <select className="k-input mt-1" value={filters.length ?? ""} onChange={(e) => set("length", (e.target.value || null) as RandomFilters["length"])}>
                <option value="">Cualquiera</option>
                {LENGTHS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted">
              Desde el año
              <input type="number" inputMode="numeric" min={1950} max={2100} className="k-input mt-1" value={filters.yearFrom ?? ""} onChange={(e) => set("yearFrom", e.target.value ? Number(e.target.value) : null)} />
            </label>
            <label className="text-xs text-muted">
              Hasta el año
              <input type="number" inputMode="numeric" min={1950} max={2100} className="k-input mt-1" value={filters.yearTo ?? ""} onChange={(e) => set("yearTo", e.target.value ? Number(e.target.value) : null)} />
            </label>
            <label className="text-xs text-muted">
              Puntuación mínima
              <select className="k-input mt-1" value={filters.minScore ?? ""} onChange={(e) => set("minScore", e.target.value ? Number(e.target.value) : null)}>
                <option value="">Cualquiera</option>
                {[60, 70, 75, 80, 85].map((s) => (
                  <option key={s} value={s}>
                    {s}%+
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Popularidad
              <select className="k-input mt-1" value={filters.popularity} onChange={(e) => set("popularity", e.target.value as RandomFilters["popularity"])}>
                <option value="any">Cualquiera</option>
                <option value="popular">Muy populares</option>
                <option value="niche">Poco conocidos</option>
              </select>
            </label>
          </div>
          <fieldset className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
            <legend className="sr-only">Exclusiones</legend>
            {(
              [
                ["completedOnly", "Solo series completas"],
                ["excludeRead", "Excluir lo que ya leí"],
                ["excludeLibrary", "Excluir mi biblioteca"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="k-chip cursor-pointer">
                <input type="checkbox" className="sr-only" checked={filters[k]} onChange={(e) => set(k, e.target.checked)} />
                {l}
              </label>
            ))}
            <button type="button" className="k-btn k-btn-ghost k-btn-sm ml-auto" onClick={() => setFilters(DEFAULT_RANDOM_FILTERS)}>
              <RotateCcw className="size-4" aria-hidden /> Restablecer
            </button>
          </fieldset>
        </section>
      )}

      <div className="mt-8" aria-live="polite" aria-busy={phase === "loading" || phase === "spinning"}>
        {phase === "idle" && (
          <div className="km-frame km-stage relative grid min-h-80 place-items-center overflow-hidden p-10 text-center">
            <div aria-hidden className="km-tone km-tone-fade absolute inset-0 opacity-50" />
            <div className="relative">
              <Dices className="mx-auto size-10 text-primary-ink" aria-hidden />
              <p className="km-title mt-4 text-2xl">La estantería espera</p>
              <p className="mt-2 text-sm text-muted">Pulsa «Girar la ruleta» para sortear un manga entre los que cumplen tus filtros.</p>
            </div>
          </div>
        )}
        {phase === "loading" && <div className="k-skeleton h-[420px]" />}
        {phase === "empty" && (
          <p role="status" className="km-frame p-8 text-center text-sm text-muted">
            Ningún manga cumple todos estos filtros en la muestra consultada. Prueba a quitar algún filtro o a girar otra vez.
          </p>
        )}
        {phase === "error" && (
          <p role="alert" className="km-frame p-8 text-center text-sm text-danger">
            AniList no respondió. Inténtalo de nuevo en un momento.
          </p>
        )}
        {(phase === "spinning" || phase === "landed") && (
          <div className={cn(phase === "spinning" && !reduced && "[animation:km-spin-blur_0.6s_ease-in-out_infinite]")}>
            <MangaVault
              items={shelf}
              label="Ruleta de manga"
              selected={sel}
              onSelect={phase === "landed" ? setSel : () => {}}
              spinning={phase === "spinning"}
              showListToggle={phase === "landed"}
              actions={(item) =>
                winner && item.id === winner.id ? (
                  <>
                    <button type="button" className="k-btn k-btn-primary" onClick={accept}>
                      <ThumbsUp className="size-4" aria-hidden /> Aceptar
                    </button>
                    <button type="button" className="k-btn k-btn-ghost" onClick={spin}>
                      <Dices className="size-4" aria-hidden /> Girar otra vez
                    </button>
                  </>
                ) : null
              }
            />
            {phase === "landed" && winner && (
              <p className="sr-only" role="status">
                Ha salido {winner.title.english || winner.title.romaji}.
              </p>
            )}
            {phase === "landed" && eligibleCount != null && (
              <p className="mt-4 text-center text-xs text-muted">
                Sorteado entre {eligibleCount} títulos que cumplen tus filtros{pool.length ? "" : ""}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
