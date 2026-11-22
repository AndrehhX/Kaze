import type { LibraryEntry } from "@/lib/library/types";

/** Un episodio visto (de la tabla watch_progress o del progreso local). */
export type WrappedProgress = {
  seriesId: string;
  episodeId: string;
  position: number; // segundos vistos
  duration: number; // segundos del episodio
  completed: boolean;
  updatedAt: number; // ms
  seriesTitle?: string | null;
  thumbnail?: string | null;
};

export type WrappedTop = { seriesId: string; title: string; cover: string | null; color: string | null; episodes: number; minutes: number };

export type Personality = { id: string; name: string; jp: string; description: string };

export type Wrapped = {
  year: number;
  minutes: number;
  episodes: number;
  series: number;
  completedTitles: number;
  top: WrappedTop[];
  topGenres: { name: string; count: number }[];
  months: number[]; // episodios por mes (0 = enero)
  busiestMonth: number | null;
  weekdays: number[]; // episodios por día (0 = domingo)
  favoriteWeekday: number | null;
  nightShare: number; // 0..1 de episodios entre las 00:00 y las 05:59
  bestDay: { date: string; episodes: number } | null;
  averageScore: number | null; // 0..100 de lo completado este año
  personality: Personality;
};

/** Un episodio cuenta si se vio al menos 1 minuto o se marcó como completado. */
const MIN_SECONDS = 60;

const GENRE_PERSONALITIES: Record<string, Personality> = {
  Action: { id: "shonen", name: "Corazón Shōnen", jp: "少年魂", description: "Peleas épicas, power-ups y gritos de ataque. Nunca te rindes." },
  Adventure: { id: "explorer", name: "Explorador de mundos", jp: "冒険者", description: "Cada serie es un viaje nuevo y siempre quieres ver qué hay más allá." },
  Comedy: { id: "comedy", name: "Alma de comedia", jp: "笑いの魂", description: "Si no te ríes en el primer episodio, no es para ti." },
  Drama: { id: "drama", name: "Coleccionista de lágrimas", jp: "涙の収集家", description: "Buscas historias que te rompan el corazón… y lo disfrutas." },
  Romance: { id: "romance", name: "Romántico empedernido", jp: "恋する心", description: "Confesiones bajo los cerezos y miradas que lo dicen todo." },
  Fantasy: { id: "fantasy", name: "Viajero de isekai", jp: "異世界人", description: "Magia, gremios y reencarnaciones: tu segundo hogar." },
  "Slice of Life": { id: "slice", name: "Vida tranquila", jp: "日常", description: "Lo cotidiano también es mágico. Té, calma y buenos personajes." },
  Mystery: { id: "detective", name: "Detective mental", jp: "名探偵", description: "Atas cabos antes que el protagonista. Nada se te escapa." },
  Psychological: { id: "mind", name: "Mente laberinto", jp: "心理戦", description: "Te encantan los juegos mentales y los giros que te dejan pensando." },
  Thriller: { id: "mind", name: "Mente laberinto", jp: "心理戦", description: "Te encantan los juegos mentales y los giros que te dejan pensando." },
  Sports: { id: "sports", name: "Espíritu deportivo", jp: "スポ根", description: "Entrenamiento, rivales y el partido final. Siempre al máximo." },
  "Sci-Fi": { id: "scifi", name: "Piloto del futuro", jp: "未来人", description: "Naves, mechas y futuros posibles. La ciencia ficción es lo tuyo." },
  Mecha: { id: "scifi", name: "Piloto del futuro", jp: "未来人", description: "Naves, mechas y futuros posibles. La ciencia ficción es lo tuyo." },
  Horror: { id: "horror", name: "Valiente del terror", jp: "恐怖の勇者", description: "Lo que a otros les quita el sueño, a ti te engancha." },
  Supernatural: { id: "spirit", name: "Cazador de espíritus", jp: "霊能者", description: "Yokais, maldiciones y poderes ocultos: tu terreno." },
  Music: { id: "idol", name: "Fan de escenario", jp: "アイドル", description: "Bandas, idols y openings en bucle." },
};

const DEFAULT_PERSONALITY: Personality = { id: "explorer", name: "Explorador de mundos", jp: "冒険者", description: "Pruebas un poco de todo y siempre encuentras algo nuevo." };
const NIGHT_OWL: Personality = { id: "night", name: "Noctámbulo", jp: "夜更かし", description: "Tus mejores maratones empiezan cuando todos duermen." };
const BINGER: Personality = { id: "binge", name: "Maratonista", jp: "一気見", description: "\"Un episodio más\" nunca fue solo uno. Temporadas en un día." };
const NEWCOMER: Personality = { id: "newcomer", name: "Recién llegado", jp: "新人", description: "Tu aventura en el anime acaba de empezar. ¡Lo mejor está por venir!" };

function localDay(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Resumen del año a partir de la biblioteca y del progreso de episodios.
 * Todo se calcula en la zona horaria local de quien lo ve.
 */
export function computeWrapped(year: number, entries: LibraryEntry[], progress: WrappedProgress[]): Wrapped {
  const inYear = (ms: number) => new Date(ms).getFullYear() === year;
  const watched = progress.filter((p) => inYear(p.updatedAt) && (p.completed || p.position >= MIN_SECONDS));
  const byMedia = new Map<number, LibraryEntry>(entries.map((e) => [e.mediaId, e]));

  let seconds = 0;
  const months = new Array<number>(12).fill(0);
  const weekdays = new Array<number>(7).fill(0);
  const perDay = new Map<string, number>();
  const perSeries = new Map<string, { episodes: number; seconds: number; title: string | null; cover: string | null }>();
  let night = 0;

  for (const p of watched) {
    const s = p.completed && p.duration > 0 ? p.duration : Math.min(p.position, p.duration || p.position);
    seconds += s;
    const d = new Date(p.updatedAt);
    months[d.getMonth()]++;
    weekdays[d.getDay()]++;
    if (d.getHours() < 6) night++;
    const day = localDay(p.updatedAt);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    const cur = perSeries.get(p.seriesId) ?? { episodes: 0, seconds: 0, title: p.seriesTitle ?? null, cover: p.thumbnail ?? null };
    cur.episodes++;
    cur.seconds += s;
    perSeries.set(p.seriesId, cur);
  }

  const top: WrappedTop[] = [...perSeries.entries()]
    .map(([seriesId, v]) => {
      const lib = byMedia.get(Number(seriesId));
      return {
        seriesId,
        title: lib?.media.title ?? v.title ?? `Anime ${seriesId}`,
        cover: lib?.media.cover ?? v.cover,
        color: lib?.media.color ?? null,
        episodes: v.episodes,
        minutes: Math.round(v.seconds / 60),
      };
    })
    .sort((a, b) => b.episodes - a.episodes || b.minutes - a.minutes)
    .slice(0, 5);

  // Géneros: ponderados por episodios vistos este año; si no hay progreso, por lo completado.
  const genreCount = new Map<string, number>();
  for (const [seriesId, v] of perSeries) {
    const lib = byMedia.get(Number(seriesId));
    for (const g of lib?.media.genres ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + v.episodes);
  }
  const completedThisYear = entries.filter((e) => e.status === "COMPLETED" && e.completedAt && new Date(e.completedAt).getFullYear() === year);
  if (genreCount.size === 0) for (const e of completedThisYear) for (const g of e.media.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
  const topGenres = [...genreCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  const maxIdx = (arr: number[]) => (arr.some((n) => n > 0) ? arr.indexOf(Math.max(...arr)) : null);
  const bestDayEntry = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const scores = completedThisYear.map((e) => e.score).filter((s): s is number => s != null);

  const episodes = watched.length;
  const nightShare = episodes ? night / episodes : 0;
  const bestDay = bestDayEntry ? { date: bestDayEntry[0], episodes: bestDayEntry[1] } : null;

  let personality: Personality;
  if (episodes < 5 && completedThisYear.length < 2) personality = NEWCOMER;
  else if (bestDay && bestDay.episodes >= 12) personality = BINGER;
  else if (episodes >= 20 && nightShare >= 0.4) personality = NIGHT_OWL;
  else personality = (topGenres[0] && GENRE_PERSONALITIES[topGenres[0].name]) || DEFAULT_PERSONALITY;

  return {
    year,
    minutes: Math.round(seconds / 60),
    episodes,
    series: perSeries.size,
    completedTitles: completedThisYear.length,
    top,
    topGenres,
    months,
    busiestMonth: maxIdx(months),
    weekdays,
    favoriteWeekday: maxIdx(weekdays),
    nightShare,
    bestDay,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    personality,
  };
}
