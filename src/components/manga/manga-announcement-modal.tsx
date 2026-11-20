"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { useKazeMotion } from "@/lib/motion";

const STORAGE_KEY = "kaze_manga_announcement_v2";

export function MangaAnnouncementModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { reduced } = useKazeMotion();

  useEffect(() => {
    try {
      const alreadySeen = localStorage.getItem(STORAGE_KEY);
      if (alreadySeen) return;
    } catch {
      return;
    }

    if (typeof window !== "undefined") {
      const p = window.location.pathname;
      if (p.startsWith("/watch/") || p.startsWith("/manga/read/")) {
        return;
      }
    }

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 900);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // noop
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manga-announcement-title"
        >
          {/* Overlay nativo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.05 : 0.2 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/60 backdrop-blur-[3px]"
            aria-hidden="true"
          />

          {/* Panel con estilos nativos k-panel de la aplicación */}
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
            transition={
              reduced
                ? { duration: 0.1 }
                : { type: "spring", stiffness: 380, damping: 32 }
            }
            className="k-panel relative w-full max-w-[460px] overflow-hidden !bg-surface !p-0 shadow-2xl"
          >
            {/* Banner de imagen limpio */}
            <div className="relative aspect-[22/8] w-full overflow-hidden bg-surface-elevated">
              <Image
                src="/announcements/manga-banner.jpg"
                alt="KAZE Manga"
                fill
                priority
                className="object-cover object-center"
                sizes="(max-width: 640px) 100vw, 460px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />

              {/* Botón de cierre nativo k-btn */}
              <button
                type="button"
                onClick={handleDismiss}
                className="k-btn k-btn-ghost k-btn-icon k-btn-sm absolute right-3 top-3 z-10 !bg-surface/70 !backdrop-blur-md"
                aria-label="Cerrar anuncio"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Contenido con tipografía y tokens nativos */}
            <div className="p-5 sm:p-6">
              <p className="k-label text-primary-ink">Novedad · Catálogo</p>

              <h2
                id="manga-announcement-title"
                className="font-display mt-1 text-2xl font-semibold leading-tight text-fg"
              >
                Sección de Manga ya disponible
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-muted">
                Ya está integrada la lectura de manga en la plataforma. Puedes continuar tus series favoritas, acceder a capítulos en español latino, castellano e inglés, y sincronizar tu progreso en la biblioteca.
              </p>

              {/* Chips nativos */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="k-chip">Lector vertical y paginado</span>
                <span className="k-chip">Español & English</span>
                <span className="k-chip">Continuar desde el anime</span>
              </div>

              {/* Acciones nativas */}
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href="/manga"
                  onClick={handleDismiss}
                  className="k-btn k-btn-primary w-full justify-center py-2.5 text-sm"
                >
                  <span>Explorar catálogo de manga</span>
                  <ArrowRight className="size-4" />
                </Link>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="k-btn k-btn-ghost w-full justify-center text-xs text-muted"
                >
                  No volver a mostrar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
