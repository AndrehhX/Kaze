export const THEME_IDS = ["midnight", "sakura", "cyber", "zen"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "midnight";
export const THEME_STORAGE_KEY = "kaze:theme";

export type MotionPersonality = {
  /** Spring used for hover/press and layout changes. */
  spring: { type: "spring"; stiffness: number; damping: number; mass?: number };
  /** Ease curve for reveals. */
  ease: [number, number, number, number];
  /** Base reveal duration in seconds. */
  duration: number;
  /** Distance (px) content travels while revealing. 0 = pure fade. */
  rise: number;
  /** Horizontal travel for directional reveals (cyber). */
  slide: number;
  /** Stagger between siblings in seconds. */
  stagger: number;
  /** Hover lift distance in px. */
  lift: number;
};

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  jp: string;
  tagline: string;
  scheme: "dark" | "light";
  swatches: [string, string, string, string];
  motion: MotionPersonality;
};

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  midnight: {
    id: "midnight",
    name: "Midnight Neon",
    jp: "真夜中",
    tagline: "A metropolis that never sleeps.",
    scheme: "dark",
    swatches: ["#080810", "#A855F7", "#6D5EF8", "#FF4FD8"],
    motion: {
      spring: { type: "spring", stiffness: 260, damping: 26 },
      ease: [0.22, 1, 0.36, 1],
      duration: 0.6,
      rise: 18,
      slide: 0,
      stagger: 0.05,
      lift: 6,
    },
  },
  sakura: {
    id: "sakura",
    name: "Sakura Dream",
    jp: "桜の夢",
    tagline: "Spring light on a quiet afternoon.",
    scheme: "light",
    swatches: ["#FFF9FB", "#E86A9A", "#B89AF7", "#F7B7D2"],
    motion: {
      spring: { type: "spring", stiffness: 140, damping: 16, mass: 0.9 },
      ease: [0.34, 1.3, 0.64, 1],
      duration: 0.8,
      rise: 24,
      slide: 0,
      stagger: 0.07,
      lift: 8,
    },
  },
  cyber: {
    id: "cyber",
    name: "Cyber Pulse",
    jp: "電脳",
    tagline: "Signal acquired. Jack in.",
    scheme: "dark",
    swatches: ["#050D16", "#00D9FF", "#287BFF", "#B3FF39"],
    motion: {
      spring: { type: "spring", stiffness: 520, damping: 34 },
      ease: [0.7, 0, 0.2, 1],
      duration: 0.38,
      rise: 0,
      slide: -24,
      stagger: 0.035,
      lift: 3,
    },
  },
  zen: {
    id: "zen",
    name: "Zen Studio",
    jp: "禅",
    tagline: "Ink, paper, and a single brushstroke.",
    scheme: "light",
    swatches: ["#F5F2EA", "#E96B35", "#242424", "#C8B9A4"],
    motion: {
      spring: { type: "spring", stiffness: 180, damping: 30 },
      ease: [0.4, 0, 0.2, 1],
      duration: 0.9,
      rise: 6,
      slide: 0,
      stagger: 0.08,
      lift: 2,
    },
  },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/**
 * Runs before first paint (inlined in <head>) so the page never flashes the wrong theme.
 * Kept dependency-free and tiny on purpose.
 */
export const themeBootScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var ok=${JSON.stringify(THEME_IDS)};if(ok.indexOf(t)<0)t=${JSON.stringify(DEFAULT_THEME)};var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=(t==="sakura"||t==="zen")?"light":"dark";var m=localStorage.getItem("kaze:motion");if(m==="reduce"||m==="full")d.dataset.motion=m;}catch(e){}})();`;
