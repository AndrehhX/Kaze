"use client";

/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect -- the player drives imperative browser media APIs (HTMLVideoElement, hls.js, TextTrack) from effects and handlers by design. */

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import type { MediaAsset } from "@/lib/media/types";

export type QualityLevel = { index: number; height: number; bitrate: number; label: string };
export type AudioTrack = { index: number; label: string; lang: string };
export type SubTrack = { id: string; label: string; lang: string; source: "sidecar" | "hls"; hlsIndex?: number };

export type HlsState = {
  levels: QualityLevel[];
  currentLevel: number;
  autoLevel: boolean;
  audioTracks: AudioTrack[];
  audioTrack: number;
  subtitleTracks: SubTrack[];
  fatal: string | null;
  engine: "hls.js" | "native" | "progressive" | null;
};

/**
 * Attaches an authorized HLS/MP4 asset to a <video>. Uses hls.js where MSE is
 * available, native HLS on Safari/iOS, and plain src for progressive files.
 */
export function useHls(video: HTMLVideoElement | null, asset: MediaAsset, retryKey: number) {
  const hlsRef = useRef<Hls | null>(null);
  const [state, setState] = useState<HlsState>({ levels: [], currentLevel: -1, autoLevel: true, audioTracks: [], audioTrack: 0, subtitleTracks: [], fatal: null, engine: null });

  useEffect(() => {
    if (!video) return;
    let destroyed = false;
    const sidecar: SubTrack[] = asset.subtitles.map((s, i) => ({ id: `side-${i}`, label: s.label, lang: s.lang, source: "sidecar" }));
    setState((s) => ({ ...s, fatal: null, levels: [], audioTracks: [], subtitleTracks: sidecar }));

    if (asset.kind === "mp4") {
      video.src = asset.src;
      setState((s) => ({ ...s, engine: "progressive" }));
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    (async () => {
      const { default: HlsCtor } = await import("hls.js");
      if (destroyed) return;
      if (!HlsCtor.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = asset.src;
          setState((s) => ({ ...s, engine: "native" }));
        } else {
          setState((s) => ({ ...s, fatal: "This browser can't play HLS streams." }));
        }
        return;
      }
      const hls = new HlsCtor({
        enableWorker: true,
        capLevelToPlayerSize: true,
        startLevel: -1,
        backBufferLength: 60,
        // Text tracks are rendered by our own caption layer (styling + delay).
        renderTextTracksNatively: true,
      });
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.on(HlsCtor.Events.MEDIA_ATTACHED, () => hls.loadSource(asset.src));
      hls.on(HlsCtor.Events.MANIFEST_PARSED, (_e, data) => {
        const levels = data.levels
          .map((l, index) => ({ index, height: l.height, bitrate: l.bitrate, label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps` }))
          .filter((l) => l.height > 0 || data.levels.length === 1);
        setState((s) => ({ ...s, levels, engine: "hls.js" }));
      });
      hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_e, d) => setState((s) => ({ ...s, currentLevel: d.level, autoLevel: hls.autoLevelEnabled })));
      hls.on(HlsCtor.Events.AUDIO_TRACKS_UPDATED, (_e, d) =>
        setState((s) => ({ ...s, audioTracks: d.audioTracks.map((t, index) => ({ index, label: t.name || t.lang || `Track ${index + 1}`, lang: t.lang ?? "" })), audioTrack: hls.audioTrack })),
      );
      hls.on(HlsCtor.Events.AUDIO_TRACK_SWITCHED, (_e, d) => setState((s) => ({ ...s, audioTrack: d.id })));
      hls.on(HlsCtor.Events.SUBTITLE_TRACKS_UPDATED, (_e, d) =>
        setState((s) => ({
          ...s,
          subtitleTracks: [...sidecar, ...d.subtitleTracks.map((t, i) => ({ id: `hls-${i}`, label: t.name || t.lang || `Subtitles ${i + 1}`, lang: t.lang ?? "", source: "hls" as const, hlsIndex: i }))],
        })),
      );
      let mediaRecoveries = 0;
      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries++;
          hls.recoverMediaError();
          return;
        }
        if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
          setState((s) => ({ ...s, fatal: navigator.onLine ? "The stream couldn't be reached. The demo host may be down." : "You're offline. Reconnect to keep watching." }));
        } else {
          setState((s) => ({ ...s, fatal: "Playback failed to decode this stream." }));
        }
        hls.destroy();
        hlsRef.current = null;
      });
    })().catch(() => setState((s) => ({ ...s, fatal: "The player failed to load." })));

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [video, asset.src, asset.kind, asset.subtitles, retryKey]);

  const setLevel = (index: number) => {
    const h = hlsRef.current;
    if (!h) return;
    h.currentLevel = index; // -1 → auto
    setState((s) => ({ ...s, autoLevel: index === -1, currentLevel: index === -1 ? s.currentLevel : index }));
  };
  const setAudio = (index: number) => {
    if (hlsRef.current) hlsRef.current.audioTrack = index;
  };
  const setHlsSubtitle = (index: number) => {
    const h = hlsRef.current;
    if (!h) return;
    h.subtitleTrack = index;
    h.subtitleDisplay = index >= 0;
  };
  return { state, hls: hlsRef, setLevel, setAudio, setHlsSubtitle };
}
