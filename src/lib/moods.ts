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
  { id: "emotional", label: "Emotional", jp: "感動", blurb: "Stories that stay with you.", hue: 330, rule: "Drama genre, community score ≥ 75", query: { genres: ["Drama"], minScore: 75, sort: "SCORE_DESC" } },
  { id: "relaxing", label: "Relaxing", jp: "癒し", blurb: "Low stakes, warm light.", hue: 150, rule: "Slice of Life with the Iyashikei tag", query: { genres: ["Slice of Life"], tags: ["Iyashikei"], sort: "POPULARITY_DESC" } },
  { id: "action", label: "Action-packed", jp: "熱血", blurb: "Big fights, bigger stakes.", hue: 10, rule: "Action genre, score ≥ 70, by popularity", query: { genres: ["Action"], minScore: 70, sort: "POPULARITY_DESC" } },
  { id: "romantic", label: "Romantic", jp: "恋愛", blurb: "Butterflies guaranteed.", hue: 345, rule: "Romance genre, score ≥ 70", query: { genres: ["Romance"], minScore: 70, sort: "POPULARITY_DESC" } },
  { id: "mysterious", label: "Mysterious", jp: "謎", blurb: "Questions worth chasing.", hue: 260, rule: "Mystery genre, score ≥ 70", query: { genres: ["Mystery"], minScore: 70, sort: "SCORE_DESC" } },
  { id: "dark", label: "Dark", jp: "闇", blurb: "Unsettling, heavy, unforgettable.", hue: 280, rule: "Psychological genre, excluding Comedy and Slice of Life", query: { genres: ["Psychological"], excludedGenres: ["Comedy", "Slice of Life"], sort: "SCORE_DESC" } },
  { id: "comforting", label: "Comforting", jp: "安心", blurb: "Like a blanket and tea.", hue: 40, rule: "Comedy + Slice of Life, excluding Horror and Psychological", query: { genres: ["Comedy", "Slice of Life"], excludedGenres: ["Horror", "Psychological"], minScore: 70, sort: "POPULARITY_DESC" } },
  { id: "epic", label: "Epic", jp: "壮大", blurb: "Worlds worth getting lost in.", hue: 210, rule: "Adventure + Fantasy, 20+ episodes, score ≥ 72", query: { genres: ["Adventure", "Fantasy"], minEpisodes: 20, minScore: 72, sort: "SCORE_DESC" } },
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
