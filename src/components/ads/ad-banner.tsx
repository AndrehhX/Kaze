"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Coffee, X, ShieldCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_AD_CONFIG, isAdDismissed, dismissAd } from "@/lib/ads/config";

interface AdBannerProps {
  placement?: string;
  className?: string;
  customBannerUrl?: string;
}

export function AdBanner({
  placement = "player-bottom",
  className,
  customBannerUrl,
}: AdBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [adBlocked, setAdBlocked] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(isAdDismissed(placement));
  }, [placement]);

  if (!DEFAULT_AD_CONFIG.enabled || (mounted && dismissed)) {
    return null;
  }

  const handleDismiss = () => {
    dismissAd(placement, 24);
    setDismissed(true);
  };

  const adUrl = customBannerUrl || DEFAULT_AD_CONFIG.customBannerUrl || DEFAULT_AD_CONFIG.adsterraBannerUrl;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "w-full max-w-4xl mx-auto rounded-2xl border border-line/60 bg-surface/40 backdrop-blur-md overflow-hidden relative transition-all duration-300 shadow-sm",
            className
          )}
        >
          {/* Barra superior de identificación y descarte */}
          <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-line/40 bg-elevated/40 text-[0.6875rem] text-muted">
            <div className="flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <ShieldCheck className="size-3 text-primary/80" aria-hidden />
              <span>Espacio Patrocinado · Sin anuncios invasivos</span>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="flex items-center gap-1 text-muted/70 hover:text-fg transition-colors px-1.5 py-0.5 rounded hover:bg-line/40"
              title="Ocultar anuncio durante 24 horas"
              aria-label="Ocultar anuncio por 24 horas"
            >
              <span className="hidden sm:inline text-[0.625rem]">Ocultar por 24h</span>
              <X className="size-3" />
            </button>
          </div>

          {/* Contenido del Anuncio */}
          <div className="p-3 sm:p-4 min-h-[96px] flex items-center justify-center">
            {adUrl && !adBlocked ? (
              <div className="w-full max-w-[728px] h-[90px] mx-auto overflow-hidden flex items-center justify-center">
                <iframe
                  src={adUrl}
                  title="Espacio publicitario Kaze"
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  loading="lazy"
                  onError={() => setAdBlocked(true)}
                />
              </div>
            ) : (
              /* Banner de patrocinio nativo y elegante de Kaze */
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full px-2 sm:px-4 py-1">
                <div className="flex items-center gap-3.5 text-left min-w-0">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 via-accent/15 to-primary/5 border border-primary/30 flex items-center justify-center shrink-0 shadow-inner">
                    <Sparkles className="size-5 text-primary animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg flex items-center gap-2">
                      <span>¿Te gusta disfrutar de anime en 1080p sin cortes?</span>
                    </p>
                    <p className="text-xs text-muted mt-0.5 max-w-xl line-clamp-2">
                      Kaze no usa popups molestos ni ventanas trampa. Tu apoyo en Ko-fi financia los servidores de streaming y proxies.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                  <a
                    href={DEFAULT_AD_CONFIG.kofiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="k-btn k-btn-primary k-btn-sm text-xs font-semibold px-3.5 py-1.5 shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Coffee className="size-3.5 text-white" />
                    <span>Apoyar en Ko-fi</span>
                  </a>
                  <a
                    href="mailto:thealex230820@gmail.com?subject=Patrocinio%20en%20Kaze%20Anime"
                    className="k-btn k-btn-ghost k-btn-sm text-xs border border-line/50 hover:bg-elevated px-3 py-1.5 inline-flex items-center gap-1 text-muted hover:text-fg whitespace-nowrap"
                    title="Contratar este espacio publicitario directamente"
                  >
                    <span>Anunciarse</span>
                    <ExternalLink className="size-3 opacity-60" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
