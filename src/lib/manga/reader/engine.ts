/**
 * Pure reader logic (no React): reading direction, page pairing for double-page spreads, navigation,
 * keyboard and tap mapping, preloading windows and completion. Kept framework-free so it is unit-tested.
 */

export type ReadingDirection = "rtl" | "ltr";
export type ReaderMode = "paged" | "vertical" | "webtoon";
export type PageLayout = "single" | "double" | "auto";
export type FitMode = "contain" | "width" | "height" | "original";
export type AnimationIntensity = "classic" | "smooth" | "cinematic" | "focus";
export type TransitionSpeed = "fast" | "normal" | "slow";
export type ReaderBackground = "theme" | "paper" | "black" | "gray";
export type ImageQuality = "auto" | "high" | "data-saver";

export type ReaderPrefs = {
  mode: ReaderMode | "auto";
  layout: PageLayout;
  direction: ReadingDirection | "auto";
  fit: FitMode;
  animation: AnimationIntensity;
  transitionSpeed: TransitionSpeed;
  background: ReaderBackground;
  /** 0 (none) … 0.6 — a dimming overlay that works like a brightness control. */
  dim: number;
  /** Gap between pages in vertical mode (px). Webtoon mode is always seamless. */
  pageGap: number;
  /** How many pages ahead (and half behind) to preload. */
  preload: number;
  quality: ImageQuality;
  dataSaver: boolean;
  fullscreenOnOpen: boolean;
  /** In double-page mode show the first page alone (as printed volumes do). */
  coverAlone: boolean;
  zoomOnDoubleClick: boolean;
  showKeyboardHints: boolean;
};

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  mode: "auto",
  layout: "auto",
  direction: "auto",
  fit: "contain",
  animation: "classic",
  transitionSpeed: "normal",
  background: "theme",
  dim: 0,
  pageGap: 12,
  preload: 3,
  quality: "auto",
  dataSaver: false,
  fullscreenOnOpen: false,
  coverAlone: true,
  zoomOnDoubleClick: true,
  showKeyboardHints: true,
};

export function sanitizeReaderPrefs(input: unknown): ReaderPrefs {
  const p = (input && typeof input === "object" ? input : {}) as Partial<Record<keyof ReaderPrefs, unknown>>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  const d = DEFAULT_READER_PREFS;
  return {
    mode: pick(p.mode, ["auto", "paged", "vertical", "webtoon"] as const, d.mode),
    layout: pick(p.layout, ["single", "double", "auto"] as const, d.layout),
    direction: pick(p.direction, ["auto", "rtl", "ltr"] as const, d.direction),
    fit: pick(p.fit, ["contain", "width", "height", "original"] as const, d.fit),
    animation: pick(p.animation, ["classic", "smooth", "cinematic", "focus"] as const, d.animation),
    transitionSpeed: pick(p.transitionSpeed, ["fast", "normal", "slow"] as const, d.transitionSpeed),
    background: pick(p.background, ["theme", "paper", "black", "gray"] as const, d.background),
    dim: num(p.dim, 0, 0.6, d.dim),
    pageGap: num(p.pageGap, 0, 64, d.pageGap),
    preload: Math.round(num(p.preload, 1, 8, d.preload)),
    quality: pick(p.quality, ["auto", "high", "data-saver"] as const, d.quality),
    dataSaver: bool(p.dataSaver, d.dataSaver),
    fullscreenOnOpen: bool(p.fullscreenOnOpen, d.fullscreenOnOpen),
    coverAlone: bool(p.coverAlone, d.coverAlone),
    zoomOnDoubleClick: bool(p.zoomOnDoubleClick, d.zoomOnDoubleClick),
    showKeyboardHints: bool(p.showKeyboardHints, d.showKeyboardHints),
  };
}

export type PageLike = { index: number; spread: boolean; width: number; height: number };

/** Effective settings for a chapter once "auto" values are resolved against the series and the viewport. */
export function resolveReader(prefs: ReaderPrefs, series: { readingDirection: "rtl" | "ltr" | "vertical" }, viewport: { width: number; height: number }) {
  const seriesVertical = series.readingDirection === "vertical";
  const mode: ReaderMode = prefs.mode === "auto" ? (seriesVertical ? "webtoon" : "paged") : prefs.mode;
  const direction: ReadingDirection = prefs.direction === "auto" ? (series.readingDirection === "ltr" || seriesVertical ? "ltr" : "rtl") : prefs.direction;
  const wide = viewport.width >= 1024 && viewport.width / Math.max(1, viewport.height) >= 1.2;
  const layout: "single" | "double" = mode !== "paged" ? "single" : prefs.layout === "auto" ? (wide ? "double" : "single") : prefs.layout;
  return { mode, direction, layout };
}

/**
 * Groups pages into "views" (what is on screen at once). Indices inside a view are in reading order;
 * for RTL the UI renders view[0] on the right. Spread images and (optionally) the first page stand alone.
 */
export function buildViews(pages: PageLike[], layout: "single" | "double", opts: { coverAlone?: boolean } = {}): number[][] {
  if (layout === "single") return pages.map((p) => [p.index]);
  const views: number[][] = [];
  let i = 0;
  while (i < pages.length) {
    const p = pages[i];
    const landscape = p.spread || p.width > p.height;
    if (landscape || (i === 0 && opts.coverAlone)) {
      views.push([p.index]);
      i += 1;
      continue;
    }
    const q = pages[i + 1];
    if (q && !(q.spread || q.width > q.height)) {
      views.push([p.index, q.index]);
      i += 2;
    } else {
      views.push([p.index]);
      i += 1;
    }
  }
  return views;
}

export function viewIndexOf(views: number[][], page: number): number {
  const i = views.findIndex((v) => v.includes(page));
  return i < 0 ? 0 : i;
}

/** Visual left→right order of a view: RTL shows the first page on the right. */
export function visualOrder(view: number[], direction: ReadingDirection): number[] {
  return direction === "rtl" ? [...view].reverse() : view;
}

export type NavIntent = "next" | "prev" | "first" | "last" | "toggle-ui" | "none";

/** Maps keys to intents honouring reading direction (in RTL, ← advances). */
export function keyToIntent(key: string, direction: ReadingDirection, mode: ReaderMode): NavIntent {
  if (key === "Home") return "first";
  if (key === "End") return "last";
  if (mode !== "paged") {
    if (key === "PageDown" || key === " " || key === "j") return "next";
    if (key === "PageUp" || key === "k") return "prev";
    return "none";
  }
  const forward = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
  const back = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
  if (key === forward || key === "PageDown" || key === " " || key === "ArrowDown" || key === "j") return "next";
  if (key === back || key === "PageUp" || key === "ArrowUp" || key === "k") return "prev";
  return "none";
}

/** Tap zones: outer thirds turn pages (direction-aware), the middle toggles the controls. */
export function tapToIntent(xFraction: number, direction: ReadingDirection): NavIntent {
  if (xFraction < 1 / 3) return direction === "rtl" ? "next" : "prev";
  if (xFraction > 2 / 3) return direction === "rtl" ? "prev" : "next";
  return "toggle-ui";
}

/** Horizontal swipe → intent. In RTL, swiping right (dx > 0) reveals the next page, like a printed manga. */
export function swipeToIntent(dx: number, dy: number, direction: ReadingDirection, threshold = 48): NavIntent {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return "none";
  const towardNext = direction === "rtl" ? dx > 0 : dx < 0;
  return towardNext ? "next" : "prev";
}

export function step(viewCount: number, current: number, intent: NavIntent): { view: number; boundary: "start" | "end" | null } {
  if (intent === "first") return { view: 0, boundary: null };
  if (intent === "last") return { view: Math.max(0, viewCount - 1), boundary: null };
  if (intent === "next") return current >= viewCount - 1 ? { view: current, boundary: "end" } : { view: current + 1, boundary: null };
  if (intent === "prev") return current <= 0 ? { view: 0, boundary: "start" } : { view: current - 1, boundary: null };
  return { view: current, boundary: null };
}

/** Pages to keep loaded: `ahead` pages forward, half as many behind. Never the whole chapter. */
export function preloadWindow(current: number, total: number, ahead: number): number[] {
  const behind = Math.max(1, Math.floor(ahead / 2));
  const out: number[] = [];
  for (let i = Math.max(0, current - behind); i <= Math.min(total - 1, current + ahead); i++) out.push(i);
  return out;
}

export function progressPercent(page: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.round(((Math.min(page, pageCount - 1) + 1) / pageCount) * 100);
}

/** A chapter counts as read once the last page has been displayed. */
export function isChapterComplete(page: number, pageCount: number) {
  return pageCount > 0 && page >= pageCount - 1;
}

export function transitionMs(speed: TransitionSpeed, intensity: AnimationIntensity): number {
  if (intensity === "classic" || intensity === "focus") return speed === "slow" ? 180 : speed === "fast" ? 60 : 110;
  const base = intensity === "cinematic" ? 620 : 380;
  return Math.round(base * (speed === "slow" ? 1.4 : speed === "fast" ? 0.6 : 1));
}

/** Fit a page (w×h) into a box (bw×bh). "original" keeps 1:1 pixels. Aspect ratio is always preserved; nothing is cropped. */
export function fitSize(w: number, h: number, bw: number, bh: number, fit: FitMode) {
  if (fit === "original") return { width: w, height: h };
  const sw = bw / w;
  const sh = bh / h;
  const s = fit === "width" ? sw : fit === "height" ? sh : Math.min(sw, sh);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}
