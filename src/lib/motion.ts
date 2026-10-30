"use client";

import { useReducedMotion, type Variants } from "motion/react";
import { THEMES } from "@/lib/themes";
import { useSettings } from "@/stores/settings";

/** Theme-aware motion: each theme has its own personality (see THEMES[*].motion). */
export function useKazeMotion() {
  const theme = useSettings((s) => s.theme);
  const pref = useSettings((s) => s.motion);
  const system = useReducedMotion();
  const reduced = pref === "reduce" || (pref === "system" && Boolean(system));
  const m = THEMES[theme].motion;

  const reveal: Variants = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } }
    : {
        hidden: { opacity: 0, y: m.rise, x: m.slide, filter: theme === "cyber" ? "brightness(2)" : "none" },
        show: { opacity: 1, y: 0, x: 0, filter: "none", transition: { duration: m.duration, ease: m.ease } },
      };

  const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : m.stagger } } };

  return { theme, reduced, m, reveal, stagger, spring: reduced ? { duration: 0 } : m.spring };
}
