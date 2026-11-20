"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BookOpen, Compass, Library } from "lucide-react";
import { useCurrentPath } from "@/stores/route";
import { cn } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";

export const MANGA_NAV = [
  { href: "/manga", label: "Inicio", icon: BookOpen, exact: true },
  { href: "/manga/discover", label: "Explorar", icon: Compass },
  { href: "/library/manga", label: "Mi biblioteca", icon: Library },
];

/** Section navigation for KAZE MANGA. Hidden inside the immersive reader. */
export function MangaSubnav() {
  const path = useCurrentPath();
  const { reduced } = useKazeMotion();
  if (path.startsWith("/manga/read/")) return null;
  return (
    <nav aria-label="Secciones de manga" className="container-k relative z-10 mt-2">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none border-b border-line pb-px">
        <span className="k-jp shrink-0 pr-2 text-sm text-primary-ink" lang="ja" aria-hidden>
          漫画
        </span>
        {MANGA_NAV.map((n) => {
          const active = n.exact ? path === n.href : path === n.href || path.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} prefetch={false} aria-current={active ? "page" : undefined} className={cn("relative inline-flex h-10 shrink-0 items-center gap-1.5 px-1.5 text-sm font-medium transition-colors", active ? "text-fg" : "text-muted hover:text-fg")}>
              <n.icon className="size-4" aria-hidden />
              {n.label}
              {active && <motion.span layoutId="manga-subnav" transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-x-0 -bottom-px h-[2px] bg-primary" aria-hidden />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
