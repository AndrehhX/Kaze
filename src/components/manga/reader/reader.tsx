"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, BookmarkCheck, BookOpen, ChevronLeft, ChevronRight, Columns2, Expand, List, Minimize, ScrollText, Settings2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { ReadingAsset } from "@/lib/manga/catalog";
import type { MangaSnapshot } from "@/lib/manga/types";
import { boxesExtent, buildViews, clampPan, flipMs, isChapterComplete, isStripChapter, keyToIntent, layoutView, preloadWindow, progressPercent, resolveReader, step, swipeToIntent, tapToIntent, transitionMs, viewIndexOf, visualOrder, zoomAt, type NavIntent, type ZoomState } from "@/lib/manga/reader/engine";
import { useSettings } from "@/stores/settings";
import { progressKey, useMangaLibrary } from "@/stores/manga";
import { useKazeMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PageImage } from "./page-image";
import { BookStage, Spread, type Flip } from "./book-stage";
import { ReaderSettingsPanel } from "./settings-panel";

export type ReaderChapter = { id: string; label: string; title: string | null; number: string | null; regular: boolean };

export type ReaderProps = {
  mangaId: number;
  slug: string;
  seriesTitle: string;
  snapshot: MangaSnapshot;
  readingDirection: "rtl" | "ltr" | "vertical";
  chapter: ReaderChapter;
  pages: ReadingAsset[];
  chapters: ReaderChapter[];
  prev: ReaderChapter | null;
  next: ReaderChapter | null;
  initialPage: number | null;
  demo: boolean;
};

const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  window.addEventListener("orientationchange", cb);
  return () => {
    window.removeEventListener("resize", cb);
    window.removeEventListener("orientationchange", cb);
  };
};
let lastViewport = { width: 1280, height: 800 };
const viewportSnapshot = () => {
  const w = window.innerWidth, h = window.innerHeight;
  if (w !== lastViewport.width || h !== lastViewport.height) lastViewport = { width: w, height: h };
  return lastViewport;
};
const serverViewport = () => lastViewport;

/** Marks reader activity (and optionally the session start). Kept outside render: it reads the clock. */
function stamp(s: { startedAt: number; lastInput: number }, start = false) {
  const t = Date.now();
  s.lastInput = t;
  if (start) s.startedAt = t;
}

export function MangaReader(props: ReaderProps) {
  const { mangaId, slug, seriesTitle, snapshot, readingDirection, chapter, pages, chapters, prev, next, initialPage, demo } = props;
  const router = useRouter();
  const prefs = useSettings((s) => s.reader);
  const setReader = useSettings((s) => s.setReader);
  const settingsHydrated = useSettings((s) => s.hydrated);
  const { reduced } = useKazeMotion();
  const viewport = useSyncExternalStore(subscribeResize, viewportSnapshot, serverViewport);
  // Real page sizes, measured as images decode. Providers like MangaDex report placeholder sizes, and a
  // webtoon strip laid out as if it were a printed page ends up as an unreadable sliver.
  const [sizes, setSizes] = useState<Record<number, { w: number; h: number }>>({});
  const reportSize = (i: number, w: number, h: number) => setSizes((s) => (s[i]?.w === w && s[i]?.h === h ? s : { ...s, [i]: { w, h } }));
  const sizeOf = (i: number) => sizes[i] ?? { w: pages[i]?.width || 800, h: pages[i]?.height || 1200 };
  const strip = isStripChapter(Object.values(sizes));
  const resolved = resolveReader(prefs, { readingDirection }, viewport);
  // Strips are read in cascade even when the book mode is selected: as pages they would be unreadable.
  const mode = strip && resolved.mode === "paged" ? "webtoon" : resolved.mode;
  const direction = resolved.direction;
  const layout = mode === "paged" ? resolved.layout : "single";
  const views = buildViews(
    pages.map((p, i) => ({ ...p, width: sizeOf(i).w, height: sizeOf(i).h })),
    layout,
    { coverAlone: prefs.coverAlone },
  );

  const record = useMangaLibrary((s) => s.recordChapterProgress);
  const recordSession = useMangaLibrary((s) => s.recordSession);
  const addBookmark = useMangaLibrary((s) => s.addBookmark);
  const removeBookmark = useMangaLibrary((s) => s.removeBookmark);
  const bookmarks = useMangaLibrary((s) => s.bookmarks);
  const storedProgress = useMangaLibrary((s) => s.chapterProgress[progressKey(mangaId, chapter.id)]);
  const libHydrated = useMangaLibrary((s) => s.hydrated);

  const [page, setPage] = useState(() => Math.max(0, Math.min(pages.length - 1, initialPage ?? 0)));
  const [dirSign, setDirSign] = useState(1);
  const [ui, setUi] = useState(true);
  // Focus mode keeps its own visibility so switching modes never needs a state reset.
  const [focusUi, setFocusUi] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [end, setEnd] = useState(false);
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [flip, setFlip] = useState<Flip | null>(null);
  const flipSeq = useRef(0);
  // Cascade (webtoon) zoom: the column width, as a multiple of the normal reading width.
  const [colScale, setColScale] = useState(1);
  const stripToasted = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; pinch0?: number; scale0?: number; panX?: number; panY?: number; moved: boolean } | null>(null);
  const resumed = useRef(false);
  const session = useRef({ startedAt: 0, active: 0, lastInput: 0, pages: new Set<number>() });

  const viewIndex = viewIndexOf(views, page);
  const currentView = views[viewIndex] ?? [0];
  const lastVisiblePage = Math.max(...currentView);
  const chapterBookmarks = Object.values(bookmarks).filter((b) => b.mangaId === mangaId && b.chapterId === chapter.id);
  const pageBookmarked = chapterBookmarks.find((b) => currentView.includes(b.page));
  const animation = reduced ? "classic" : prefs.animation;
  const dur = reduced ? 0 : transitionMs(prefs.transitionSpeed, animation) / 1000;
  const bookFlip = prefs.bookFlip && !reduced;
  const flipDur = flipMs(prefs.transitionSpeed) / 1000;
  const dataSaver = prefs.dataSaver || prefs.quality === "data-saver";

  // Stage geometry for paged mode: page boxes, and what zoom / pan may do with them.
  const stageBox = { width: stage.width || viewport.width, height: stage.height || Math.max(200, viewport.height - 140) };
  const extentOf = (view: number[]) => boxesExtent(layoutView(visualOrder(view, direction), sizeOf, stageBox, prefs.fit));
  const extent = extentOf(currentView);
  const overflows = extent.right - extent.left > stageBox.width + 1 || extent.bottom - extent.top > stageBox.height + 1;
  const pannable = zoom.scale > 1.001 || overflows;
  /** Zoom/pan for a freshly shown view: no zoom, and long pages (fit to width) start at their top. */
  const startZoom = (view: number[]): ZoomState => clampPan({ scale: 1, x: 0, y: 1e6 }, extentOf(view), stageBox);
  const applyZoom = (z: ZoomState) => setZoom(clampPan(z.scale <= 1.001 ? { ...z, scale: 1 } : z, extent, stageBox));
  /** Cascade zoom keeps the reading position: same fraction of the chapter before and after. */
  const zoomColumn = (factor: number | "reset") => {
    const el = scrollRef.current;
    const ratio = el ? el.scrollTop / Math.max(1, el.scrollHeight) : 0;
    setColScale((s) => (factor === "reset" ? 1 : Math.min(3, Math.max(0.5, Math.round(s * factor * 100) / 100))));
    requestAnimationFrame(() => {
      if (!el) return;
      el.scrollTop = ratio * el.scrollHeight;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    });
  };
  const zoomBy = (factor: number) => {
    if (mode !== "paged") return zoomColumn(factor);
    applyZoom(zoomAt(zoom, zoom.scale * factor, stageBox.width / 2, stageBox.height / 2, stageBox));
  };
  const resetZoom = () => setZoom(startZoom(currentView));
  const zoomPct = Math.round((mode === "paged" ? zoom.scale : colScale) * 100);

  useEffect(() => {
    if (!strip || stripToasted.current || resolved.mode !== "paged") return;
    stripToasted.current = true;
    toast("Este capítulo viene en tiras verticales (webtoon): se lee en cascada.", { duration: 5000 });
  }, [strip, resolved.mode]);

  // Resume from stored progress once (unless the URL asked for a specific page).
  useEffect(() => {
    if (resumed.current || !libHydrated) return;
    resumed.current = true;
    if (initialPage == null && storedProgress && !storedProgress.completed && storedProgress.page > 0) {
      // Syncing from the persisted store once it hydrates (it is not available during the first render).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(Math.min(pages.length - 1, storedProgress.page));
      toast(`Reanudado en la página ${storedProgress.page + 1}`, { action: { label: "Desde el inicio", onClick: () => setPage(0) } });
    }
  }, [initialPage, libHydrated, pages.length, storedProgress]);

  // Persist progress (throttled inside the store) and keep the URL shareable.
  useEffect(() => {
    if (!libHydrated) return;
    session.current.pages.add(page);
    record({ mangaId, snapshot, chapterId: chapter.id, chapterLabel: chapter.label, chapterNumber: chapter.number, regular: chapter.regular, page: lastVisiblePage, pageCount: pages.length });
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(page + 1));
    window.history.replaceState(window.history.state, "", url);
  }, [chapter, lastVisiblePage, libHydrated, mangaId, page, pages.length, record, snapshot]);

  const lastVisiblePageRef = useRef(lastVisiblePage);
  useEffect(() => {
    lastVisiblePageRef.current = lastVisiblePage;
  }, [lastVisiblePage]);

  // Measured reading time: counts only while visible and the reader was used in the last 60 s.
  useEffect(() => {
    const s = session.current;
    stamp(s, true);
    const tick = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - s.lastInput < 60_000) s.active += 1;
    }, 1000);
    const flush = () => {
      record({ mangaId, snapshot, chapterId: chapter.id, chapterLabel: chapter.label, chapterNumber: chapter.number, regular: chapter.regular, page: lastVisiblePageRef.current, pageCount: pages.length }, { flush: true });
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
      recordSession({ mangaId, chapterId: chapter.id, startedAt: s.startedAt, endedAt: Date.now(), activeSeconds: s.active, pagesViewed: s.pages.size });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  useEffect(() => {
    if (prefs.fullscreenOnOpen && settingsHydrated && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    containerRef.current?.focus();
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [prefs.fullscreenOnOpen, settingsHydrated]);

  // Page sizes come from the measured stage, so a page is never larger than the area that shows it.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStage({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Lock page scroll behind the overlay.
  useEffect(() => {
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevOverflow;
    };
  }, []);

  const goToChapter = (c: ReaderChapter | null) => c && router.push(`/manga/read/${slug}/${c.id}`);

  const navigate = (intent: NavIntent) => {
      stamp(session.current);
      if (intent === "toggle-ui") return animation === "focus" ? setFocusUi((v) => !v) : setUi((v) => !v);
      if (intent === "none") return;
      if (mode !== "paged") {
        const el = scrollRef.current;
        if (!el) return;
        if (intent === "first") el.scrollTo({ top: 0 });
        else if (intent === "last") el.scrollTo({ top: el.scrollHeight });
        else el.scrollBy({ top: (intent === "next" ? 1 : -1) * el.clientHeight * 0.85, behavior: reduced ? "auto" : "smooth" });
        return;
      }
      if (end && intent === "prev") return setEnd(false);
      const r = step(views.length, viewIndex, intent);
      if (r.boundary === "end") return setEnd(true);
      if (r.boundary === "start") {
        if (prev) toast("Estás en la primera página", { action: { label: `Ir a ${prev.label}`, onClick: () => goToChapter(prev) } });
        return;
      }
      if (r.view === viewIndex) return;
      const dir = r.view > viewIndex ? 1 : -1;
      setDirSign(dir);
      if (bookFlip) setFlip({ from: currentView, to: views[r.view], dir, key: ++flipSeq.current });
      setZoom(startZoom(views[r.view]));
      setPage(views[r.view][0]);
  };

  const toggleBookmark = () => {
    if (pageBookmarked) {
      removeBookmark(pageBookmarked.id);
      toast("Marcador eliminado");
    } else {
      addBookmark({ mangaId, chapterId: chapter.id, chapterLabel: chapter.label, page: lastVisiblePage, note: "" });
      toast.success(`Marcador en la página ${lastVisiblePage + 1}`);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => toast.error("Tu navegador no permite pantalla completa aquí"));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (settingsOpen || listOpen || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === "f" || k === "F") return toggleFullscreen();
    if (k === "b" || k === "B") return toggleBookmark();
    if (k === "s" || k === "S") return setSettingsOpen(true);
    if (k === "+" || k === "=") return zoomBy(1.25);
    if (k === "-") return zoomBy(0.8);
    if (k === "0") return mode === "paged" ? resetZoom() : zoomColumn("reset");
    if (k === "Escape" && mode === "paged" && zoom.scale > 1) return resetZoom();
    if (mode === "paged" && pannable && k.startsWith("Arrow")) {
      // While zoomed (or on a page taller than the screen) arrows move around the page instead of turning it.
      const d = 140;
      const dx = k === "ArrowLeft" ? d : k === "ArrowRight" ? -d : 0, dy = k === "ArrowUp" ? d : k === "ArrowDown" ? -d : 0;
      const nextZ = clampPan({ ...zoom, x: zoom.x + dx, y: zoom.y + dy }, extent, stageBox);
      if (nextZ.x !== zoom.x || nextZ.y !== zoom.y || zoom.scale > 1.001) {
        e.preventDefault();
        return setZoom(nextZ);
      }
    }
    const intent = keyToIntent(k, direction, mode);
    if (intent !== "none") {
      e.preventDefault();
      navigate(intent);
    }
  };

  // Pointer gestures (paged mode): tap zones, swipes, pinch-zoom around the fingers and drag-to-pan.
  const tapTimer = useRef(0);
  const stagePoint = (x: number, y: number) => {
    const r = stageRef.current?.getBoundingClientRect();
    return r ? { x: x - r.left, y: y - r.top } : { x, y };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    stamp(session.current);
    if ((e.target as HTMLElement).closest("button,a,input,select")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, pinch0: Math.hypot(a.x - b.x, a.y - b.y), scale0: zoom.scale, panX: zoom.x, panY: zoom.y, moved: true };
    } else gesture.current = { x: e.clientX, y: e.clientY, panX: zoom.x, panY: zoom.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.size === 2 && g.pinch0) {
      const [a, b] = [...pointers.current.values()];
      const p = stagePoint(g.x, g.y);
      const from = { scale: g.scale0 ?? 1, x: g.panX ?? 0, y: g.panY ?? 0 };
      setPanning(true);
      applyZoom(zoomAt(from, from.scale * (Math.hypot(a.x - b.x, a.y - b.y) / g.pinch0), p.x, p.y, stageBox));
      return;
    }
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) > 8) {
      g.moved = true;
      // Keep receiving the drag even if the pointer leaves the stage.
      if (pannable) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (pannable && g.moved) {
      setPanning(true);
      setZoom(clampPan({ scale: zoom.scale, x: (g.panX ?? 0) + dx, y: (g.panY ?? 0) + dy }, extent, stageBox));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    gesture.current = null;
    setPanning(false);
    if (!g || g.pinch0 || mode !== "paged") return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (g.moved) {
      if (!pannable) navigate(swipeToIntent(dx, dy, direction));
      return;
    }
    if (zoom.scale > 1.001) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const intent = tapToIntent((e.clientX - rect.left) / rect.width, direction);
    window.clearTimeout(tapTimer.current);
    if (!prefs.zoomOnDoubleClick) return navigate(intent);
    // Wait a moment: a second tap means "zoom here", not "turn the page".
    tapTimer.current = window.setTimeout(() => navigate(intent), 230);
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    if (!prefs.zoomOnDoubleClick || mode !== "paged") return;
    window.clearTimeout(tapTimer.current);
    const p = stagePoint(e.clientX, e.clientY);
    if (zoom.scale > 1.001) resetZoom();
    else applyZoom(zoomAt(zoom, 2.5, p.x, p.y, stageBox));
  };

  // Mouse wheel / trackpad. Ctrl + wheel (and trackpad pinch) zooms at the cursor in both modes. In paged
  // mode a plain wheel moves around a zoomed or long page and turns the page once that page is used up.
  const wheel = useRef({ acc: 0, last: 0 });
  const onWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    onWheelRef.current = (e: WheelEvent) => {
      if (settingsOpen || listOpen) return;
      stamp(session.current);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0045);
        if (mode !== "paged") return zoomColumn(factor);
        const p = stagePoint(e.clientX, e.clientY);
        return applyZoom(zoomAt(zoom, zoom.scale * factor, p.x, p.y, stageBox));
      }
      if (mode !== "paged" || end) return;
      e.preventDefault();
      if (pannable) {
        const nextZ = clampPan({ ...zoom, x: zoom.x - e.deltaX, y: zoom.y - e.deltaY }, extent, stageBox);
        if (Math.abs(nextZ.y - zoom.y) > 0.5 || Math.abs(nextZ.x - zoom.x) > 0.5) return setZoom(nextZ);
        if (zoom.scale > 1.001) return;
      }
      const now = Date.now();
      const w = wheel.current;
      if (now - w.last < 450) return;
      w.acc += e.deltaY + e.deltaX;
      if (Math.abs(w.acc) < 60) return;
      navigate(w.acc > 0 ? "next" : "prev");
      w.acc = 0;
      w.last = now;
    };
  });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => onWheelRef.current(e);
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  // Vertical modes: track the most visible page to update progress.
  useEffect(() => {
    if (mode === "paged") return;
    const io = new IntersectionObserver(
      (entries) => {
        const best = entries.filter((x) => x.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) setPage(Number((best.target as HTMLElement).dataset.index));
      },
      { root: scrollRef.current, threshold: [0.25, 0.5, 0.75] },
    );
    pageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [mode, pages.length]);
  // Scroll to the resume point when entering a vertical mode.
  useEffect(() => {
    if (mode === "paged") return;
    pageRefs.current[page]?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Warm the browser cache for a bounded window around the current page (never the whole chapter).
  const preloadAhead = prefs.dataSaver ? Math.min(2, prefs.preload) : prefs.preload;
  useEffect(() => {
    if (mode !== "paged") return;
    for (const i of preloadWindow(page, pages.length, preloadAhead)) {
      if (i === page) continue;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => reportSize(i, img.naturalWidth, img.naturalHeight);
      img.src = dataSaver && pages[i].srcLow ? pages[i].srcLow : pages[i].src;
    }
  }, [mode, page, pages, preloadAhead, dataSaver]);

  // Outside Focus mode the bars get their own space, so they never sit on top of a panel or a balloon.
  const reserveSpace = animation !== "focus";
  const reserve = reserveSpace
    ? { top: "calc(3.5rem + env(safe-area-inset-top))", bottom: prefs.showKeyboardHints ? "calc(5.25rem + env(safe-area-inset-bottom))" : "calc(4.25rem + env(safe-area-inset-bottom))" }
    : { top: 0, bottom: 0 };
  const pct = progressPercent(lastVisiblePage, pages.length);
  const bg = prefs.background;
  const showUi = (animation === "focus" ? focusUi : ui) || end;
  const enterVariants = {
    classic: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
    focus: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
    smooth: { initial: { opacity: 0, x: (direction === "rtl" ? -1 : 1) * dirSign * 60 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: (direction === "rtl" ? 1 : -1) * dirSign * 60 } },
    cinematic: {
      initial: { opacity: 0, rotateY: (direction === "rtl" ? 1 : -1) * dirSign * 14, x: (direction === "rtl" ? -1 : 1) * dirSign * 80, scale: 0.97 },
      animate: { opacity: 1, rotateY: 0, x: 0, scale: 1 },
      exit: { opacity: 0, rotateY: (direction === "rtl" ? -1 : 1) * dirSign * 10, x: (direction === "rtl" ? 1 : -1) * dirSign * 60, scale: 0.98 },
    },
  }[animation];

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="lector de manga"
      aria-label={`${seriesTitle}, ${chapter.label}`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="km-reader fixed inset-0 z-[60] flex flex-col outline-none"
      data-bg={bg}
    >
      <p className="sr-only" aria-live="polite">
        {end ? "Fin del capítulo" : `Página ${lastVisiblePage + 1} de ${pages.length}`}
      </p>

      {/* atmospheric backdrop (cinematic only): a blurred copy behind the page — the artwork itself is untouched */}
      {animation === "cinematic" && mode === "paged" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <AnimatePresence>
            <motion.div key={pages[currentView[0]]?.src} initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} className="absolute inset-[-10%]" style={{ backgroundImage: `url(${pages[currentView[0]]?.src})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(48px) saturate(1.2)" }} />
          </AnimatePresence>
        </div>
      )}

      {/* top bar */}
      <AnimatePresence>
        {showUi && (
          <motion.header initial={{ y: -64, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -64, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.2 }} className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-black/75 px-3 py-2 text-white backdrop-blur-md pt-[max(0.5rem,env(safe-area-inset-top))]">
            <Link href={`/manga/${slug}`} className="k-btn k-btn-icon k-btn-sm !bg-white/10 !text-white" aria-label="Salir del lector">
              <X className="size-4" aria-hidden />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{seriesTitle}</p>
              <p className="truncate text-xs text-white/70">
                {chapter.label}
                {chapter.title ? ` · ${chapter.title}` : ""}
              </p>
            </div>
            {/* Control directo de modo: Libro vs Cascada */}
            <button
              type="button"
              className="k-btn k-btn-sm !bg-white/10 !text-white flex items-center gap-1.5 px-2.5 text-xs font-medium disabled:opacity-60"
              disabled={strip}
              title={strip ? "Este capítulo viene en tiras verticales: solo se puede leer en cascada" : mode === "paged" ? "Cambiar a modo Cascada (Webtoon)" : "Cambiar a modo Libro (Paginado)"}
              onClick={() => setReader({ mode: mode === "paged" ? "webtoon" : "paged" })}
            >
              {mode === "paged" ? <BookOpen className="size-3.5" /> : <ScrollText className="size-3.5" />}
              <span className="max-sm:hidden">{mode === "paged" ? "Libro" : "Cascada"}</span>
            </button>

            {/* Control directo de dirección de lectura */}
            {mode === "paged" && (
              <button
                type="button"
                className="k-btn k-btn-sm !bg-white/10 !text-white flex items-center gap-1 px-2 text-xs font-medium max-md:hidden"
                title={direction === "rtl" ? "Lectura: Derecha a Izquierda. Clic para Izq. a Der." : "Lectura: Izquierda a Derecha. Clic para Der. a Izq."}
                onClick={() => setReader({ direction: direction === "rtl" ? "ltr" : "rtl" })}
              >
                <span>{direction === "rtl" ? "RTL ◀" : "LTR ▶"}</span>
              </button>
            )}

            {/* Control directo de doble página */}
            {mode === "paged" && viewport.width >= 1024 && (
              <button
                type="button"
                className="k-btn k-btn-sm !bg-white/10 !text-white flex items-center gap-1 px-2 text-xs font-medium max-lg:hidden"
                title={layout === "double" ? "Vista de 2 páginas (libro abierto). Clic para 1 página" : "Vista de 1 página. Clic para 2 páginas"}
                onClick={() => setReader({ layout: layout === "double" ? "single" : "double" })}
              >
                <Columns2 className="size-3.5" />
                <span>{layout === "double" ? "2 Págs" : "1 Pág"}</span>
              </button>
            )}

            <button type="button" className="k-btn k-btn-icon k-btn-sm !bg-white/10 !text-white" aria-label="Lista de capítulos" aria-expanded={listOpen} onClick={() => setListOpen((v) => !v)}>
              <List className="size-4" aria-hidden />
            </button>
            <button type="button" className="k-btn k-btn-icon k-btn-sm !bg-white/10 !text-white" aria-label={pageBookmarked ? "Quitar marcador" : "Añadir marcador"} aria-pressed={Boolean(pageBookmarked)} onClick={toggleBookmark}>
              {pageBookmarked ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
            </button>
            <div className="flex items-center rounded-full bg-white/10" role="group" aria-label="Zoom">
              <button type="button" className="k-btn k-btn-icon k-btn-sm !bg-transparent !text-white" aria-label="Alejar" onClick={() => zoomBy(0.8)} disabled={mode === "paged" ? zoom.scale <= 1.001 : colScale <= 0.5}>
                <ZoomOut className="size-4" aria-hidden />
              </button>
              <button type="button" className="min-w-[3.25rem] px-1 text-center font-mono text-xs tabular-nums text-white/90 hover:text-white" aria-label={`Zoom al ${zoomPct}%. Restablecer`} onClick={() => (mode === "paged" ? resetZoom() : zoomColumn("reset"))}>
                {zoomPct}%
              </button>
              <button type="button" className="k-btn k-btn-icon k-btn-sm !bg-transparent !text-white" aria-label="Ampliar" onClick={() => zoomBy(1.25)} disabled={mode === "paged" ? zoom.scale >= 4.99 : colScale >= 3}>
                <ZoomIn className="size-4" aria-hidden />
              </button>
            </div>
            <button type="button" className="k-btn k-btn-icon k-btn-sm !bg-white/10 !text-white" aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="size-4" aria-hidden /> : <Expand className="size-4" aria-hidden />}
            </button>
            <button type="button" className="k-btn k-btn-icon k-btn-sm !bg-white/10 !text-white" aria-label="Ajustes de lectura" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="size-4" aria-hidden />
            </button>
          </motion.header>
        )}
      </AnimatePresence>

      {/* chapter list & bookmarks */}
      <AnimatePresence>
        {listOpen && (
          <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: reduced ? 0 : 0.25 }} className="absolute inset-y-0 left-0 z-30 w-[min(86vw,340px)] overflow-y-auto bg-black/90 p-4 pt-16 text-white backdrop-blur" aria-label="Capítulos y marcadores">
            <h2 className="k-label text-white/60">Capítulos</h2>
            <ol className="mt-2 space-y-1">
              {chapters.map((c) => (
                <li key={c.id}>
                  <Link href={`/manga/read/${slug}/${c.id}`} aria-current={c.id === chapter.id ? "page" : undefined} className={cn("block rounded px-2 py-2 text-sm hover:bg-white/10", c.id === chapter.id && "bg-white/15 font-semibold")} onClick={() => setListOpen(false)}>
                    {c.label}
                    {c.title ? ` · ${c.title}` : ""}
                  </Link>
                </li>
              ))}
            </ol>
            <h2 className="k-label mt-6 text-white/60">Marcadores de este capítulo</h2>
            {chapterBookmarks.length ? (
              <ul className="mt-2 space-y-1">
                {chapterBookmarks
                  .sort((a, b) => a.page - b.page)
                  .map((b) => (
                    <li key={b.id} className="flex items-center gap-2">
                      <button type="button" className="flex-1 rounded px-2 py-2 text-left text-sm hover:bg-white/10" onClick={() => (setPage(b.page), setListOpen(false), setEnd(false))}>
                        Página {b.page + 1}
                      </button>
                      <button type="button" className="k-btn k-btn-icon k-btn-sm !bg-white/10 !text-white" aria-label={`Eliminar marcador de la página ${b.page + 1}`} onClick={() => removeBookmark(b.id)}>
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-white/60">Pulsa B o el icono de marcador para guardar una página.</p>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* stage */}
      {mode === "paged" ? (
        <div
          ref={stageRef}
          className="absolute inset-x-0 touch-none select-none overflow-hidden"
          style={{ ...reserve, cursor: pannable ? (panning ? "grabbing" : "grab") : undefined }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {end ? (
              <motion.div key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center p-6 text-center">
                <div className="max-w-md">
                  <p className="k-label opacity-70">Fin del capítulo</p>
                  <p className="km-title mt-2 text-3xl">{chapter.label}</p>
                  {isChapterComplete(lastVisiblePage, pages.length) && <p className="mt-2 text-sm opacity-70">Capítulo marcado como leído.</p>}
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {next ? (
                      <button type="button" className="k-btn k-btn-primary" onClick={() => goToChapter(next)}>
                        Siguiente: {next.label} {direction === "rtl" ? <ChevronLeft className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                      </button>
                    ) : (
                      <p className="text-sm opacity-80">Has llegado al último capítulo disponible.</p>
                    )}
                    <button type="button" className="k-btn k-btn-ghost" onClick={() => setEnd(false)}>
                      Volver a la última página
                    </button>
                    <Link href={`/manga/${slug}`} className="k-btn k-btn-ghost">
                      Ficha de la obra
                    </Link>
                  </div>
                </div>
              </motion.div>
            ) : bookFlip ? (
              <motion.div key="book" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                <div className={cn("absolute inset-0 origin-center", !panning && "transition-transform duration-200 ease-out")} style={{ transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})` }}>
                  <BookStage
                    view={currentView}
                    flip={flip}
                    direction={direction}
                    duration={flipDur}
                    onFlipDone={(key) => setFlip((f) => (f?.key === key ? null : f))}
                    pages={pages}
                    size={sizeOf}
                    stage={stageBox}
                    fit={prefs.fit}
                    dataSaver={dataSaver}
                    onSize={reportSize}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div key={currentView.join("-")} {...enterVariants} transition={{ duration: dur, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0" style={{ transformStyle: animation === "cinematic" ? "preserve-3d" : undefined, perspective: animation === "cinematic" ? 1800 : undefined }}>
                <div className={cn("absolute inset-0 origin-center", !panning && "transition-transform duration-200 ease-out")} style={{ transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})` }}>
                  <Spread view={currentView} direction={direction} pages={pages} size={sizeOf} stage={stageBox} fit={prefs.fit} dataSaver={dataSaver} onSize={reportSize} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div ref={(el) => void ((scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el, (stageRef as React.MutableRefObject<HTMLDivElement | null>).current = el)} className="absolute inset-0 overflow-auto overscroll-contain" onScroll={() => stamp(session.current)} onClick={(e) => !(e.target as HTMLElement).closest("button,a") && navigate("toggle-ui")}>
          <div className="mx-auto flex flex-col items-center" style={{ width: Math.round(Math.min(stageBox.width, strip ? 760 : 850) * colScale), maxWidth: colScale <= 1 ? "100%" : undefined, gap: mode === "vertical" ? prefs.pageGap : (strip ? 0 : 16), paddingTop: reserveSpace ? "4rem" : 0, paddingBottom: reserveSpace ? "6rem" : 0 }}>
            {pages.map((a, i) => (
              <div key={a.src} data-index={i} ref={(el) => void (pageRefs.current[i] = el)} className={cn("w-full flex justify-center", !strip && prefs.fit !== "width" && "max-h-[calc(100dvh-5rem)]")}>
                <PageImage
                  asset={{ ...a, width: sizeOf(i).w, height: sizeOf(i).h }}
                  dataSaver={dataSaver}
                  eager={Math.abs(i - page) <= prefs.preload}
                  className={cn(
                    strip || prefs.fit === "width"
                      ? "w-full [&_img]:w-full"
                      : "h-auto max-h-[calc(100dvh-5rem)] w-auto max-w-full [&_img]:max-h-[calc(100dvh-5rem)] [&_img]:w-auto [&_img]:object-contain"
                  )}
                  onSize={(w, h) => reportSize(i, w, h)}
                />
              </div>
            ))}
            <div className="w-full max-w-md p-8 text-center">
              <p className="k-label opacity-70">Fin del capítulo</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {next ? (
                  <Link href={`/manga/read/${slug}/${next.id}`} className="k-btn k-btn-primary">
                    Siguiente: {next.label}
                  </Link>
                ) : (
                  <p className="text-sm opacity-80">Último capítulo disponible.</p>
                )}
                <Link href={`/manga/${slug}`} className="k-btn k-btn-ghost">
                  Ficha de la obra
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* brightness overlay */}
      {prefs.dim > 0 && <div aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-black" style={{ opacity: prefs.dim }} />}

      {/* bottom bar */}
      <AnimatePresence>
        {showUi && (
          <motion.footer initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.2 }} className="absolute inset-x-0 bottom-0 z-20 bg-black/75 px-3 pt-2 text-white backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-4xl items-center gap-3">
              <button type="button" className="k-btn k-btn-sm !bg-white/10 !text-white" disabled={!(direction === "rtl" ? next : prev)} onClick={() => goToChapter(direction === "rtl" ? next : prev)} aria-label={direction === "rtl" ? "Sig. capítulo" : "Ant. capítulo"}>
                <ChevronLeft className="size-4" aria-hidden />
                <span className="max-sm:hidden">{direction === "rtl" ? "Sig." : "Ant."}</span>
              </button>
              <label className="sr-only" htmlFor="reader-page">
                Página
              </label>
              <input
                id="reader-page"
                type="range"
                min={1}
                max={pages.length}
                value={lastVisiblePage + 1}
                dir={direction === "rtl" && mode === "paged" ? "rtl" : "ltr"}
                onChange={(e) => {
                  const p = Number(e.target.value) - 1;
                  setEnd(false);
                  if (mode === "paged") setPage(p);
                  else pageRefs.current[p]?.scrollIntoView({ block: "start" });
                }}
                className="min-w-0 flex-1 accent-[var(--k-primary)]"
                aria-valuetext={`Página ${lastVisiblePage + 1} de ${pages.length}`}
              />
              <span className="w-20 text-center font-mono text-xs tabular-nums">
                {currentView.length > 1 ? `${Math.min(...currentView) + 1}-${lastVisiblePage + 1}` : lastVisiblePage + 1} / {pages.length}
              </span>
              <button type="button" className="k-btn k-btn-sm !bg-white/10 !text-white" disabled={!(direction === "rtl" ? prev : next)} onClick={() => goToChapter(direction === "rtl" ? prev : next)} aria-label={direction === "rtl" ? "Ant. capítulo" : "Sig. capítulo"}>
                <span className="max-sm:hidden">{direction === "rtl" ? "Ant." : "Sig."}</span>
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <div className="mx-auto mt-2 h-0.5 max-w-4xl overflow-hidden rounded bg-white/15" role="progressbar" aria-label="Progreso del capítulo" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
            {prefs.showKeyboardHints && (
              <p className="mx-auto mt-1.5 max-w-4xl text-center text-[0.625rem] text-white/50 max-md:hidden">
                {mode === "paged" ? (direction === "rtl" ? "← siguiente · → anterior" : "→ siguiente · ← anterior") : "Espacio / RePág para desplazarte"} · F pantalla completa · B marcador · S ajustes · Ctrl + rueda o doble clic para zoom
              </p>
            )}
          </motion.footer>
        )}
      </AnimatePresence>

      {!showUi && animation !== "focus" && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/10">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}

      <ReaderSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
