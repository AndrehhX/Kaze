"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Compass, Home, Library, LayoutGrid, Paintbrush, Search, Settings, UserRound } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PRIMARY_NAV, isActive } from "./nav-config";
import { usePalette } from "./command-palette";
import { ThemePreviewCard, useThemeSwitch } from "./theme-switcher";
import { THEME_IDS } from "@/lib/themes";
import { useSettings } from "@/stores/settings";
import { useAuth } from "@/stores/auth";
import { useGuestProfile } from "@/lib/profile/guest";
import { Avatar } from "./user-menu";
import { cn } from "@/lib/utils";
import { useCurrentPath } from "@/stores/route";
import { useKazeMotion } from "@/lib/motion";

export function MobileNav() {
  const path = useCurrentPath();
  const setPalette = usePalette((s) => s.setOpen);
  const [sheet, setSheet] = useState(false);
  const theme = useSettings((s) => s.theme);
  const profile = useAuth((s) => s.profile);
  const [guestProfile] = useGuestProfile();
  const { switchTo, overlay } = useThemeSwitch();
  const { reduced } = useKazeMotion();

  const displayName = profile?.display_name || (profile?.username ? `@${profile.username}` : guestProfile.display_name || "Invitado");
  const avatarUrl = profile?.avatar_url || guestProfile.avatar_url;
  const avatarFrame = profile?.avatar_frame || guestProfile.avatar_frame;
  const profileUrl = profile?.username ? `/profile/${encodeURIComponent(profile.username)}` : "/profile/guest";

  const closeAndClear = () => {
    setSheet(false);
    if (typeof document !== "undefined") {
      document.body.style.pointerEvents = "";
      document.body.removeAttribute("data-scroll-locked");
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
  };

  const tabs = [
    { href: "/", label: "Inicio", icon: Home, active: path === "/" },
    { href: "/discover", label: "Descubrir", icon: Compass, active: path.startsWith("/discover") },
    { href: "#search", label: "Buscar", icon: Search, active: false },
    { href: "/library", label: "Biblioteca", icon: Library, active: path.startsWith("/library") },
    { href: "#more", label: "Universo", icon: LayoutGrid, active: sheet },
  ];

  return (
    <>
      <nav aria-label="Navegación móvil" className="k-nav fixed inset-x-0 bottom-0 z-50 border-t border-line pb-safe lg:hidden">
        <ul className="mx-auto grid h-[var(--k-mobile-bar-h)] max-w-lg grid-cols-5 items-center px-2">
          {tabs.map((t) => {
            const inner = (
              <>
                {t.href === "#search" ? (
                  <span className="k-btn-primary grid size-12 -translate-y-3 place-items-center rounded-[var(--k-radius-btn)] shadow-[var(--k-btn-shadow)] [border-radius:max(var(--k-radius-btn),0px)]">
                    <t.icon className="size-5" aria-hidden />
                  </span>
                ) : (
                  <span className="relative grid place-items-center">
                    {t.active && (
                      <motion.span
                        layoutId="mobile-tab"
                        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 36 }}
                        className="absolute -inset-x-3 -inset-y-1.5 rounded-[var(--k-radius-chip)] bg-primary/15"
                        aria-hidden
                      />
                    )}
                    <t.icon className={cn("relative size-5", t.active ? "text-primary-ink" : "text-muted")} aria-hidden />
                  </span>
                )}
                <span className={cn("text-[0.625rem] font-medium", t.href === "#search" && "-mt-2.5", t.active ? "text-fg" : "text-muted")}>{t.label}</span>
              </>
            );
            const cls = "flex min-h-12 flex-col items-center justify-center gap-1";
            return (
              <li key={t.href}>
                {t.href.startsWith("#") ? (
                  <button type="button" className={cn(cls, "w-full")} onClick={() => (t.href === "#search" ? setPalette(true) : setSheet(true))} aria-label={t.label}>
                    {inner}
                  </button>
                ) : (
                  <Link href={t.href} prefetch={true} className={cls} aria-current={t.active ? "page" : undefined}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <Dialog open={sheet} onOpenChange={setSheet} title="Tu universo" side="bottom">
        <div className="px-5 pb-6">
          {/* Tarjeta de Perfil Rápida */}
          <div className="mb-4 flex items-center justify-between rounded-xl bg-surface/90 p-3.5 border border-line shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={avatarUrl} name={displayName} size={42} frame={avatarFrame} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-fg">{displayName}</p>
                <p className="truncate text-xs text-muted">Tu universo personal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={profileUrl}
                prefetch={true}
                onClick={closeAndClear}
                className="k-btn k-btn-primary k-btn-sm text-xs font-semibold"
              >
                Ver perfil
              </Link>
            </div>
          </div>

          {/* Cuadrícula de Navegación del Universo */}
          <ul className="grid grid-cols-3 gap-2">
            {[
              { href: profileUrl, label: "Mi Universo", jp: "自分", icon: UserRound },
              { href: "/settings/profile", label: "Personalizar", jp: "装飾", icon: Paintbrush },
              ...PRIMARY_NAV,
              { href: "/settings", label: "Configuración", jp: "設定", icon: Settings },
            ].map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  prefetch={true}
                  onClick={closeAndClear}
                  className={cn(
                    "k-card flex aspect-[5/4] flex-col justify-between p-3 text-sm font-medium",
                    isActive(n, path) && "ring-2 ring-primary",
                  )}
                >
                  <n.icon className="size-5 text-primary-ink" aria-hidden />
                  <span>
                    <span className="block leading-tight text-xs font-semibold">{n.label}</span>
                    <span className="k-jp text-[0.625rem] text-muted">{n.jp}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="k-label mb-2 mt-6 text-muted">Atmósfera visual</p>
          <div className="grid grid-cols-2 gap-2">
            {THEME_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className="rounded-[var(--k-radius-card)] text-left"
                aria-pressed={theme === id}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  switchTo(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
                }}
              >
                <ThemePreviewCard id={id} active={theme === id} />
              </button>
            ))}
          </div>
        </div>
      </Dialog>
      {overlay}
    </>
  );
}
