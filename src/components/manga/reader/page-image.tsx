"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { ReadingAsset } from "@/lib/manga/catalog";
import { cn } from "@/lib/utils";

/**
 * One manga page. Aspect ratio is reserved up-front (no layout shift), artwork is never cropped
 * (object-contain), and automatically adopts natural aspect ratio when loaded so webtoons and spreads
 * are never distorted or artificially squeezed.
 */
export function PageImage({
  asset,
  dataSaver,
  className,
  style,
  eager,
  onLoad,
  onSize,
}: {
  asset: ReadingAsset;
  dataSaver: boolean;
  className?: string;
  style?: React.CSSProperties;
  eager?: boolean;
  onLoad?: () => void;
  /** Real pixel size once decoded (providers such as MangaDex do not report page sizes up-front). */
  onSize?: (width: number, height: number) => void;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [aspect, setAspect] = useState<string | null>(null);
  // Auto fallback to compressed data-saver version if original uncompressed fails (common on MangaDex@Home nodes)
  const [useSaverFallback, setUseSaverFallback] = useState(false);

  const activeSrc = (dataSaver || useSaverFallback) && asset.srcLow ? asset.srcLow : asset.src;
  const src = attempt ? `${activeSrc}${activeSrc.includes("?") ? "&" : "?"}retry=${attempt}` : activeSrc;

  const handleError = () => {
    // Tier 1 fallback: if high-res failed and low-res/saver exists, try low-res automatically without error UI
    if (!useSaverFallback && !dataSaver && asset.srcLow) {
      setUseSaverFallback(true);
      setState("loading");
      return;
    }
    // Tier 2: one automatic cache-busting retry before showing error banner
    if (attempt === 0) {
      setAttempt(1);
      setState("loading");
      return;
    }
    setState("error");
  };

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{
        aspectRatio: aspect ?? (asset.width && asset.height ? `${asset.width} / ${asset.height}` : undefined),
        ...style,
      }}
    >
      {state !== "ok" && state !== "error" && <div className="k-skeleton absolute inset-0 !rounded-none" aria-hidden />}
      {state === "error" ? (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 p-4 text-center text-sm text-white">
          <p>No se pudo cargar la página {asset.index + 1}.</p>
          <button
            type="button"
            className="k-btn k-btn-primary k-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setUseSaverFallback(false);
              setState("loading");
              setAttempt((a) => a + 1);
            }}
          >
            <RefreshCw className="size-4" aria-hidden /> Reintentar
          </button>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          ref={(img) => {
            if (img?.complete && state === "loading") {
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setAspect(`${img.naturalWidth} / ${img.naturalHeight}`);
                setState("ok");
                onSize?.(img.naturalWidth, img.naturalHeight);
                onLoad?.();
              } else {
                handleError();
              }
            }
          }}
          src={src}
          alt={asset.alt}
          draggable={false}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setAspect(`${img.naturalWidth} / ${img.naturalHeight}`);
              onSize?.(img.naturalWidth, img.naturalHeight);
            }
            setState("ok");
            onLoad?.();
          }}
          onError={handleError}
          className={cn("km-page-img max-h-full max-w-full object-contain transition-opacity duration-300", state === "ok" ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}
