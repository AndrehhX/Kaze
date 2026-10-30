"use client";

/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect -- the player drives imperative browser media APIs (HTMLVideoElement, hls.js, TextTrack) from effects and handlers by design. */

import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Captions,
  Check,
  ChevronRight,
  Gauge,
  ListVideo,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  RotateCcw,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { PlaybackGrant, TimingMarker } from "@/lib/media/types";
import { useSettings } from "@/stores/settings";
import { useProgress } from "@/stores/progress";
import { clamp, cn, formatDuration } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";
import { useHls } from "./use-hls";
import { activeCues, CAPTION_COLORS, CAPTION_SIZES, cueText, type Cue } from "./captions";

export type PlayerSync = {
  /** Guests cannot play/pause/seek; the host's state drives them. */
  locked: boolean;
  onLocalAction?: (a: { type: "play" | "pause" | "seek"; position: number }) => void;
  banner?: ReactNode;
};

type Props = {
  grant: PlaybackGrant;
  onNavigateEpisode?: (episodeId: string) => void;
  onVideo?: (v: HTMLVideoElement | null) => void;
  sync?: PlayerSync;
  autoPlay?: boolean;
  /** Persist watch progress (disabled for watch-party guests is not needed; always on). */
  persist?: boolean;
};

type Menu = null | "root" | "quality" | "speed" | "subs" | "audio" | "caption-style";
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function Player({ grant, onNavigateEpisode, onVideo, sync, autoPlay = true, persist = true }: Props) {
  const asset = grant.asset;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const ambientRef = useRef<HTMLCanvasElement>(null);
  const [retryKey, setRetryKey] = useState(0);
  const { state: hs, setLevel, setAudio, setHlsSubtitle, hls } = useHls(video, asset, retryKey);
  const prefs = useSettings((s) => s.player);
  const setPrefs = useSettings((s) => s.setPlayer);
  const saveProgress = useProgress((s) => s.save);
  const { reduced, theme } = useKazeMotion();

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(asset.duration);
  const [buffered, setBuffered] = useState<[number, number][]>([]);
  const [waiting, setWaiting] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menu, setMenu] = useState<Menu>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [subDelay, setSubDelay] = useState(0);
  const [cues, setCues] = useState<Cue[]>([]);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ key: number; icon: ReactNode; label: string } | null>(null);
  const [stats, setStats] = useState<Record<string, string>>({});
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(0);
  const resumed = useRef(false);
  const skippedMarkers = useRef(new Set<string>());
  const locked = Boolean(sync?.locked);

  const fatal = hs.fatal ?? mediaError;

  const refVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      setVideo(el);
      onVideo?.(el);
    },
    [onVideo],
  );

  // ── Progress persistence ────────────────────────────────────────────
  const persistNow = useCallback(
    (flush = false) => {
      if (!persist || !video || !Number.isFinite(video.duration) || video.duration <= 0) return;
      saveProgress({ seriesId: grant.series.id, episodeId: grant.episode.id, position: video.currentTime, duration: video.duration, title: grant.episode.title }, { flush });
      lastSaved.current = Date.now();
    },
    [persist, video, saveProgress, grant.series.id, grant.episode.id, grant.episode.title],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && persistNow(true);
    const onUnload = () => persistNow(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onUnload);
      persistNow(true);
    };
  }, [persistNow]);

  // ── Video element events ────────────────────────────────────────────
  useEffect(() => {
    if (!video) return;
    video.volume = prefs.volume;
    video.muted = prefs.muted;
    video.playbackRate = prefs.rate;
    const onTime = () => {
      setTime(video.currentTime);
      if (Date.now() - lastSaved.current > 5000) persistNow();
    };
    const onMeta = () => {
      setDuration(video.duration || asset.duration);
      setWaiting(false);
      if (!resumed.current && !locked) {
        resumed.current = true;
        const saved = useProgress.getState().get(grant.series.id, grant.episode.id);
        if (saved && !saved.completed && saved.position > 5 && saved.position < (video.duration || Infinity) - 10) {
          video.currentTime = saved.position;
          toast(`Resumed at ${formatDuration(saved.position)}`, { action: { label: "Start over", onClick: () => (video.currentTime = 0) } });
        }
      }
      if (autoPlay && !locked) video.play().catch(() => setPlaying(false));
    };
    const onProgress = () => {
      const r: [number, number][] = [];
      for (let i = 0; i < video.buffered.length; i++) r.push([video.buffered.start(i), video.buffered.end(i)]);
      setBuffered(r);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      persistNow(true);
    };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onEnded = () => {
      setPlaying(false);
      persistNow(true);
      if (grant.next && prefs.autoNext && onNavigateEpisode && !locked) setNextCountdown(8);
    };
    const onError = () => {
      if (video.error && !hls.current) setMediaError("This video couldn't be played.");
    };
    const onVolume = () => setPrefs({ volume: video.volume, muted: video.muted });
    const onRate = () => setPrefs({ rate: video.playbackRate });
    const onPip = () => setPip(document.pictureInPictureElement === video);
    const evs: [string, EventListener][] = [
      ["timeupdate", onTime],
      ["loadedmetadata", onMeta],
      ["durationchange", () => setDuration(video.duration || asset.duration)],
      ["progress", onProgress],
      ["play", onPlay],
      ["pause", onPause],
      ["waiting", onWaiting],
      ["playing", onPlaying],
      ["canplay", onPlaying],
      ["ended", onEnded],
      ["error", onError],
      ["volumechange", onVolume],
      ["ratechange", onRate],
      ["enterpictureinpicture", onPip],
      ["leavepictureinpicture", onPip],
    ];
    evs.forEach(([e, f]) => video.addEventListener(e, f));
    return () => evs.forEach(([e, f]) => video.removeEventListener(e, f));
    // prefs are read at attach time only; later changes flow through the element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, grant.episode.id]);

  useEffect(() => {
    resumed.current = false;
    skippedMarkers.current.clear();
    setNextCountdown(null);
    setMediaError(null);
    setWaiting(true);
  }, [grant.episode.id]);

  // ── Fullscreen ─────────────────────────────────────────────────────
  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.();
    } catch {
      toast.error("Fullscreen isn't available here");
    }
  }, [video]);

  const togglePip = useCallback(async () => {
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      toast.error("Picture-in-picture isn't supported in this browser");
    }
  }, [video]);

  // ── Controls auto-hide ─────────────────────────────────────────────
  const poke = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!wrapRef.current?.matches(":focus-within") || document.activeElement === wrapRef.current) setControlsVisible(false);
    }, 2800);
  }, []);
  useEffect(() => {
    if (!playing || menu || showEpisodes) {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else poke();
  }, [playing, menu, showEpisodes, poke]);

  // ── Actions ────────────────────────────────────────────────────────
  const flashIcon = (icon: ReactNode, label: string) => setFlash({ key: Date.now(), icon, label });

  const togglePlay = useCallback(() => {
    if (!video || locked) return;
    if (video.paused) {
      video.play().catch(() => toast.error("Playback was blocked by the browser. Press play again."));
      sync?.onLocalAction?.({ type: "play", position: video.currentTime });
      flashIcon(<Play className="size-8 fill-current" />, "Play");
    } else {
      video.pause();
      sync?.onLocalAction?.({ type: "pause", position: video.currentTime });
      flashIcon(<Pause className="size-8 fill-current" />, "Pause");
    }
  }, [video, locked, sync]);

  const seekTo = useCallback(
    (t: number) => {
      if (!video || locked) return;
      const d = Number.isFinite(video.duration) ? video.duration : duration;
      video.currentTime = clamp(t, 0, Math.max(0, d - 0.25));
      setTime(video.currentTime);
      sync?.onLocalAction?.({ type: "seek", position: video.currentTime });
    },
    [video, locked, duration, sync],
  );

  const changeVolume = (v: number) => {
    if (!video) return;
    video.volume = clamp(v, 0, 1);
    video.muted = v <= 0;
  };

  // ── Skip markers ───────────────────────────────────────────────────
  const marker: TimingMarker | undefined = asset.markers.find((m) => time >= m.start && time < m.end - 1);
  useEffect(() => {
    if (!marker || locked) return;
    const key = `${marker.kind}-${marker.start}`;
    const auto = (marker.kind === "intro" && prefs.autoSkipIntro) || (marker.kind === "outro" && prefs.autoSkipOutro);
    if (auto && !skippedMarkers.current.has(key)) {
      skippedMarkers.current.add(key);
      seekTo(marker.end);
      toast(`Skipped ${marker.kind}`);
    }
  }, [marker, prefs.autoSkipIntro, prefs.autoSkipOutro, seekTo, locked]);

  // ── Auto-next countdown ────────────────────────────────────────────
  useEffect(() => {
    if (nextCountdown == null) return;
    if (nextCountdown <= 0) {
      setNextCountdown(null);
      if (grant.next) onNavigateEpisode?.(grant.next.id);
      return;
    }
    const t = setTimeout(() => setNextCountdown((n) => (n == null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [nextCountdown, grant.next, onNavigateEpisode]);

  // ── Subtitles: own renderer (styling + delay) ──────────────────────
  const subTrackEls = useRef<Record<string, HTMLTrackElement | null>>({});
  useEffect(() => {
    if (!video) return;
    const pick = prefs.subtitleLang;
    if (subId === null && pick && hs.subtitleTracks.length) {
      const t = hs.subtitleTracks.find((x) => x.lang === pick);
      if (t) setSubId(t.id);
    }
  }, [hs.subtitleTracks, prefs.subtitleLang, subId, video]);

  useEffect(() => {
    if (!video) return;
    const sel = hs.subtitleTracks.find((t) => t.id === subId);
    if (sel?.source === "hls") setHlsSubtitle(sel.hlsIndex!);
    else setHlsSubtitle(-1);
    let track: TextTrack | null = null;
    const resolve = () => {
      for (const t of Array.from(video.textTracks)) t.mode = "hidden";
      if (!sel) return null;
      if (sel.source === "sidecar") return subTrackEls.current[sel.id]?.track ?? null;
      return Array.from(video.textTracks).find((t) => t.label === sel.label && (t.kind === "subtitles" || t.kind === "captions")) ?? null;
    };
    track = resolve();
    const read = () => {
      if (!track?.cues) return setCues([]);
      setCues(Array.from(track.cues).map((c) => ({ start: c.startTime, end: c.endTime, text: cueText((c as VTTCue).text ?? "") })));
    };
    read();
    const onAdd = () => {
      track = resolve();
      read();
    };
    video.textTracks.addEventListener("addtrack", onAdd);
    const poll = setInterval(read, 2000); // segmented subtitle playlists append cues over time
    track?.addEventListener("cuechange", read);
    return () => {
      video.textTracks.removeEventListener("addtrack", onAdd);
      track?.removeEventListener("cuechange", read);
      clearInterval(poll);
    };
  }, [subId, hs.subtitleTracks, video, setHlsSubtitle]);

  const visibleCues = subId ? activeCues(cues, time, subDelay) : [];

  // ── Ambient mode: soft glow sampled from the frame ─────────────────
  useEffect(() => {
    if (!prefs.ambient || !video || reduced) return;
    const c = ambientRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const t = setInterval(() => {
      if (video.readyState >= 2) {
        try {
          ctx.drawImage(video, 0, 0, c.width, c.height);
        } catch {
          /* cross-origin frames can't be drawn on some engines — ambient just stays dark */
        }
      }
    }, 400);
    return () => clearInterval(t);
  }, [prefs.ambient, video, reduced]);

  // ── Stats ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!prefs.showStats || !video) return;
    const t = setInterval(() => {
      const q = video.getVideoPlaybackQuality?.();
      let ahead = 0;
      for (let i = 0; i < video.buffered.length; i++) if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) ahead = video.buffered.end(i) - video.currentTime;
      const lvl = hs.levels.find((l) => l.index === hs.currentLevel);
      setStats({
        Engine: hs.engine ?? "—",
        Resolution: `${video.videoWidth}×${video.videoHeight}`,
        Rendition: lvl ? `${lvl.label} · ${Math.round(lvl.bitrate / 1000)} kbps${hs.autoLevel ? " (auto)" : ""}` : "—",
        Bandwidth: hls.current ? `${Math.round(hls.current.bandwidthEstimate / 1000)} kbps` : "—",
        "Buffer ahead": `${ahead.toFixed(1)} s`,
        "Dropped frames": q ? `${q.droppedVideoFrames} / ${q.totalVideoFrames}` : "—",
        Session: grant.sessionId.slice(0, 8),
      });
    }, 1000);
    return () => clearInterval(t);
  }, [prefs.showStats, video, hs, hls, grant.sessionId]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement).closest("[role=menu]")) return;
    const k = e.key.toLowerCase();
    const handled = () => {
      e.preventDefault();
      poke();
    };
    if (k === " " || k === "k") {
      if ((e.target as HTMLElement).tagName === "BUTTON" && k === " ") return;
      handled();
      togglePlay();
    } else if (k === "arrowright" || k === "l") {
      handled();
      seekTo(time + (k === "l" ? 10 : 5));
    } else if (k === "arrowleft" || k === "j") {
      handled();
      seekTo(time - (k === "j" ? 10 : 5));
    } else if (k === "arrowup") {
      handled();
      changeVolume((video?.volume ?? 1) + 0.05);
      flashIcon(<Volume2 className="size-8" />, `Volume ${Math.round(((video?.volume ?? 1) + 0.05) * 100)}%`);
    } else if (k === "arrowdown") {
      handled();
      changeVolume((video?.volume ?? 1) - 0.05);
    } else if (k === "m") {
      handled();
      if (video) video.muted = !video.muted;
    } else if (k === "f") {
      handled();
      toggleFullscreen();
    } else if (k === "t") {
      handled();
      setPrefs({ theater: !prefs.theater });
    } else if (k === "i") {
      handled();
      togglePip();
    } else if (k === "c") {
      handled();
      const first = hs.subtitleTracks[0];
      setSubId((cur) => (cur ? null : (first?.id ?? null)));
    } else if (k === "n" && e.shiftKey && grant.next && !locked) {
      handled();
      onNavigateEpisode?.(grant.next.id);
    } else if (k === "p" && e.shiftKey && grant.prev && !locked) {
      handled();
      onNavigateEpisode?.(grant.prev.id);
    } else if (/^[0-9]$/.test(k)) {
      handled();
      seekTo((Number(k) / 10) * duration);
    } else if (k === "escape" && menu) {
      handled();
      setMenu(null);
    }
  };

  const pct = duration ? (time / duration) * 100 : 0;
  const selectedSub = hs.subtitleTracks.find((t) => t.id === subId);
  const VolumeIcon = prefs.muted || prefs.volume === 0 ? VolumeX : prefs.volume < 0.5 ? Volume1 : Volume2;
  const showUi = controlsVisible || !playing || Boolean(fatal);

  const captionStyle = useMemo(() => {
    const s = prefs.subtitleStyle;
    return {
      fontSize: CAPTION_SIZES[s.size],
      color: CAPTION_COLORS[s.color],
      background: s.background === "box" ? "rgb(0 0 0 / 0.75)" : "transparent",
      textShadow: s.background === "shadow" ? "0 2px 3px #000, 0 0 2px #000, 0 0 12px rgb(0 0 0 / 0.8)" : "none",
    };
  }, [prefs.subtitleStyle]);

  return (
    <div className="relative">
      {prefs.ambient && !reduced && (
        <canvas ref={ambientRef} width={32} height={18} aria-hidden className="pointer-events-none absolute -inset-[6%] -z-10 size-[112%] opacity-60 blur-3xl saturate-150" />
      )}
      <div
        ref={wrapRef}
        tabIndex={0}
        role="region"
        aria-label={`Video player: ${grant.episode.title}`}
        aria-keyshortcuts="Space K J L F M C T I"
        onKeyDown={onKeyDown}
        onMouseMove={poke}
        onTouchStart={poke}
        className={cn(
          "group/player @container relative aspect-video w-full select-none overflow-hidden bg-black outline-none",
          fullscreen ? "" : theme === "cyber" ? "k-chamfer" : "rounded-[var(--k-radius-panel)]",
          !showUi && "cursor-none",
        )}
        data-controls={showUi ? "on" : "off"}
      >
        <video ref={refVideo} className="absolute inset-0 size-full" playsInline crossOrigin="anonymous" preload="metadata" onClick={() => (menu ? setMenu(null) : togglePlay())} onDoubleClick={toggleFullscreen}>
          {asset.subtitles.map((s, i) => (
            <track key={s.src} ref={(el) => void (subTrackEls.current[`side-${i}`] = el)} kind="subtitles" src={s.src} srcLang={s.lang} label={s.label} />
          ))}
        </video>

        {/* Captions */}
        {visibleCues.length > 0 && (
          <div className={cn("pointer-events-none absolute inset-x-0 z-[5] flex flex-col items-center gap-1 px-[6%] text-center transition-[bottom] duration-300", showUi ? "bottom-24" : "bottom-[7%]")} aria-live="off">
            {visibleCues.map((c, i) => (
              <span key={i} className="whitespace-pre-line rounded px-2 py-0.5 font-semibold leading-snug" style={captionStyle}>
                {c.text}
              </span>
            ))}
          </div>
        )}

        {/* Buffering */}
        {waiting && !fatal && (
          <div className="pointer-events-none absolute inset-0 z-[4] grid place-items-center" role="status" aria-label="Buffering">
            <Loader2 className="size-12 animate-spin text-white/90" aria-hidden />
          </div>
        )}

        {/* Center flash */}
        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.key}
              className="pointer-events-none absolute left-1/2 top-1/2 z-[6] grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white"
              initial={{ opacity: 0.9, scale: 0.8 }}
              animate={{ opacity: 0, scale: 1.25 }}
              transition={{ duration: reduced ? 0.2 : 0.6 }}
              onAnimationComplete={() => setFlash(null)}
              aria-hidden
            >
              {flash.icon}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fatal error */}
        {fatal && (
          <div role="alert" className="absolute inset-0 z-[20] grid place-items-center bg-black/80 p-6 text-center text-white">
            <div>
              <p className="font-display text-xl">Playback stopped</p>
              <p className="mt-2 max-w-sm text-sm text-white/75">{fatal}</p>
              <button
                className="k-btn k-btn-primary mt-5"
                onClick={() => {
                  setMediaError(null);
                  setRetryKey((k) => k + 1);
                }}
              >
                <RotateCcw className="size-4" aria-hidden /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Skip marker */}
        <AnimatePresence>
          {marker && !locked && !fatal && (
            <motion.button
              key={marker.kind}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="k-btn k-btn-primary absolute bottom-24 right-4 z-[12] sm:right-6"
              onClick={() => seekTo(marker.end)}
            >
              Skip {marker.kind === "intro" ? "intro" : marker.kind === "outro" ? "credits" : "recap"} <SkipForward className="size-4" aria-hidden />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Auto-next */}
        {nextCountdown != null && grant.next && (
          <div className="absolute bottom-24 right-4 z-[13] w-[min(80%,300px)] rounded-[var(--k-radius-card)] bg-black/85 p-4 text-white sm:right-6" role="status">
            <p className="text-xs uppercase tracking-wider text-white/60">Up next in {nextCountdown}s</p>
            <p className="mt-1 font-semibold">
              {grant.next.number}. {grant.next.title}
            </p>
            <div className="mt-3 flex gap-2">
              <button className="k-btn k-btn-primary k-btn-sm flex-1" onClick={() => onNavigateEpisode?.(grant.next!.id)}>
                Play now
              </button>
              <button className="k-btn k-btn-sm bg-white/10 text-white" onClick={() => setNextCountdown(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {sync?.banner && <div className="absolute left-3 top-3 z-[14]">{sync.banner}</div>}

        {/* Stats */}
        {prefs.showStats && (
          <div className="absolute left-3 top-3 z-[15] rounded-md bg-black/80 p-3 font-mono text-[0.6875rem] leading-5 text-white/90" aria-label="Playback statistics">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <span className="w-28 text-white/50">{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <button className="mt-1 text-white/60 underline" onClick={() => setPrefs({ showStats: false })}>
              close
            </button>
          </div>
        )}

        {/* Controls */}
        <div className={cn("absolute inset-x-0 bottom-0 z-[10] transition-opacity duration-300", showUi ? "opacity-100" : "pointer-events-none opacity-0")}>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          <div className="relative px-3 pb-2 sm:px-5 sm:pb-3">
            {/* Seek bar */}
            <div
              className={cn("group/seek relative flex h-6 items-center", locked ? "cursor-not-allowed" : "cursor-pointer")}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHoverX(clamp((e.clientX - r.left) / r.width, 0, 1));
              }}
              onPointerLeave={() => setHoverX(null)}
              onPointerDown={(e) => {
                if (locked) return;
                const el = e.currentTarget;
                el.setPointerCapture(e.pointerId);
                const move = (ev: PointerEvent) => {
                  const r = el.getBoundingClientRect();
                  seekTo(clamp((ev.clientX - r.left) / r.width, 0, 1) * duration);
                };
                move(e.nativeEvent);
                el.addEventListener("pointermove", move);
                el.addEventListener("pointerup", () => el.removeEventListener("pointermove", move), { once: true });
              }}
            >
              <div
                role="slider"
                tabIndex={locked ? -1 : 0}
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(time)}
                aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
                aria-disabled={locked}
                className="relative h-1 w-full rounded-full bg-white/20 transition-[height] group-hover/seek:h-1.5"
              >
                {buffered.map(([a, b], i) => (
                  <div key={i} className="absolute inset-y-0 rounded-full bg-white/30" style={{ left: `${(a / duration) * 100}%`, width: `${((b - a) / duration) * 100}%` }} />
                ))}
                {asset.markers.map((m) => (
                  <div key={`${m.kind}${m.start}`} className="absolute inset-y-0 bg-accent/50" style={{ left: `${(m.start / duration) * 100}%`, width: `${((m.end - m.start) / duration) * 100}%` }} title={m.kind} />
                ))}
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
                <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow transition-transform group-hover/seek:scale-100" style={{ left: `${pct}%` }} />
              </div>
              {hoverX != null && (
                <div className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-black/85 px-2 py-0.5 font-mono text-xs text-white" style={{ left: `${hoverX * 100}%` }}>
                  {formatDuration(hoverX * duration)}
                </div>
              )}
            </div>

            <div className="mt-1 flex items-center gap-1 text-white sm:gap-2">
              <CtrlButton label={playing ? "Pause (K)" : "Play (K)"} onClick={togglePlay} disabled={locked}>
                {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
              </CtrlButton>
              {grant.prev && onNavigateEpisode && !locked && (
                <CtrlButton label="Previous episode (Shift+P)" onClick={() => onNavigateEpisode(grant.prev!.id)} className="@max-2xl:hidden">
                  <SkipBack className="size-5" />
                </CtrlButton>
              )}
              {grant.next && onNavigateEpisode && !locked && (
                <CtrlButton label="Next episode (Shift+N)" onClick={() => onNavigateEpisode(grant.next!.id)}>
                  <SkipForward className="size-5" />
                </CtrlButton>
              )}
              <div className="group/vol flex items-center">
                <CtrlButton label={prefs.muted ? "Unmute (M)" : "Mute (M)"} onClick={() => video && (video.muted = !video.muted)}>
                  <VolumeIcon className="size-5" />
                </CtrlButton>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={prefs.muted ? 0 : prefs.volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  aria-label="Volume"
                  className="w-0 accent-white opacity-0 transition-all duration-200 focus:w-20 focus:opacity-100 group-hover/vol:w-20 group-hover/vol:opacity-100 @max-md:hidden"
                />
              </div>
              <span className="ml-1 whitespace-nowrap font-mono text-xs tabular-nums text-white/85">
                {formatDuration(time)} <span className="text-white/45">/ {formatDuration(duration)}</span>
              </span>
              <span className="flex-1" />
              {onNavigateEpisode && (
                <CtrlButton label="Episodes" onClick={() => setShowEpisodes((s) => !s)} pressed={showEpisodes} className="@max-sm:hidden">
                  <ListVideo className="size-5" />
                </CtrlButton>
              )}
              <CtrlButton label={selectedSub ? "Subtitles on (C)" : "Subtitles off (C)"} onClick={() => setMenu(menu === "subs" ? null : "subs")} pressed={Boolean(selectedSub)}>
                <Captions className="size-5" />
              </CtrlButton>
              <CtrlButton label="Settings" onClick={() => setMenu(menu ? null : "root")} pressed={Boolean(menu && menu !== "subs")}>
                <Settings2 className={cn("size-5 transition-transform", menu && menu !== "subs" && "rotate-45")} />
              </CtrlButton>
              <CtrlButton label="Picture-in-picture (I)" onClick={togglePip} pressed={pip} className="@max-xl:hidden">
                <PictureInPicture2 className="size-5" />
              </CtrlButton>
              <CtrlButton label={prefs.theater ? "Exit theater mode (T)" : "Theater mode (T)"} onClick={() => setPrefs({ theater: !prefs.theater })} pressed={prefs.theater} className="max-lg:hidden @max-lg:hidden">
                <RectangleHorizontal className="size-5" />
              </CtrlButton>
              <CtrlButton label={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
              </CtrlButton>
            </div>
          </div>
        </div>

        {/* Settings menus */}
        <AnimatePresence>
          {menu && (
            <motion.div
              role="menu"
              aria-label="Player settings"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: reduced ? 0 : 0.16 }}
              className="absolute bottom-16 right-3 z-[30] max-h-[70%] w-64 overflow-y-auto rounded-[min(var(--k-radius-panel),16px)] bg-black/90 p-1.5 text-sm text-white shadow-2xl backdrop-blur sm:right-5"
              onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setMenu(null))}
            >
              {menu === "root" && (
                <>
                  <MenuRow icon={<Gauge className="size-4" />} label="Speed" value={`${prefs.rate}×`} onClick={() => setMenu("speed")} />
                  <MenuRow icon={<Settings2 className="size-4" />} label="Quality" value={hs.autoLevel ? `Auto${hs.levels.find((l) => l.index === hs.currentLevel) ? ` (${hs.levels.find((l) => l.index === hs.currentLevel)!.label})` : ""}` : (hs.levels.find((l) => l.index === hs.currentLevel)?.label ?? "—")} onClick={() => setMenu("quality")} disabled={hs.levels.length < 2} />
                  <MenuRow icon={<Volume2 className="size-4" />} label="Audio" value={hs.audioTracks.find((a) => a.index === hs.audioTrack)?.label ?? "Default"} onClick={() => setMenu("audio")} disabled={hs.audioTracks.length < 2} />
                  <MenuRow icon={<Captions className="size-4" />} label="Caption style" value="" onClick={() => setMenu("caption-style")} />
                  <ToggleRow label="Autoplay next episode" on={prefs.autoNext} onChange={(v) => setPrefs({ autoNext: v })} />
                  <ToggleRow label="Auto-skip intros" on={prefs.autoSkipIntro} onChange={(v) => setPrefs({ autoSkipIntro: v })} />
                  <ToggleRow label="Auto-skip credits" on={prefs.autoSkipOutro} onChange={(v) => setPrefs({ autoSkipOutro: v })} />
                  <ToggleRow label="Ambient mode" icon={<Sparkles className="size-4" />} on={prefs.ambient} onChange={(v) => setPrefs({ ambient: v })} />
                  <ToggleRow label="Stats for nerds" icon={<Activity className="size-4" />} on={prefs.showStats} onChange={(v) => setPrefs({ showStats: v })} />
                </>
              )}
              {menu === "speed" && (
                <SubMenu title="Playback speed" back={() => setMenu("root")}>
                  {SPEEDS.map((s) => (
                    <Choice key={s} label={s === 1 ? "Normal" : `${s}×`} on={prefs.rate === s} onClick={() => video && (video.playbackRate = s)} />
                  ))}
                </SubMenu>
              )}
              {menu === "quality" && (
                <SubMenu title="Quality" back={() => setMenu("root")}>
                  <Choice label="Auto" on={hs.autoLevel} onClick={() => setLevel(-1)} />
                  {[...hs.levels].sort((a, b) => b.height - a.height).map((l) => (
                    <Choice key={l.index} label={`${l.label}`} hint={`${Math.round(l.bitrate / 1000)} kbps`} on={!hs.autoLevel && hs.currentLevel === l.index} onClick={() => setLevel(l.index)} />
                  ))}
                </SubMenu>
              )}
              {menu === "audio" && (
                <SubMenu title="Audio track" back={() => setMenu("root")}>
                  {hs.audioTracks.map((a) => (
                    <Choice key={a.index} label={a.label} hint={a.lang} on={hs.audioTrack === a.index} onClick={() => setAudio(a.index)} />
                  ))}
                </SubMenu>
              )}
              {menu === "subs" && (
                <SubMenu title="Subtitles">
                  <Choice label="Off" on={!subId} onClick={() => (setSubId(null), setPrefs({ subtitleLang: null }))} />
                  {hs.subtitleTracks.map((t) => (
                    <Choice key={t.id} label={t.label} hint={t.lang} on={subId === t.id} onClick={() => (setSubId(t.id), setPrefs({ subtitleLang: t.lang || null }))} />
                  ))}
                  {!hs.subtitleTracks.length && <p className="px-3 py-2 text-xs text-white/60">This stream has no subtitle tracks.</p>}
                  {subId && (
                    <div className="mt-1 border-t border-white/10 px-3 py-2">
                      <p className="text-xs text-white/60">Subtitle timing</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <button className="k-btn k-btn-sm bg-white/10 text-white" onClick={() => setSubDelay((d) => Math.round((d - 0.25) * 100) / 100)} aria-label="Show subtitles earlier">
                          −0.25s
                        </button>
                        <span className="flex-1 text-center font-mono text-xs tabular-nums">{subDelay > 0 ? "+" : ""}{subDelay.toFixed(2)}s</span>
                        <button className="k-btn k-btn-sm bg-white/10 text-white" onClick={() => setSubDelay((d) => Math.round((d + 0.25) * 100) / 100)} aria-label="Show subtitles later">
                          +0.25s
                        </button>
                      </div>
                    </div>
                  )}
                </SubMenu>
              )}
              {menu === "caption-style" && (
                <SubMenu title="Caption style" back={() => setMenu("root")}>
                  <p className="px-3 pt-1 text-xs text-white/60">Size</p>
                  <div className="flex gap-1 px-2 py-1.5">
                    {(["s", "m", "l", "xl"] as const).map((s) => (
                      <button key={s} className={cn("flex-1 rounded py-1.5 text-xs uppercase", prefs.subtitleStyle.size === s ? "bg-white text-black" : "bg-white/10")} onClick={() => setPrefs({ subtitleStyle: { ...prefs.subtitleStyle, size: s } })} aria-pressed={prefs.subtitleStyle.size === s}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="px-3 pt-1 text-xs text-white/60">Colour</p>
                  <div className="flex gap-1 px-2 py-1.5">
                    {(["white", "yellow", "cyan"] as const).map((c) => (
                      <button key={c} className={cn("flex-1 rounded py-1.5 text-xs capitalize", prefs.subtitleStyle.color === c ? "ring-2 ring-white" : "")} style={{ color: CAPTION_COLORS[c], background: "rgb(255 255 255 / 0.1)" }} onClick={() => setPrefs({ subtitleStyle: { ...prefs.subtitleStyle, color: c } })} aria-pressed={prefs.subtitleStyle.color === c}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="px-3 pt-1 text-xs text-white/60">Background</p>
                  <div className="flex gap-1 px-2 py-1.5">
                    {(["none", "shadow", "box"] as const).map((b) => (
                      <button key={b} className={cn("flex-1 rounded py-1.5 text-xs capitalize", prefs.subtitleStyle.background === b ? "bg-white text-black" : "bg-white/10")} onClick={() => setPrefs({ subtitleStyle: { ...prefs.subtitleStyle, background: b } })} aria-pressed={prefs.subtitleStyle.background === b}>
                        {b}
                      </button>
                    ))}
                  </div>
                </SubMenu>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Episode selector */}
        <AnimatePresence>
          {showEpisodes && onNavigateEpisode && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 38 }}
              className="absolute inset-y-0 right-0 z-[25] w-[min(85%,320px)] overflow-y-auto bg-black/90 p-3 text-white backdrop-blur"
              role="dialog"
              aria-label="Episodes"
            >
              <p className="px-2 pb-2 text-xs uppercase tracking-wider text-white/60">{grant.series.title}</p>
              <ul className="space-y-1">
                {grant.episodes.map((ep) => {
                  const p = useProgress.getState().get(grant.series.id, ep.id);
                  return (
                    <li key={ep.id}>
                      <button
                        disabled={locked}
                        className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-50", ep.id === grant.episode.id && "bg-white/15")}
                        onClick={() => (setShowEpisodes(false), onNavigateEpisode(ep.id))}
                        aria-current={ep.id === grant.episode.id ? "true" : undefined}
                      >
                        <span className="w-6 text-center font-mono text-white/60">{ep.number}</span>
                        <span className="flex-1">
                          <span className="block truncate">{ep.title}</span>
                          <span className="block h-0.5 w-full overflow-hidden rounded bg-white/15">
                            <span className="block h-full bg-primary" style={{ width: `${p ? (p.completed ? 100 : (p.position / p.duration) * 100) : 0}%` }} />
                          </span>
                        </span>
                        <span className="text-xs text-white/50">{formatDuration(ep.duration)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CtrlButton({ label, onClick, children, pressed, disabled, className }: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      className={cn("grid size-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:bg-white/20 disabled:opacity-40", pressed && "text-[var(--k-accent)]", className)}
    >
      {children}
    </button>
  );
}

function MenuRow({ icon, label, value, onClick, disabled }: { icon: ReactNode; label: string; value: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button role="menuitem" disabled={disabled} onClick={onClick} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left hover:bg-white/10 disabled:opacity-40">
      {icon}
      <span className="flex-1">{label}</span>
      <span className="text-xs text-white/60">{value}</span>
      <ChevronRight className="size-4 text-white/50" aria-hidden />
    </button>
  );
}

function ToggleRow({ label, on, onChange, icon }: { label: string; on: boolean; onChange: (v: boolean) => void; icon?: ReactNode }) {
  return (
    <button role="menuitemcheckbox" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left hover:bg-white/10">
      {icon ?? <span className="size-4" />}
      <span className="flex-1">{label}</span>
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-[var(--k-primary)]" : "bg-white/25")} aria-hidden>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-[left]", on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function SubMenu({ title, back, children }: { title: string; back?: () => void; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-white/10 px-2 pb-1.5 pt-1">
        {back && (
          <button onClick={back} className="rounded px-1.5 py-1 text-white/70 hover:bg-white/10" aria-label="Back">
            ‹
          </button>
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">{title}</span>
      </div>
      <div className="pt-1">{children}</div>
    </div>
  );
}

function Choice({ label, hint, on, onClick }: { label: string; hint?: string; on: boolean; onClick: () => void }) {
  return (
    <button role="menuitemradio" aria-checked={on} onClick={onClick} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left hover:bg-white/10">
      <span className="grid size-4 place-items-center">{on && <Check className="size-4" />}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-white/50">{hint}</span>}
    </button>
  );
}
