import type { ChapterProgress, MangaLibraryEntry, ReadingSession } from "./types";

/**
 * Reading statistics from the user's own data. Two kinds of numbers, never mixed:
 *  - "measured": recorded by the KAZE reader (sessions with active time, pages seen),
 *  - "list": what the user logged in their list (chapters/volumes progress, statuses).
 * Reading time is only ever reported from measured sessions — it is never estimated from chapter counts.
 */

export type MangaStats = {
  totals: { titles: number; completed: number; reading: number; planning: number; chaptersLogged: number; volumesLogged: number; favorites: number };
  measured: { sessions: number; activeMinutes: number; pagesRead: number; chaptersFinishedInReader: number; daysActive: number; currentStreak: number; longestStreak: number };
  genres: { genre: string; count: number }[];
  authors: { author: string; count: number }[];
  statuses: { status: string; count: number }[];
  completionsByMonth: { month: string; count: number }[];
  scoreDistribution: { bucket: number; count: number }[];
  meanScore: number | null;
  /** Titles started from the "Continue the story" flow. */
  continuedFromAnime: number;
};

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function streaks(days: string[], today: string = dayKey(Date.now())): { current: number; longest: number } {
  const set = new Set(days);
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev && Date.parse(d) - Date.parse(prev) === 86_400_000) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  let current = 0;
  let cursor = Date.parse(today);
  // A streak survives until the end of "today": count back from today, or from yesterday if nothing yet today.
  if (!set.has(dayKey(cursor))) cursor -= 86_400_000;
  while (set.has(dayKey(cursor))) {
    current += 1;
    cursor -= 86_400_000;
  }
  return { current, longest };
}

export function computeMangaStats(entries: MangaLibraryEntry[], sessions: ReadingSession[], progress: ChapterProgress[], continuedIds: number[] = [], now = Date.now()): MangaStats {
  const count = <K extends string>(list: K[]) => {
    const m = new Map<K, number>();
    for (const k of list) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const scored = entries.filter((e) => e.score != null);
  const genres = count(entries.flatMap((e) => e.media.genres));
  const authors = count(entries.map((e) => e.media.author).filter((a): a is string => Boolean(a)));
  const statuses = count(entries.map((e) => e.status));
  const completions = count(entries.filter((e) => e.completedAt).map((e) => e.completedAt!.slice(0, 7)));
  const buckets = count(scored.map((e) => String(Math.min(10, Math.max(1, Math.round((e.score ?? 0) / 10))))));
  const days = sessions.filter((s) => s.activeSeconds >= 30).map((s) => dayKey(s.startedAt));
  const st = streaks(days, dayKey(now));
  return {
    totals: {
      titles: entries.length,
      completed: entries.filter((e) => e.status === "COMPLETED").length,
      reading: entries.filter((e) => e.status === "CURRENT" || e.status === "REPEATING").length,
      planning: entries.filter((e) => e.status === "PLANNING").length,
      chaptersLogged: entries.reduce((a, e) => a + e.progress, 0),
      volumesLogged: entries.reduce((a, e) => a + e.progressVolumes, 0),
      favorites: entries.filter((e) => e.favorite).length,
    },
    measured: {
      sessions: sessions.length,
      activeMinutes: Math.round(sessions.reduce((a, s) => a + s.activeSeconds, 0) / 60),
      pagesRead: sessions.reduce((a, s) => a + s.pagesViewed, 0),
      chaptersFinishedInReader: progress.filter((p) => p.completed).length,
      daysActive: new Set(days).size,
      currentStreak: st.current,
      longestStreak: st.longest,
    },
    genres: [...genres.entries()].map(([genre, c]) => ({ genre, count: c })).sort((a, b) => b.count - a.count).slice(0, 10),
    authors: [...authors.entries()].map(([author, c]) => ({ author, count: c })).sort((a, b) => b.count - a.count).slice(0, 8),
    statuses: [...statuses.entries()].map(([status, c]) => ({ status, count: c })),
    completionsByMonth: lastMonths(now, 12).map((month) => ({ month, count: completions.get(month) ?? 0 })),
    scoreDistribution: Array.from({ length: 10 }, (_, i) => ({ bucket: i + 1, count: buckets.get(String(i + 1)) ?? 0 })),
    meanScore: scored.length ? Math.round(scored.reduce((a, e) => a + (e.score ?? 0), 0) / scored.length) : null,
    continuedFromAnime: new Set(continuedIds).size,
  };
}

function lastMonths(now: number, n: number) {
  const out: string[] = [];
  const d = new Date(now);
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(x.toISOString().slice(0, 7));
  }
  return out;
}
