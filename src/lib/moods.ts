import type { BrowseParams } from "@/lib/anilist/types";

/**
 * Mood → AniList query mapping. This is a transparent, hand-authored rule set
 * (not a trained model). Each mood lists exactly which genres/tags it uses so the
 * UI can show the user why a title appeared.
 */
export type Mood = {
  id: string;
  label: string;
  jp: string;
  blurb: string;
  query: BrowseParams;
  /** Human explanation of the mapping. */
  rule: string;
  hue: number;
};

export const MOODS: Mood[] = [
  { id: "emotional", label: "Emotivo", jp: "感動", blurb: "Historias que se quedan contigo.", hue: 330, rule: "Género drama, nota de la comunidad ≥ 75", query: { genres: ["Drama"], minScore: 75, sort: "SCORE_DESC" } },
  { id: "relaxing", label: "Relajante", jp: "癒し", blurb: "Sin presión, con luz cálida.", hue: 150, rule: "Recuentos de la vida con la etiqueta Iyashikei", query: { genres: ["Slice of Life"], tags: ["Iyashikei"], sort: "POPULARITY_DESC" } },
  { id: "action", label: "Pura acción", jp: "熱血", blurb: "Grandes peleas, todavía más en juego.", hue: 10, rule: "Género acción, nota ≥ 70, por popularidad", query: { genres: ["Action"], minScore: 70, sort: "POPULARITY_DESC" } },
  { id: "romantic", label: "Romántico", jp: "恋愛", blurb: "Mariposas en el estómago garantizadas.", hue: 345, rule: "Género romance, nota ≥ 70", query: { genres: ["Romance"], minScore: 70, sort: "POPULARITY_DESC" } },
  { id: "mysterious", label: "Misterioso", jp: "謎", blurb: "Preguntas que merece la pena perseguir.", hue: 260, rule: "Género misterio, nota ≥ 70", query: { genres: ["Mystery"], minScore: 70, sort: "SCORE_DESC" } },
  { id: "dark", label: "Oscuro", jp: "闇", blurb: "Inquietante, intenso, inolvidable.", hue: 280, rule: "Género psicológico, sin comedia ni recuentos de la vida", query: { genres: ["Psychological"], excludedGenres: ["Comedy", "Slice of Life"], sort: "SCORE_DESC" } },
  { id: "comforting", label: "Reconfortante", jp: "安心", blurb: "Como una manta y un té.", hue: 40, rule: "Comedia + recuentos de la vida, sin terror ni psicológico", query: { genres: ["Comedy", "Slice of Life"], excludedGenres: ["Horror", "Psychological"], minScore: 70, sort: "POPULARITY_DESC" } },
  { id: "epic", label: "Épico", jp: "壮大", blurb: "Mundos en los que perderse.", hue: 210, rule: "Aventura + fantasía, 20+ episodios, nota ≥ 72", query: { genres: ["Adventure", "Fantasy"], minEpisodes: 20, minScore: 72, sort: "SCORE_DESC" } },
];

export function moodById(id: string) {
  return MOODS.find((m) => m.id === id);
}

/** Merge results from several moods: titles matching more moods rank first, then by score. */
export function mergeMoodResults<T extends { id: number; averageScore: number | null }>(byMood: { moodId: string; items: T[] }[]) {
  const map = new Map<number, { item: T; moods: string[] }>();
  for (const { moodId, items } of byMood) {
    for (const it of items) {
      const cur = map.get(it.id);
      if (cur) cur.moods.push(moodId);
      else map.set(it.id, { item: it, moods: [moodId] });
    }
  }
  return [...map.values()].sort((a, b) => b.moods.length - a.moods.length || (b.item.averageScore ?? 0) - (a.item.averageScore ?? 0));
}
