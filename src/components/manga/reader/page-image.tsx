"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { ReadingAsset } from "@/lib/manga/catalog";
import { cn } from "@/lib/utils";

/**
 * One manga page. Aspect ratio is reserved up-front (no layout shift), artwork is never cropped
 * (object-contain), and a failed load can be retried in place.
 */
export function PageImage({ asset, dataSaver, className, style, eager, onLoad }: { asset: ReadingAsset; dataSaver: boolean; className?: string; style?: React.CSSProperties; eager?: boolean; onLoad?: () => void }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const base = dataSaver && asset.srcLow ? asset.srcLow : asset.src;
  const src = attempt ? `${base}${base.includes("?") ? "&" : "?"}retry=${attempt}` : base;
  return (
    <div className={cn("relative", className)} style={{ aspectRatio: `${asset.width} / ${asset.height}`, ...style }}>
      {state !== "ok" && state !== "error" && <div className="k-skeleton absolute inset-0 !rounded-none" aria-hidden />}
      {state === "error" ? (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 p-4 text-center text-sm text-white">
          <p>No se pudo cargar la página {asset.index + 1}.</p>
          <button
            type="button"
            className="k-btn k-btn-primary k-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
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
            // An image can finish loading before hydration attaches onLoad; settle its state from the element itself.
            if (img?.complete && state === "loading") {
              if (img.naturalWidth > 0) {
                setState("ok");
                onLoad?.();
              } else setState("error");
            }
          }}
          src={src}
          alt={asset.alt}
          width={asset.width}
          height={asset.height}
          draggable={false}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => {
            setState("ok");
            onLoad?.();
          }}
          onError={() => setState("error")}
          className={cn("km-page-img size-full object-contain transition-opacity duration-300", state === "ok" ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}
