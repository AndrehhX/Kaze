"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns,
  Maximize2,
  Minimize2,
  Rows,
  Loader2,
  AlertCircle,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import type { MangaChapter, MangaPage } from "@/lib/anilist/types";
import { AdBanner } from "@/components/ads/ad-banner";

interface MangaReaderProps {
  mangaId: number;
  chapterId: string;
  mangaTitle: string;
  mangaRomaji?: string | null;
  mangaEnglish?: string | null;
}

export function MangaReader({
  mangaId,
  chapterId,
  mangaTitle,
  mangaRomaji,
  mangaEnglish,
}: MangaReaderProps) {
  const router = useRouter();
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<MangaChapter | null>(null);

  // Reader Settings
  const [mode, setMode] = useState<"cascade" | "paginated">("cascade");
  const [currentPage, setCurrentPage] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch pages for current chapter
  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/manga/pages?chapterId=${chapterId}`);
      if (!res.ok) throw new Error("No se pudieron cargar las páginas de este capítulo");
      const data = await res.json();
      if (!data.pages || data.pages.length === 0) {
        throw new Error("Este capítulo no contiene páginas legibles en este momento.");
      }
      setPages(data.pages);
      setCurrentPage(1);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (err) {
      setError((err as Error).message || "Error al cargar las páginas");
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // 2. Fetch chapter list for navigation & context
  useEffect(() => {
    let active = true;
    async function loadChapters() {
      try {
        const params = new URLSearchParams();
        if (mangaTitle) params.set("title", mangaTitle);
        if (mangaEnglish) params.set("english", mangaEnglish);
        if (mangaRomaji) params.set("romaji", mangaRomaji);

        const res = await fetch(`/api/manga/chapters?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.chapters) {
          setChapters(data.chapters);
          const found = data.chapters.find((c: MangaChapter) => c.id === chapterId);
          if (found) setCurrentChapter(found);
        }
      } catch (err) {
        console.warn("Could not load chapter list for reader:", err);
      }
    }
    loadChapters();
    return () => {
      active = false;
    };
  }, [chapterId, mangaTitle, mangaEnglish, mangaRomaji]);

  // Next / Prev chapter navigation
  const currentIndex = chapters.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation for paginated mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === "paginated") {
        if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
          setCurrentPage((p) => Math.min(pages.length, p + 1));
        } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
          setCurrentPage((p) => Math.max(1, p - 1));
        }
      }
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, pages.length]);

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-white select-none">
      {/* Sticky Reader Header */}
      <header
        className={`sticky top-0 z-50 transition-transform duration-300 backdrop-blur-md bg-black/85 border-b border-white/10 ${
          showControls ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="container-k flex h-14 items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/manga/${mangaId}`}
              className="k-btn k-btn-ghost k-btn-icon !text-white/80 hover:!text-white shrink-0"
              title="Volver al detalle del manga"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate text-white">{mangaTitle}</h1>
              <p className="text-xs text-white/60 truncate">
                {currentChapter ? `Capítulo ${currentChapter.chapter}` : "Lector de Manga"}
                {currentChapter?.title ? ` - ${currentChapter.title}` : ""}
              </p>
            </div>
          </div>

          {/* Quick Chapter Selector & Mode Switch */}
          <div className="flex items-center gap-2">
            {chapters.length > 0 && (
              <select
                value={chapterId}
                onChange={(e) => router.push(`/manga/${mangaId}/read/${e.target.value}`)}
                className="k-input !h-8 !py-0 !px-2 text-xs !bg-white/10 !border-white/20 !text-white max-w-[130px] sm:max-w-[180px] rounded"
              >
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id} className="bg-neutral-900 text-white">
                    Cap. {ch.chapter} {ch.title ? `- ${ch.title}` : ""}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setMode((m) => (m === "cascade" ? "paginated" : "cascade"))}
              className="k-btn k-btn-ghost k-btn-sm !text-white/80 hover:!text-white hidden sm:flex items-center gap-1.5"
              title={mode === "cascade" ? "Cambiar a modo paginado" : "Cambiar a cascada (webtoon)"}
            >
              {mode === "cascade" ? <Rows className="size-4" /> : <Columns className="size-4" />}
              <span className="text-xs">{mode === "cascade" ? "Cascada" : "Paginado"}</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="k-btn k-btn-ghost k-btn-icon !text-white/80 hover:!text-white shrink-0"
              title="Pantalla completa"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)]">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 text-muted">
            <Loader2 className="size-10 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Cargando páginas desde MangaDex CDN...</p>
          </div>
        )}

        {error && (
          <div className="p-8 text-center max-w-md mx-auto">
            <AlertCircle className="size-12 mx-auto text-red-400 mb-3" />
            <h2 className="text-lg font-semibold text-white">Error al cargar capítulo</h2>
            <p className="mt-2 text-sm text-neutral-400">{error}</p>
            <button
              onClick={() => fetchPages()}
              className="k-btn k-btn-primary mt-5 mx-auto"
            >
              <RefreshCw className="size-4" /> Reintentar
            </button>
          </div>
        )}

        {!loading && !error && pages.length > 0 && (
          <>
            {mode === "cascade" ? (
              /* Modo Cascada (Continuo Vertical - Webtoon Style) */
              <div className="w-full max-w-3xl flex flex-col items-center">
                {pages.map((p) => (
                  <div key={p.pageNumber} className="w-full relative bg-neutral-950 min-h-[300px]">
                    <img
                      src={p.url}
                      alt={`Página ${p.pageNumber}`}
                      loading="lazy"
                      className="w-full h-auto object-contain block"
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-[0.625rem] text-white/60 pointer-events-none">
                      {p.pageNumber}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Modo Paginado (Una página a la vez) */
              <div
                className="w-full max-w-4xl flex flex-col items-center justify-center flex-1 py-4 px-2 cursor-pointer"
                onClick={() => setCurrentPage((p) => Math.min(pages.length, p + 1))}
              >
                <div className="relative max-h-[85vh] flex items-center justify-center">
                  <img
                    src={pages[currentPage - 1]?.url}
                    alt={`Página ${currentPage}`}
                    className="max-h-[85vh] w-auto max-w-full object-contain shadow-2xl rounded"
                  />
                </div>

                {/* Page indicator & pagination bar */}
                <div
                  className="mt-4 flex items-center gap-4 bg-neutral-900/80 px-4 py-2 rounded-full border border-white/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="k-btn k-btn-ghost k-btn-icon disabled:opacity-30"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <span className="text-xs font-medium text-white/90">
                    {currentPage} / {pages.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= pages.length}
                    onClick={() => setCurrentPage((p) => Math.min(pages.length, p + 1))}
                    className="k-btn k-btn-ghost k-btn-icon disabled:opacity-30"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Chapter End & Navigation Footer */}
            <div className="w-full max-w-3xl px-4 py-12 flex flex-col items-center text-center space-y-6">
              <div className="h-px w-full bg-white/10" />

              <p className="text-sm text-neutral-400">
                Has completado el <span className="text-white font-medium">Capítulo {currentChapter?.chapter ?? ""}</span>
              </p>

              {/* Non-invasive AdBanner at chapter end */}
              <div className="w-full flex justify-center py-2">
                <AdBanner placement="home-bottom" />
              </div>

              {/* Prev / Next chapter buttons */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                {prevChapter && (
                  <Link
                    href={`/manga/${mangaId}/read/${prevChapter.id}`}
                    className="k-btn k-btn-ghost"
                  >
                    <ChevronLeft className="size-4" /> Cap. Anterior ({prevChapter.chapter})
                  </Link>
                )}

                <Link href={`/manga/${mangaId}`} className="k-btn k-btn-ghost">
                  <BookOpen className="size-4" /> Lista de Capítulos
                </Link>

                {nextChapter ? (
                  <Link
                    href={`/manga/${mangaId}/read/${nextChapter.id}`}
                    className="k-btn k-btn-primary"
                  >
                    Siguiente Capítulo ({nextChapter.chapter}) <ChevronRight className="size-4" />
                  </Link>
                ) : (
                  <span className="text-xs text-neutral-500 py-2">¡Estás al día con este manga!</span>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
