"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";

/** Temporada del Wrapped: del 20 de noviembre al 31 de enero (fecha local del navegador). */
export function isWrappedSeason(d = new Date()) {
  const m = d.getMonth();
  return (m === 10 && d.getDate() >= 20) || m === 11 || m === 0;
}

const noopSubscribe = () => () => {};

export function WrappedHint() {
  // En el servidor (página pre-generada) no se muestra; en el navegador según la fecha local.
  const show = useSyncExternalStore(noopSubscribe, () => isWrappedSeason(), () => false);
  if (!show) return null;
  return (
    <div className="container-k mt-10">
      <Link
        href="/wrapped"
        className="k-card group relative flex items-center gap-4 overflow-hidden p-5 transition-shadow hover:shadow-[var(--k-hover-glow)]"
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_10%_20%,var(--k-primary),transparent_55%),radial-gradient(circle_at_90%_80%,var(--k-accent),transparent_50%)]" />
        <Sparkles className="relative size-7 text-primary-ink" aria-hidden />
        <div className="relative flex-1">
          <p className="font-display text-xl">Tu KAZE Wrapped 2026 ya está listo</p>
          <p className="text-sm text-muted">Horas vistas, tus animes del año, tu género favorito y tu personalidad otaku. ¡Compártelo!</p>
        </div>
        <ArrowUpRight className="relative size-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden />
      </Link>
    </div>
  );
}
