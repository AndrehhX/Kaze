"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[kaze] route error", error.message);
  }, [error]);
  const anilist = /anilist|rate limit/i.test(error.message);
  return (
    <div className="container-k grid min-h-[60dvh] place-items-center py-20 text-center">
      <div role="alert" className="max-w-lg">
        <p className="k-jp text-7xl text-primary-ink" lang="ja" aria-hidden>
          嵐
        </p>
        <h1 className="font-display text-title mt-4">{anilist ? "El catálogo está recuperando el aliento" : "Algo salió mal"}</h1>
        <p className="mt-3 text-muted">
          {anilist
            ? "AniList está limitando las peticiones o no responde ahora mismo. Tu biblioteca y el reproductor de demostración siguen funcionando: inténtalo de nuevo en un minuto."
            : "Un error inesperado interrumpió esta página. Puedes reintentar o volver al inicio."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="k-btn k-btn-primary" onClick={reset}>
            Reintentar
          </button>
          <Link href="/library" className="k-btn k-btn-ghost">
            Abrir mi biblioteca
          </Link>
        </div>
      </div>
    </div>
  );
}
