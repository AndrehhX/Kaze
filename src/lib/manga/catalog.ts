/**
 * Manga catalog model. Keeps series, editions, volumes, chapters, releases, page assets and availability apart,
 * because one work can have many editions/languages and chapter numbering is not a simple integer sequence.
 */

export type ChapterKind = "regular" | "special" | "bonus" | "extra" | "oneshot" | "prologue";

export type MangaEdition = {
  id: string;
  seriesKey: string;
  language: string; // BCP-47, e.g. "es", "en", "ja"
  label: string;
  publisher: string | null;
  region: string | null;
  readingDirection: "rtl" | "ltr" | "vertical";
};

export type MangaVolume = {
  id: string;
  editionId: string;
  /** Display number ("1", "0", "Especial"). */
  number: string;
  title: string | null;
  cover: string | null;
  chapterIds: string[];
};

export type MangaChapter = {
  /** Stable id, never derived from position. */
  id: string;
  seriesKey: string;
  editionId: string;
  /** As printed: "1", "10.5", "Extra", or null for unnumbered chapters. */
  number: string | null;
  /** Explicit ordering key so specials can sit between regular chapters. */
  sortKey: number;
  kind: ChapterKind;
  title: string | null;
  volumeId: string | null;
  language: string;
  pageCount: number;
  releasedAt: string | null;
};

export type ChapterRelease = {
  chapterId: string;
  provider: string;
  language: string;
  url: string | null;
  availableFrom: string | null;
};

export type ReadingAsset = {
  index: number;
  src: string;
  /** Lower-bandwidth variant for data-saving mode, when the provider has one. */
  srcLow: string | null;
  width: number;
  height: number;
  alt: string;
  /** A single image that spans two printed pages. */
  spread: boolean;
};

export type ReadingAvailability = {
  kind: "embedded" | "external";
  provider: string;
  label: string;
  url: string | null;
  language: string | null;
  official: boolean;
  /** Explains rights/limitations to the reader in plain language. */
  note: string;
};

/** Parses printed numbers ("12", "12.5", "Cap. 7") to a number usable as a sort hint. Returns null if unnumbered. */
export function parseChapterNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return m ? Number.parseFloat(m[0]) : null;
}

export function chapterLabel(c: Pick<MangaChapter, "number" | "kind" | "title">): string {
  const kindLabel: Record<ChapterKind, string> = { regular: "Capítulo", special: "Especial", bonus: "Extra", extra: "Extra", oneshot: "One-shot", prologue: "Prólogo" };
  if (c.number == null) return c.title ? `${kindLabel[c.kind]}: ${c.title}` : kindLabel[c.kind];
  return `${c.kind === "regular" ? "Cap." : kindLabel[c.kind]} ${c.number}`;
}

/** Stable ordering by explicit sortKey, then printed number, then id. */
export function compareChapters(a: MangaChapter, b: MangaChapter): number {
  if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
  const na = parseChapterNumber(a.number);
  const nb = parseChapterNumber(b.number);
  if (na != null && nb != null && na !== nb) return na - nb;
  return a.id.localeCompare(b.id);
}

export function sortChapters(list: MangaChapter[]): MangaChapter[] {
  return [...list].sort(compareChapters);
}

export function adjacentChapters(list: MangaChapter[], chapterId: string): { prev: MangaChapter | null; next: MangaChapter | null } {
  const sorted = sortChapters(list);
  const i = sorted.findIndex((c) => c.id === chapterId);
  if (i < 0) return { prev: null, next: null };
  return { prev: sorted[i - 1] ?? null, next: sorted[i + 1] ?? null };
}
