"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "motion/react";
import { Check, Palette } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { THEME_IDS, THEMES, type ThemeId } from "@/lib/themes";
import { useSettings } from "@/stores/settings";
import { useKazeMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type VT = { ready: Promise<void>; finished: Promise<void> };
type DocWithVT = Document & { startViewTransition?: (cb: () => void) => VT };

/**
 * "Theme Universe Switch": a circular reveal from the pointer, plus the new
 * theme's kanji washing across the screen. Falls back to an instant swap.
 */
export function useThemeSwitch() {
  const setTheme = useSettings((s) => s.setTheme);
  const { reduced } = useKazeMotion();
  const [flash, setFlash] = useState<ThemeId | null>(null);

  const switchTo = (id: ThemeId, origin?: { x: number; y: number }) => {
    const doc = document as DocWithVT;
    if (reduced || !doc.startViewTransition) {
      setTheme(id);
      return;
    }
    const x = origin?.x ?? innerWidth / 2;
    const y = origin?.y ?? innerHeight / 2;
    const t = doc.startViewTransition(() => flushSync(() => setTheme(id)));
    setFlash(id);
    t.ready
      .then(() => {
        const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 760, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
    t.finished.finally(() => setTimeout(() => setFlash(null), 250));
  };

  const overlay = (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[200] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <motion.span
            className="k-jp select-none text-[22vw] font-bold leading-none text-primary/15"
            lang="ja"
            initial={{ scale: 0.85, filter: "blur(12px)" }}
            animate={{ scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {THEMES[flash].jp}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return { switchTo, overlay };
}

/** Applies a theme to the document without persisting it (used for live previews). */
function paintTheme(id: ThemeId) {
  const d = document.documentElement;
  d.dataset.theme = id;
  d.style.colorScheme = THEMES[id].scheme;
}

export function ThemePreviewCard({ id, active }: { id: ThemeId; active: boolean }) {
  const t = THEMES[id];
  return (
    <div data-theme={id} className="relative overflow-hidden rounded-[var(--k-radius-card)] border border-line bg-bg p-3 text-fg" style={{ colorScheme: t.scheme }}>
      <div className="flex items-center justify-between">
        <span className="font-display text-sm">{t.name}</span>
        <span className="k-jp text-xs text-primary-ink" lang="ja">
          {t.jp}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {t.swatches.map((c) => (
          <span key={c} className="size-4 rounded-full ring-1 ring-black/10" style={{ background: c }} />
        ))}
        <span className="k-btn k-btn-primary ml-auto !min-h-6 !px-2 !text-[0.625rem]">Play</span>
      </div>
      {active && (
        <span className="absolute bottom-2 left-3 inline-flex items-center gap-1 text-[0.625rem] font-semibold text-primary-ink">
          <Check className="size-3" /> Active
        </span>
      )}
    </div>
  );
}

export function ThemeSwitcher({ className }: { className?: string }) {
  const theme = useSettings((s) => s.theme);
  const { switchTo, overlay } = useThemeSwitch();
  const previewing = useRef(false);

  // Live preview: hovering/focusing a theme previews it across the page; leaving restores it.
  const preview = (id: ThemeId | null) => {
    if (id) {
      previewing.current = true;
      paintTheme(id);
    } else if (previewing.current) {
      previewing.current = false;
      paintTheme(useSettings.getState().theme);
    }
  };

  return (
    <>
      <DM.Root onOpenChange={(o) => !o && preview(null)}>
        <DM.Trigger asChild>
          <button type="button" className={cn("k-btn k-btn-ghost k-btn-icon k-btn-sm", className)} aria-label={`Theme: ${THEMES[theme].name}. Change theme`}>
            <Palette className="size-[18px]" aria-hidden />
          </button>
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="end" sideOffset={10} className="k-panel z-[90] w-[300px] !bg-surface p-3" onPointerLeave={() => preview(null)}>
            <DM.Label className="k-label px-1 pb-2 text-muted">Atmosphere · hover to preview</DM.Label>
            <div className="grid gap-2">
              {THEME_IDS.map((id) => (
                <DM.Item
                  key={id}
                  className="rounded-[var(--k-radius-card)] outline-none data-[highlighted]:ring-2 data-[highlighted]:ring-primary"
                  onPointerEnter={() => preview(id)}
                  onFocus={() => preview(id)}
                  onSelect={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    const r = target.getBoundingClientRect();
                    previewing.current = false;
                    // Restore before transitioning so the reveal animates from the old theme.
                    paintTheme(useSettings.getState().theme);
                    switchTo(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
                  }}
                >
                  <ThemePreviewCard id={id} active={theme === id} />
                </DM.Item>
              ))}
            </div>
          </DM.Content>
        </DM.Portal>
      </DM.Root>
      {overlay}
    </>
  );
}
