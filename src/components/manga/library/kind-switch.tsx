"use client";

import Link from "next/link";
import { BookOpen, Tv } from "lucide-react";
import { useLibrary } from "@/stores/library";
import { useMangaLibrary } from "@/stores/manga";
import { cn } from "@/lib/utils";

/** Anime ⇄ manga switch shared by both library views. The anime library itself is unchanged. */
export function LibraryKindSwitch({ active }: { active: "anime" | "manga" }) {
  const anime = useLibrary((s) => Object.keys(s.entries).length);
  const manga = useMangaLibrary((s) => Object.keys(s.entries).length);
  const hydrated = useLibrary((s) => s.hydrated) && true;
  const item = (kind: "anime" | "manga", href: string, label: string, Icon: typeof Tv, count: number) => (
    <Link href={href} role="tab" aria-selected={active === kind} className={cn("inline-flex min-h-10 items-center gap-2 rounded-[var(--k-radius-btn)] px-4 text-sm font-semibold transition-colors", active === kind ? "k-btn-primary" : "text-muted hover:text-fg")}>
      <Icon className="size-4" aria-hidden /> {label}
      {hydrated && <span className="text-xs opacity-75">{count}</span>}
    </Link>
  );
  return (
    <div role="tablist" aria-label="Tipo de biblioteca" className="mb-5 inline-flex gap-1 rounded-[var(--k-radius-btn)] bg-[var(--k-btn-ghost)] p-1">
      {item("anime", "/library", "Anime", Tv, anime)}
      {item("manga", "/library/manga", "Manga", BookOpen, manga)}
    </div>
  );
}
