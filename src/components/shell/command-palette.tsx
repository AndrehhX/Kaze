"use client";

import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CornerDownLeft, History, Loader2, Palette, Search, Settings, Sparkles, Dices, Shuffle, Film } from "lucide-react";
import { create } from "zustand";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { PRIMARY_NAV } from "./nav-config";
import { THEME_IDS, THEMES } from "@/lib/themes";
import { useLocal } from "@/stores/local";
import { useKazeMotion } from "@/lib/motion";
import { cn, formatLabel } from "@/lib/utils";
import { useThemeSwitch } from "./theme-switcher";
import { useDebounced } from "@/lib/hooks";

export const usePalette = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

type Command = { id: string; group: string; label: string; hint?: string; icon: ReactNode; run: () => void; keywords?: string };

/** Highlight the matched substring for search results. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-primary/25 px-0.5 text-fg">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function CommandPalette() {
  const { open, setOpen } = usePalette();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { reduced, m } = useKazeMotion();
  const { switchTo, overlay } = useThemeSwitch();
  const recent = useLocal((s) => s.recentSearches);
  const pushSearch = useLocal((s) => s.pushSearch);
  const debounced = useDebounced(query.trim(), 220);
  const deferred = useDeferredValue(debounced);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(!usePalette.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);


  const search = useQuery({
    queryKey: ["suggest", deferred],
    queryFn: ({ signal }) => api.suggest(deferred, signal),
    enabled: open && deferred.length >= 2,
    staleTime: 60_000,
  });

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const commands: Command[] = useMemo(() => {
    const nav: Command[] = PRIMARY_NAV.map((n) => ({
      id: `nav-${n.href}`,
      group: "Navigate",
      label: n.label,
      hint: n.jp,
      icon: <n.icon className="size-4" />,
      run: () => go(n.href),
    }));
    const extra: Command[] = [
      { id: "moods", group: "Discover", label: "Mood Explorer", icon: <Sparkles className="size-4" />, run: () => go("/discover/moods"), keywords: "feel emotion" },
      { id: "roulette", group: "Discover", label: "Anime Roulette", icon: <Dices className="size-4" />, run: () => go("/discover/roulette"), keywords: "random spin" },
      { id: "similar", group: "Discover", label: "Similarity Explorer", icon: <Shuffle className="size-4" />, run: () => go("/discover/similar"), keywords: "graph related" },
      { id: "demo", group: "Discover", label: "Play the Open Cinema demo", icon: <Film className="size-4" />, run: () => go("/watch/open-cinema/1"), keywords: "player video watch" },
      { id: "settings", group: "Settings", label: "Settings", icon: <Settings className="size-4" />, run: () => go("/settings") },
      ...THEME_IDS.map((id) => ({
        id: `theme-${id}`,
        group: "Theme",
        label: `Theme: ${THEMES[id].name}`,
        hint: THEMES[id].jp,
        icon: <Palette className="size-4" />,
        run: () => {
          setOpen(false);
          switchTo(id);
        },
        keywords: "appearance color",
      })),
    ];
    return [...nav, ...extra];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? commands.filter((c) => `${c.label} ${c.keywords ?? ""} ${c.group}`.toLowerCase().includes(q)) : commands.slice(0, 9);
  const results = (search.data?.results ?? []).map<Command>((r) => {
    const t = r.title.english || r.title.userPreferred || r.title.romaji || "";
    return {
      id: `anime-${r.id}`,
      group: "Anime",
      label: t,
      hint: [formatLabel(r.format), r.seasonYear].filter(Boolean).join(" · "),
      icon: r.coverImage.large ? (
        <Image src={r.coverImage.large} alt="" width={28} height={40} className="h-10 w-7 rounded-sm object-cover" unoptimized />
      ) : (
        <Film className="size-4" />
      ),
      run: () => {
        pushSearch(query);
        go(`/anime/${r.id}`);
      },
    };
  });
  const searchAll: Command[] =
    q.length >= 2
      ? [
          {
            id: "search-all",
            group: "Anime",
            label: `Search all results for “${query.trim()}”`,
            icon: <Search className="size-4" />,
            run: () => {
              pushSearch(query);
              go(`/discover?q=${encodeURIComponent(query.trim())}`);
            },
          },
        ]
      : [];
  const recents: Command[] = !q
    ? recent.slice(0, 4).map((r) => ({ id: `recent-${r}`, group: "Recent searches", label: r, icon: <History className="size-4" />, run: () => setQuery(r) }))
    : [];
  // Matching commands first (keyboard-first navigation), then anime results.
  const all = q ? [...filtered, ...results, ...searchAll] : [...recents, ...filtered];

  // Reset the highlighted row whenever the result set changes (render-time adjustment).
  const resultKey = `${query}|${search.dataUpdatedAt}`;
  const [lastKey, setLastKey] = useState(resultKey);
  if (resultKey !== lastKey) {
    setLastKey(resultKey);
    setActive(0);
  }
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(all.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      all[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <>
      <D.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <AnimatePresence>
          {open && (
            <D.Portal forceMount>
              <D.Overlay asChild forceMount>
                <motion.div className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              </D.Overlay>
              <D.Content asChild forceMount onKeyDown={onKeyDown}>
                <motion.div
                  className="k-panel fixed left-1/2 top-[8dvh] z-[96] flex max-h-[76dvh] w-[min(94vw,640px)] -translate-x-1/2 flex-col overflow-hidden !bg-surface"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
                  transition={reduced ? { duration: 0.1 } : m.spring}
                >
                  <D.Title className="sr-only">Command palette</D.Title>
                  <D.Description className="sr-only">Search anime, navigate, or switch themes. Use arrow keys to move and Enter to select.</D.Description>
                  <div className="flex items-center gap-3 border-b border-line px-4">
                    {search.isFetching ? <Loader2 className="size-5 animate-spin text-muted" aria-hidden /> : <Search className="size-5 text-muted" aria-hidden />}
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search anime, jump anywhere, change the atmosphere…"
                      className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
                      role="combobox"
                      aria-expanded="true"
                      aria-controls="kaze-palette-list"
                      aria-activedescendant={all[active] ? `cmd-${all[active].id}` : undefined}
                      aria-autocomplete="list"
                    />
                    <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted sm:inline">Esc</kbd>
                  </div>
                  <div ref={listRef} id="kaze-palette-list" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
                    {search.isError && <p className="px-3 py-2 text-sm text-danger">Search is unavailable right now. Navigation still works.</p>}
                    {q.length >= 2 && !search.isFetching && search.data && results.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted">No anime match “{query.trim()}”.</p>
                    )}
                    {all.map((c, i) => {
                      const header = c.group !== lastGroup ? c.group : null;
                      lastGroup = c.group;
                      return (
                        <div key={c.id}>
                          {header && <div className="k-label px-3 pb-1 pt-3 text-muted">{header}</div>}
                          <div
                            id={`cmd-${c.id}`}
                            role="option"
                            aria-selected={i === active}
                            data-index={i}
                            onMouseMove={() => setActive(i)}
                            onClick={() => c.run()}
                            className={cn(
                              "flex min-h-11 cursor-pointer items-center gap-3 rounded-[min(var(--k-radius-btn),12px)] px-3 py-1.5 text-sm",
                              i === active ? "bg-[var(--k-btn-ghost)] text-fg" : "text-fg/85",
                            )}
                          >
                            <span className="grid w-7 shrink-0 place-items-center text-muted">{c.icon}</span>
                            <span className="min-w-0 flex-1 truncate">{c.group === "Anime" ? <Highlight text={c.label} query={query} /> : c.label}</span>
                            {c.hint && <span className="k-jp shrink-0 text-xs text-muted">{c.hint}</span>}
                            {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-muted" aria-hidden />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[0.6875rem] text-muted">
                    <span>
                      <kbd className="font-mono">↑↓</kbd> move
                    </span>
                    <span>
                      <kbd className="font-mono">↵</kbd> open
                    </span>
                    <span className="ml-auto">
                      Open anytime with <kbd className="font-mono">Ctrl K</kbd> or <kbd className="font-mono">/</kbd>
                    </span>
                  </div>
                </motion.div>
              </D.Content>
            </D.Portal>
          )}
        </AnimatePresence>
      </D.Root>
      {overlay}
    </>
  );
}
