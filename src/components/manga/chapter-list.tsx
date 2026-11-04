"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowDownUp, BookOpen, Clock, ExternalLink, Loader2, Search, Users } from "lucide-react";
import type { MangaChapter } from "@/lib/anilist/types";

interface ChapterListProps {
  mangaId: number;
  title: string;
  romaji?: string | null;
  english?: string | null;
}

export function ChapterList({ mangaId, title, romaji, english }: ChapterListProps) {
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [orderAsc, setOrderAsc] = useState(false); // Default to newest first

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (title) params.set("title", title);
        if (english) params.set("english", english);
        if (romaji) params.set("romaji", romaji);

        const res = await fetch(`/api/manga/chapters?${params.toString()}`);
        if (!res.ok) throw new Error("Error al obtener capítulos");

        const data = await res.json();
        if (active) {
          setChapters(data.chapters || []);
        }
      } catch (err) {
        if (active) {
          setError((err as Error).message || "No se pudieron cargar los capítulos");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [title, english, romaji]);

  const filteredChapters = useMemo(() => {
    let list = [...chapters];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.chapter.toLowerCase().includes(q) ||
          (c.title && c.title.toLowerCase().includes(q)) ||
          (c.scanlationGroup && c.scanlationGroup.toLowerCase().includes(q))
      );
    }

    if (!orderAsc) {
      list.reverse();
    }

    return list;
  }, [chapters, query, orderAsc]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted">
        <Loader2 className="size-8 animate-spin text-primary-ink mb-3" />
        <p className="text-sm">Buscando capítulos disponibles en MangaDex...</p>
      </div>
    );
  }

  if (error || chapters.length === 0) {
    return (
      <div className="rounded-[var(--k-radius-card)] border border-border/40 bg-surface/40 p-8 text-center backdrop-blur">
        <BookOpen className="size-10 mx-auto text-muted mb-3 opacity-60" />
        <h3 className="text-base font-semibold">No se encontraron capítulos en español</h3>
        <p className="mt-1 text-sm text-muted max-w-md mx-auto">
          Esta obra aún no tiene traducciones al español indexadas en MangaDex o los nombres difieren en la base de datos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar capítulo..."
            className="k-input w-full pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => setOrderAsc((prev) => !prev)}
            className="k-btn k-btn-ghost k-btn-sm"
            title={orderAsc ? "Mostrando: Primero al Último" : "Mostrando: Último al Primero"}
          >
            <ArrowDownUp className="size-4" />
            <span className="text-xs">{orderAsc ? "Ascendente (1 → N)" : "Descendente (N → 1)"}</span>
          </button>
          <span className="text-xs text-muted ml-2">
            {filteredChapters.length} {filteredChapters.length === 1 ? "capítulo" : "capítulos"}
          </span>
        </div>
      </div>

      {/* Chapters Grid */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filteredChapters.map((ch) => (
          <Link
            key={ch.id}
            href={`/manga/${mangaId}/read/${ch.id}`}
            prefetch={false}
            className="group flex flex-col justify-between rounded-[var(--k-radius-card)] border border-border/40 bg-surface/30 p-3.5 transition-all hover:border-primary/50 hover:bg-surface/80 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-sm group-hover:text-primary-ink transition-colors">
                Capítulo {ch.chapter}
              </span>
              {ch.language && (
                <span className="k-chip !py-0 !px-1.5 text-[0.625rem] uppercase text-muted">
                  {ch.language}
                </span>
              )}
            </div>

            {ch.title && (
              <p className="mt-1 line-clamp-1 text-xs text-muted group-hover:text-fg/80">
                {ch.title}
              </p>
            )}

            <div className="mt-2.5 flex items-center justify-between text-[0.6875rem] text-muted/80">
              {ch.scanlationGroup ? (
                <span className="flex items-center gap-1 line-clamp-1" title={ch.scanlationGroup}>
                  <Users className="size-3 shrink-0" />
                  <span className="truncate">{ch.scanlationGroup}</span>
                </span>
              ) : (
                <span />
              )}
              {ch.publishedAt && (
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="size-3" />
                  <span>{new Date(ch.publishedAt).toLocaleDateString()}</span>
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
