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

export type AchievementExtras = {
  reviews?: number;
  hostedParties?: number;
  seasonGoalMet?: boolean;
  /** Episodios vistos entre las 00:00 y las 05:59 (del progreso de reproducción). */
  nightEpisodes?: number;
  /** Máximo de episodios vistos en un mismo día. */
  bestDayEpisodes?: number;
};

/**
 * Logros calculados con datos reales. Los ids coinciden con la tabla public.achievements
 * (supabase/seed.sql y la migración 20261122000000_more_achievements.sql).
 */
export function computeAchievements(entries: LibraryEntry[], extra: AchievementExtras = {}): Achievement[] {
  const completed = entries.filter((e) => e.status === "COMPLETED");
  const genres = new Set(completed.flatMap((e) => e.media.genres));
  const decades = new Set(completed.filter((e) => e.media.year).map((e) => Math.floor(e.media.year! / 10)));
  const episodes = entries.reduce((s, e) => s + e.progress, 0);
  const favorites = entries.filter((e) => e.favorite).length;
  const rated = entries.filter((e) => e.score != null).length;
  const classics = completed.filter((e) => e.media.year != null && e.media.year < 1990).length;
  const movies = completed.filter((e) => e.media.format === "MOVIE").length;
  const def = (id: string, name: string, description: string, icon: string, category: string, progress: number, target: number): Achievement => ({ id, name, description, icon, category, progress: Math.min(progress, target), target, earned: progress >= target });
  return [
    def("first-steps", "Primeros pasos", "Añade tu primer anime a la biblioteca.", "footprints", "milestone", entries.length, 1),
    def("first-finish", "Créditos finales", "Completa tu primer anime.", "flag", "milestone", completed.length, 1),
    def("ten-complete", "Maratonista", "Completa 10 animes.", "medal", "milestone", completed.length, 10),
    def("fifty-complete", "Veterano", "Completa 50 animes.", "crown", "milestone", completed.length, 50),
    def("hundred-complete", "Sensei del anime", "Completa 100 animes.", "scroll", "milestone", completed.length, 100),
    def("hundred-episodes", "Centenario", "Registra 100 episodios vistos.", "gauge", "milestone", episodes, 100),
    def("five-hundred-episodes", "Leyenda", "Registra 500 episodios vistos.", "flame", "milestone", episodes, 500),
    def("favorites-ten", "Corazón otaku", "Marca 10 animes como favoritos.", "heart", "milestone", favorites, 10),
    def("rated-twenty", "Ojo crítico", "Puntúa 20 animes de tu biblioteca.", "star", "social", rated, 20),
    def("genre-five", "Explorador de géneros", "Completa animes de 5 géneros distintos.", "compass", "genre", genres.size, 5),
    def("genre-ten", "Cartógrafo de géneros", "Completa animes de 10 géneros distintos.", "map", "genre", genres.size, 10),
    def("decades-three", "Viajero del tiempo", "Completa animes de 3 décadas distintas.", "hourglass", "discovery", decades.size, 3),
    def("classic-fan", "Amante de los clásicos", "Completa un anime anterior a 1990.", "gem", "discovery", classics, 1),
    def("movie-buff", "Cinéfilo", "Completa 10 películas de anime.", "film", "discovery", movies, 10),
    def("night-owl", "Noctámbulo", "Mira 10 episodios entre la medianoche y las 6 de la mañana.", "moon", "milestone", extra.nightEpisodes ?? 0, 10),
    def("binge-day", "Maratón de un día", "Mira 12 episodios en un mismo día.", "zap", "milestone", extra.bestDayEpisodes ?? 0, 12),
    def("critic", "Crítico", "Publica tu primera reseña.", "pen", "social", extra.reviews ?? 0, 1),
    def("party-host", "Anfitrión", "Organiza una sala de cine.", "popcorn", "social", extra.hostedParties ?? 0, 1),
    def("season-goal", "Al día", "Cumple tu meta de la temporada.", "calendar", "seasonal", extra.seasonGoalMet ? 1 : 0, 1),
  ];
}

/** Estadísticas de reproducción para los logros de hábitos (hora local de quien mira). */
export function progressHabits(progress: { position: number; completed: boolean; updatedAt: number }[]) {
  const perDay = new Map<string, number>();
  let night = 0;
  for (const p of progress) {
    if (!p.completed && p.position < 60) continue;
    const d = new Date(p.updatedAt);
    if (d.getHours() < 6) night++;
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  return { nightEpisodes: night, bestDayEpisodes: Math.max(0, ...perDay.values()) };
}
