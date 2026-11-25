"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { useKazeMotion } from "@/lib/motion";
import { DISCORD_INVITE_URL } from "./nav-config";

const STORAGE_KEY = "kaze_discord_community_modal_v1";

export function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function DiscordAnnouncementModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { reduced } = useKazeMotion();

  useEffect(() => {
    try {
      const alreadySeen = localStorage.getItem(STORAGE_KEY);
      if (alreadySeen) return;
    } catch {
      return;
    }

    // Solo en la portada, nunca al llegar a una ficha o un episodio (p. ej. desde Google),
    // como mucho un aviso por visita y tras unos segundos para no tapar la carga.
    if (window.location.pathname !== "/") return;
    try {
      if (sessionStorage.getItem("kaze_modal_shown")) return;
    } catch {}

    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem("kaze_modal_shown", "discord");
      } catch {}
      setIsOpen(true);
    }, 8000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      // noop
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[125] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discord-announcement-title"
        >
          {/* Overlay nativo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.05 : 0.2 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/65 backdrop-blur-[4px]"
            aria-hidden="true"
          />

          {/* Panel modal */}
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={
              reduced
                ? { duration: 0.1 }
                : { type: "spring", stiffness: 380, damping: 32 }
            }
            className="k-panel relative w-full max-w-[480px] overflow-hidden !bg-surface !p-0 shadow-2xl border border-line/60"
          >
            {/* Banner superior */}
            <div className="relative aspect-[2.6/1] w-full overflow-hidden bg-surface-elevated">
              <Image
                src="/announcements/discord-banner.jpg"
                alt="Comunidad Discord Orunei"
                fill
                priority
                className="object-cover object-center"
                sizes="(max-width: 640px) 100vw, 480px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/15 to-transparent" />

              {/* Botón de cierre */}
              <button
                type="button"
                onClick={handleDismiss}
                className="k-btn k-btn-ghost k-btn-icon k-btn-sm absolute right-3 top-3 z-10 !bg-surface/80 !backdrop-blur-md hover:!bg-surface text-fg"
                aria-label="Cerrar anuncio"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <span className="k-label text-[#5865F2] font-semibold flex items-center gap-1.5">
                  <DiscordIcon className="size-3.5 fill-[#5865F2]" />
                  Comunidad Oficial · 公式コミュニティ
                </span>
              </div>

              <h2
                id="discord-announcement-title"
                className="font-display mt-1 text-2xl font-bold leading-tight text-fg tracking-tight"
              >
                Únete a nuestro Discord
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-muted">
                ¡Entra al servidor oficial de <span className="text-fg font-medium">Pan con mantequilla × Orunei</span>! Disfruta de Watch Parties en vivo, comenta los episodios semanales de anime, comparte memes y entérate antes que nadie de las novedades de la web y de la app KAZE Mobile.
              </p>

              {/* Chips temáticos */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="k-chip border-[#5865F2]/20 text-xs">🍿 Watch Parties en vivo</span>
                <span className="k-chip text-xs">💬 Anime & Manga chat</span>
                <span className="k-chip text-xs">🌟 Beta Testers KAZE APK</span>
                <span className="k-chip text-xs">🧈 Pan con mantequilla</span>
              </div>

              {/* Acciones */}
              <div className="mt-6 flex flex-col gap-2">
                <a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleDismiss}
                  className="k-btn w-full justify-center py-2.5 text-sm bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium shadow-[0_0_20px_rgba(88,101,242,0.35)] transition-all flex items-center gap-2 rounded-[var(--k-radius-btn)]"
                >
                  <DiscordIcon className="size-4 fill-white" />
                  <span>Unirme al servidor de Discord</span>
                  <ArrowRight className="size-4 ml-auto" />
                </a>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="k-btn k-btn-ghost w-full justify-center text-xs text-muted hover:text-fg"
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
