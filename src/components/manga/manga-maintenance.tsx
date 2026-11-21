"use client";

import Link from "next/link";
import { Wrench, Compass, Home, Film, Sparkles, MessageSquare } from "lucide-react";
import { DISCORD_INVITE_URL } from "@/components/shell/nav-config";
import { DiscordIcon } from "@/components/shell/discord-announcement-modal";

export function MangaMaintenance() {
  return (
    <div className="container-k py-12 md:py-20 flex min-h-[70vh] flex-col items-center justify-center text-center">
      {/* Badge superior */}
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary-ink mb-6 shadow-sm">
        <Wrench className="size-3.5 text-primary" aria-hidden />
        <span>Optimización en progreso · 漫画 メンテナンス中</span>
      </div>

      {/* Título Principal */}
      <h1 className="font-display max-w-2xl text-3xl font-bold tracking-tight text-fg sm:text-5xl">
        Sección de Manga en <span className="text-primary-ink">Mantenimiento</span>
      </h1>

      {/* Descripción */}
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
        Estamos optimizando a fondo el motor de lectura, la velocidad de carga de las páginas y la integración de catálogos para ofrecerte una experiencia fluida e impecable. La lectura de manga volverá a estar disponible muy pronto.
      </p>

      {/* Tarjeta de estado de servicios */}
      <div className="k-panel mt-8 w-full max-w-lg p-5 text-left border border-line/60 bg-surface/80 backdrop-blur-md shadow-xl">
        <p className="k-label text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          Estado del servicio
        </p>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-line/40 pb-2">
            <span className="flex items-center gap-2 text-fg">
              <Film className="size-4 text-emerald-400" />
              Catálogo y Streaming de Anime
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              100% Operativo
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-line/40 pb-2">
            <span className="flex items-center gap-2 text-fg">
              <Sparkles className="size-4 text-emerald-400" />
              Salas de Cine & Watch Parties
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              100% Operativo
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-fg">
              <Wrench className="size-4 text-amber-400" />
              Lector y Catálogo de Manga
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-400" />
              En Mantenimiento
            </span>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/discover"
          className="k-btn k-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
        >
          <Compass className="size-4" />
          <span>Ver catálogo de anime</span>
        </Link>

        <Link
          href="/"
          className="k-btn k-btn-outline flex items-center gap-2 px-5 py-2.5 text-sm"
        >
          <Home className="size-4" />
          <span>Ir al inicio</span>
        </Link>

        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="k-btn k-btn-ghost flex items-center gap-2 px-4 py-2.5 text-sm text-[#5865F2] hover:text-[#5865F2] border border-[#5865F2]/30 bg-[#5865F2]/5 hover:bg-[#5865F2]/10"
        >
          <DiscordIcon className="size-4 fill-[#5865F2]" />
          <span>Avisos en Discord</span>
        </a>
      </div>
    </div>
  );
}
