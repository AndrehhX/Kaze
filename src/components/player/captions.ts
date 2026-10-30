/** Pure helpers for the custom caption renderer (testable without a DOM). */

export type Cue = { start: number; end: number; text: string };

/** Cues visible at `time` when captions are delayed by `delay` seconds (positive = later). */
export function activeCues(cues: Cue[], time: number, delay: number): Cue[] {
  const t = time - delay;
  return cues.filter((c) => c.start <= t && t < c.end);
}

export function cueText(raw: string): string {
  // Strip WebVTT voice/class tags (<v Name>, <c.yellow>, <i>) — rendered as plain text.
  return raw.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}

export const CAPTION_SIZES = { s: "clamp(0.85rem, 1.6vw, 1.1rem)", m: "clamp(1rem, 2.1vw, 1.5rem)", l: "clamp(1.2rem, 2.8vw, 2rem)", xl: "clamp(1.5rem, 3.6vw, 2.6rem)" } as const;
export const CAPTION_COLORS = { white: "#ffffff", yellow: "#ffe45c", cyan: "#7ff6ff" } as const;
