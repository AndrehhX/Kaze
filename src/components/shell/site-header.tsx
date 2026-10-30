"use client";

import Link from "next/link";
import * as DM from "@radix-ui/react-dropdown-menu";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { MoreHorizontal, Search } from "lucide-react";
import { useState } from "react";
import { Logo } from "./logo";
import { PRIMARY_NAV, isActive } from "./nav-config";
import { ThemeSwitcher } from "./theme-switcher";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notifications";
import { usePalette } from "./command-palette";
import { useSettings } from "@/stores/settings";
import { cn } from "@/lib/utils";
import { useCurrentPath } from "@/stores/route";
import { useKazeMotion } from "@/lib/motion";

export function SiteHeader() {
  const path = useCurrentPath();
  const setOpen = usePalette((s) => s.setOpen);
  const theme = useSettings((s) => s.theme);
  const { reduced } = useKazeMotion();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  const main = PRIMARY_NAV.slice(0, 5);
  const more = PRIMARY_NAV.slice(5);

  return (
    <header className={cn("sticky top-0 z-50 transition-colors duration-300", scrolled ? "k-nav" : "border-b border-transparent bg-gradient-to-b from-bg/85 via-bg/40 to-transparent")}>
      <div className="container-k flex h-[var(--k-nav-h)] items-center gap-3">
        <Logo className="mr-2 shrink-0" />
        <nav aria-label="Primary" className="hidden flex-1 items-center gap-0.5 lg:flex">
          {main.map((item) => {
            const active = isActive(item, path);
            return (
              <Link key={item.href} href={item.href} className="k-nav-item" data-active={active} aria-current={active ? "page" : undefined}>
                {item.label}
                {active && theme !== "cyber" && theme !== "sakura" && (
                  <motion.span
                    layoutId="nav-indicator"
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    className={cn(
                      "absolute left-3 right-3",
                      theme === "zen" ? "-bottom-[13px] h-[3px] bg-primary" : "bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_0_12px_var(--k-primary)]",
                    )}
                    aria-hidden
                  />
                )}
              </Link>
            );
          })}
          <DM.Root>
            <DM.Trigger className="k-nav-item" data-active={more.some((m) => isActive(m, path))} aria-label="More sections">
              <MoreHorizontal className="size-4" aria-hidden /> More
            </DM.Trigger>
            <DM.Portal>
              <DM.Content sideOffset={8} className="k-panel z-[90] min-w-52 !bg-surface p-1.5">
                {more.map((m) => (
                  <DM.Item key={m.href} asChild>
                    <Link href={m.href} className="flex min-h-10 items-center gap-2.5 rounded-[min(var(--k-radius-btn),10px)] px-3 text-sm outline-none data-[highlighted]:bg-[var(--k-btn-ghost)]">
                      <m.icon className="size-4" aria-hidden /> <span className="flex-1">{m.label}</span>
                      <span className="k-jp text-xs text-muted">{m.jp}</span>
                    </Link>
                  </DM.Item>
                ))}
              </DM.Content>
            </DM.Portal>
          </DM.Root>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="k-btn k-btn-ghost k-btn-sm hidden w-56 justify-start !px-3 text-muted md:inline-flex xl:w-64"
            aria-keyshortcuts="Control+K /"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left font-normal normal-case tracking-normal">Search anime…</span>
            <kbd aria-hidden className="rounded border border-line px-1.5 font-mono text-[0.625rem]">Ctrl K</kbd>
          </button>
          <button type="button" onClick={() => setOpen(true)} className="k-btn k-btn-ghost k-btn-icon k-btn-sm md:hidden" aria-label="Search">
            <Search className="size-[18px]" aria-hidden />
          </button>
          <NotificationBell />
          <ThemeSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
