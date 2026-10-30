import type { LibraryEntry } from "@/lib/library/types";

/** "Anime DNA": descriptive statistics computed only from real library data. */
export type Dna = {
  total: number;
  completed: number;
  episodes: number;
  hours: number;
  meanScore: number | null;
  scored: number;
  genres: { name: string; count: number; share: number; meanScore: number | null }[];
  studios: { name: string; count: number }[];
  eras: { decade: string; count: number }[];
  formats: { name: string; count: number }[];
  statuses: { status: LibraryEntry["status"]; count: number }[];
  scoreBuckets: { bucket: string; count: number }[];
  weekdays: { day: string; count: number }[];
  completionRate: number | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeDna(entries: LibraryEntry[]): Dna {
  const tally = <K extends string>(keys: K[]) => {
    const m = new Map<K, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const watched = entries.filter((e) => e.status !== "PLANNING");
  const scored = entries.filter((e) => e.score != null);

  const genreScores = new Map<string, number[]>();
  for (const e of watched) for (const g of e.media.genres) {
    if (!genreScores.has(g)) genreScores.set(g, []);
    if (e.score != null) genreScores.get(g)!.push(e.score);
  }
  const genreCount = tally(watched.flatMap((e) => e.media.genres));
  const genres = [...genreCount.entries()]
    .map(([name, count]) => {
      const s = genreScores.get(name) ?? [];
      return { name, count, share: watched.length ? count / watched.length : 0, meanScore: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null };
    })
    .sort((a, b) => b.count - a.count);

  const studios = [...tally(watched.map((e) => e.media.studio).filter(Boolean) as string[]).entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  const eras = [...tally(watched.filter((e) => e.media.year).map((e) => `${Math.floor(e.media.year! / 10) * 10}s`)).entries()].map(([decade, count]) => ({ decade, count })).sort((a, b) => a.decade.localeCompare(b.decade));
  const formats = [...tally(entries.map((e) => e.media.format ?? "Unknown")).entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const statuses = [...tally(entries.map((e) => e.status)).entries()].map(([status, count]) => ({ status, count }));
  const buckets = ["1–49", "50–59", "60–69", "70–79", "80–89", "90–100"];
  const scoreBuckets = buckets.map((bucket) => ({
    bucket,
    count: scored.filter((e) => {
      const s = e.score!;
      return bucket === "1–49" ? s < 50 : bucket === "90–100" ? s >= 90 : s >= Number(bucket.slice(0, 2)) && s < Number(bucket.slice(0, 2)) + 10;
    }).length,
  }));
  // Watching pattern: on which weekdays you update your library (local time).
  const wd = new Array(7).fill(0);
  for (const e of entries) wd[new Date(e.updatedAt).getDay()]++;
  const completed = entries.filter((e) => e.status === "COMPLETED").length;
  const dropped = entries.filter((e) => e.status === "DROPPED").length;
  const episodes = entries.reduce((s, e) => s + e.progress, 0);
  return {
    total: entries.length,
    completed,
    episodes,
    hours: entries.reduce((s, e) => s + e.progress * (e.media.duration ?? 24), 0) / 60,
    meanScore: scored.length ? Math.round(scored.reduce((s, e) => s + e.score!, 0) / scored.length) : null,
    scored: scored.length,
    genres,
    studios,
    eras,
    formats,
    statuses,
    scoreBuckets,
    weekdays: DAYS.map((day, i) => ({ day, count: wd[i] })),
    completionRate: completed + dropped ? completed / (completed + dropped) : null,
  };
}

export type Achievement = { id: string; name: string; description: string; icon: string; category: string; progress: number; target: number; earned: boolean };

/** Mirrors supabase/seed.sql. Earned purely from library data — no streaks, no pressure. */
export function computeAchievements(entries: LibraryEntry[], extra: { reviews?: number; hostedParties?: number; seasonGoalMet?: boolean } = {}): Achievement[] {
  const completed = entries.filter((e) => e.status === "COMPLETED");
  const genres = new Set(completed.flatMap((e) => e.media.genres));
  const decades = new Set(completed.filter((e) => e.media.year).map((e) => Math.floor(e.media.year! / 10)));
  const episodes = entries.reduce((s, e) => s + e.progress, 0);
  const def = (id: string, name: string, description: string, icon: string, category: string, progress: number, target: number): Achievement => ({ id, name, description, icon, category, progress: Math.min(progress, target), target, earned: progress >= target });
  return [
    def("first-steps", "First Steps", "Add your first title to the library.", "footprints", "milestone", entries.length, 1),
    def("first-finish", "Credits Roll", "Complete your first anime.", "flag", "milestone", completed.length, 1),
    def("ten-complete", "Marathoner", "Complete 10 anime.", "medal", "milestone", completed.length, 10),
    def("fifty-complete", "Veteran Viewer", "Complete 50 anime.", "crown", "milestone", completed.length, 50),
    def("hundred-episodes", "Century", "Log 100 episodes of progress.", "gauge", "milestone", episodes, 100),
    def("genre-five", "Genre Explorer", "Complete anime across 5 genres.", "compass", "genre", genres.size, 5),
    def("genre-ten", "Genre Cartographer", "Complete anime across 10 genres.", "map", "genre", genres.size, 10),
    def("decades-three", "Time Traveller", "Complete anime from 3 decades.", "hourglass", "discovery", decades.size, 3),
    def("critic", "Critic", "Publish your first review.", "pen", "social", extra.reviews ?? 0, 1),
    def("party-host", "Party Host", "Host a watch party.", "popcorn", "social", extra.hostedParties ?? 0, 1),
    def("season-goal", "On Schedule", "Reach a seasonal watch goal.", "calendar", "seasonal", extra.seasonGoalMet ? 1 : 0, 1),
  ];
}
