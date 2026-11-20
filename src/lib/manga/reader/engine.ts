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
  /** Paged mode turns pages like a printed book (3D page flip). Off → the simpler animations above. */
  bookFlip: boolean;
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
  bookFlip: true,
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
    bookFlip: bool(p.bookFlip, d.bookFlip),
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

/** Duration of the book page-turn animation. */
export function flipMs(speed: TransitionSpeed): number {
  return speed === "slow" ? 950 : speed === "fast" ? 420 : 680;
}

/** Height / width above which an image is a webtoon strip rather than a printed page. */
export const STRIP_RATIO = 2.2;

/**
 * A chapter is a vertical strip (webtoon / manhwa scan) when most of its measured images are much taller
 * than a printed page. Such strips cannot be shown as book pages without shrinking them to a sliver.
 */
export function isStripChapter(measured: { w: number; h: number }[]): boolean {
  if (measured.length === 0) return false;
  const strips = measured.filter((m) => m.h / Math.max(1, m.w) >= STRIP_RATIO).length;
  return strips > 0 && strips * 2 >= measured.length;
}

export type PageBox = { index: number; left: number; top: number; width: number; height: number; side: "left" | "right" | "center" };

/**
 * Lays out one view on the stage. Two-page views sit like an open book: the spine is at the centre of the
 * stage and both pages share one height. Single views are centred. Sizes honour the fit preference; a page
 * may be larger than the stage (fit width / original) — the reader then lets you pan it.
 */
export function layoutView(visual: number[], size: (i: number) => { w: number; h: number }, stage: { width: number; height: number }, fit: FitMode): PageBox[] {
  const W = Math.max(1, stage.width), H = Math.max(1, stage.height);
  if (visual.length === 2) {
    const half = W / 2;
    const [a, b] = visual.map((i) => size(i));
    const ra = a.w / Math.max(1, a.h), rb = b.w / Math.max(1, b.h);
    const byWidth = Math.min(half / ra, half / rb);
    const h = fit === "width" ? byWidth : fit === "height" ? H : fit === "original" ? Math.min(a.h, b.h) : Math.min(H, byWidth);
    const top = (H - h) / 2;
    const wl = h * ra, wr = h * rb;
    return [
      { index: visual[0], left: half - wl, top, width: wl, height: h, side: "left" },
      { index: visual[1], left: half, top, width: wr, height: h, side: "right" },
    ];
  }
  const p = size(visual[0]);
  const fw = fit === "original" ? p.w : fit === "width" ? W : fit === "height" ? (H * p.w) / p.h : Math.min(W, (H * p.w) / p.h);
  const fh = (fw * p.h) / Math.max(1, p.w);
  return [{ index: visual[0], left: (W - fw) / 2, top: (H - fh) / 2, width: fw, height: fh, side: "center" }];
}

/** Extent of a laid-out view, in stage coordinates. */
export function boxesExtent(boxes: PageBox[]) {
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.left + b.width)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.top + b.height)),
  };
}

export type ZoomState = { scale: number; x: number; y: number };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

/**
 * Keeps a zoomed view inside the stage: content larger than the stage can be panned up to its edges and
 * never further; content smaller than the stage never leaves it. Zoom is about the stage centre.
 */
export function clampPan(z: ZoomState, extent: ReturnType<typeof boxesExtent>, stage: { width: number; height: number }): ZoomState {
  const axis = (t: number, lo: number, hi: number, size: number) => {
    const c = size / 2;
    const mappedLo = c + (lo - c) * z.scale, mappedHi = c + (hi - c) * z.scale;
    // Fits: stay fully inside the stage. Overflows: never show empty space past an edge.
    if (mappedHi - mappedLo <= size) return z.scale <= 1.001 ? 0 : Math.min(size - mappedHi, Math.max(-mappedLo, t));
    return Math.min(-mappedLo, Math.max(size - mappedHi, t));
  };
  return { scale: z.scale, x: axis(z.x, extent.left, extent.right, stage.width), y: axis(z.y, extent.top, extent.bottom, stage.height) };
}

/** Zooms to `scale` keeping the stage point (px, py) under the cursor / fingers. */
export function zoomAt(z: ZoomState, scale: number, px: number, py: number, stage: { width: number; height: number }): ZoomState {
  const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
  const k = s / z.scale;
  const cx = stage.width / 2, cy = stage.height / 2;
  return { scale: s, x: px - cx - (px - cx - z.x) * k, y: py - cy - (py - cy - z.y) * k };
}
