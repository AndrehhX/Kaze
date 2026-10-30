import { describe, expect, it } from "vitest";
import { reconcile, fuzzyToIso, isoToFuzzy, type RemoteEntry } from "@/lib/library/sync";
import { normalizeEntry, type LibraryEntry } from "@/lib/library/types";
import { correction, estimateOffset, expectedPosition, NUDGE_THRESHOLD, SEEK_THRESHOLD, type RoomState } from "@/lib/watch-party/sync";
import { buildGenreProfile, pickSeed, recommend } from "@/lib/recommend";
import { parseBrowseParams, serializeBrowseParams, activeFilterCount } from "@/lib/anilist/browse-params";
import { browseVariables } from "@/lib/anilist/service";
import { activeCues, cueText } from "@/components/player/captions";
import { safeRedirectPath, seasonOf, cleanDescription } from "@/lib/utils";
import { buildEpisodes } from "@/lib/episodes";
import { computeAchievements, computeDna } from "@/lib/dna";
import { mergeMoodResults } from "@/lib/moods";
import { isEffectivelyComplete } from "@/stores/progress";
import type { MediaCard } from "@/lib/anilist/types";

const snap = (over: Partial<LibraryEntry["media"]> = {}): LibraryEntry["media"] => ({
  title: "T",
  titleNative: null,
  cover: null,
  banner: null,
  color: null,
  episodes: 12,
  format: "TV",
  year: 2020,
  genres: ["Action"],
  averageScore: 80,
  studio: "Studio A",
  duration: 24,
  ...over,
});

const entry = (over: Partial<LibraryEntry> = {}): LibraryEntry => ({
  mediaId: 1,
  status: "CURRENT",
  progress: 3,
  score: null,
  notes: "",
  favorite: false,
  startedAt: null,
  completedAt: null,
  repeat: 0,
  createdAt: 1000,
  updatedAt: 1000,
  media: snap(),
  ...over,
});

const remote = (over: Partial<RemoteEntry> = {}): RemoteEntry => ({
  mediaId: 1,
  status: "CURRENT",
  progress: 3,
  score: null,
  notes: "",
  updatedAt: 1000,
  startedAt: null,
  completedAt: null,
  repeat: 0,
  ...over,
});

describe("AniList list reconciliation", () => {
  it("imports remote-only and exports local-only entries", () => {
    const d = reconcile([entry({ mediaId: 1 })], [remote({ mediaId: 2 })], null);
    expect(d.find((x) => x.mediaId === 1)?.kind).toBe("export");
    expect(d.find((x) => x.mediaId === 2)?.kind).toBe("import");
  });

  it("is a no-op when content matches", () => {
    expect(reconcile([entry()], [remote()], 0)[0].kind).toBe("noop");
  });

  it("pushes when only local changed since last sync, pulls when only remote did", () => {
    expect(reconcile([entry({ progress: 5, updatedAt: 3000 })], [remote({ updatedAt: 1000 })], 2000)[0].kind).toBe("push");
    expect(reconcile([entry({ updatedAt: 1000 })], [remote({ progress: 6, updatedAt: 3000 })], 2000)[0].kind).toBe("pull");
  });

  it("never silently overwrites: merges conflicting edits, keeping max progress and newest status", () => {
    const [d] = reconcile([entry({ progress: 8, status: "PAUSED", updatedAt: 4000 })], [remote({ progress: 10, status: "CURRENT", updatedAt: 3000 })], 2000);
    expect(d.kind).toBe("merge");
    if (d.kind !== "merge") return;
    expect(d.merged.progress).toBe(10);
    expect(d.merged.status).toBe("PAUSED");
    expect(d.conflict).toEqual(expect.arrayContaining(["status", "progress"]));
    expect(d.pushRemote).toBe(true);
  });

  it("keeps a score that exists on only one side", () => {
    const [d] = reconcile([entry({ score: null, progress: 4, updatedAt: 5000 })], [remote({ score: 85, updatedAt: 4000 })], 1000);
    expect(d.kind === "merge" && d.merged.score).toBe(85);
  });

  it("converts fuzzy dates both ways", () => {
    expect(fuzzyToIso({ year: 2024, month: 3, day: 9 })).toBe("2024-03-09");
    expect(fuzzyToIso({ year: null, month: null, day: null })).toBeNull();
    expect(isoToFuzzy("2024-03-09")).toEqual({ year: 2024, month: 3, day: 9 });
  });
});

describe("library entry invariants", () => {
  it("clamps progress and auto-completes at the final episode", () => {
    const e = normalizeEntry(entry({ progress: 40 }), Date.UTC(2026, 0, 5));
    expect(e.progress).toBe(12);
    expect(e.status).toBe("COMPLETED");
    expect(e.completedAt).toBe("2026-01-05");
  });
  it("treats a zero score as unrated and clamps out-of-range scores", () => {
    expect(normalizeEntry(entry({ score: 0 })).score).toBeNull();
    expect(normalizeEntry(entry({ score: 140 })).score).toBe(100);
  });
});

describe("watch-party synchronization", () => {
  it("estimates clock offset from the lowest-RTT sample", () => {
    const est = estimateOffset([
      { t0: 0, server: 10_500, t1: 400 },
      { t0: 1000, server: 11_050, t1: 1100 },
    ]);
    expect(est?.rtt).toBe(100);
    expect(est?.offset).toBe(10_000);
  });

  const state: RoomState = { episodeId: "1", isPlaying: true, position: 100, rate: 1, updatedAt: 50_000, version: 3 };

  it("extrapolates playing state and freezes paused state", () => {
    expect(expectedPosition(state, 52_500)).toBeCloseTo(102.5);
    expect(expectedPosition({ ...state, isPlaying: false }, 99_999)).toBe(100);
    expect(expectedPosition({ ...state, rate: 1.5 }, 52_000)).toBeCloseTo(103);
  });

  it("ignores tiny drift, nudges rate for small drift, seeks for large drift", () => {
    expect(correction(100.05, 100, 1)).toEqual({ kind: "ok", rate: 1 });
    const behind = correction(100 - (NUDGE_THRESHOLD + 0.2), 100, 1);
    expect(behind.kind).toBe("nudge");
    expect(behind.kind === "nudge" && behind.rate).toBeGreaterThan(1);
    const ahead = correction(100.5, 100, 1);
    expect(ahead.kind === "nudge" && ahead.rate).toBeLessThan(1);
    const far = correction(100 + SEEK_THRESHOLD + 2, 100, 1);
    expect(far).toMatchObject({ kind: "seek", to: 100 });
  });
});

const card = (id: number, genres: string[], score = 80, popularity = 50_000): MediaCard =>
  ({ id, idMal: null, title: { romaji: `R${id}`, english: `E${id}`, native: null, userPreferred: null }, coverImage: { extraLarge: null, large: null, color: null }, bannerImage: null, format: "TV", status: "FINISHED", episodes: 12, duration: 24, season: null, seasonYear: 2020, averageScore: score, meanScore: score, popularity, favourites: 1, genres, isAdult: false, startDate: { year: 2020, month: 1, day: 1 }, nextAiringEpisode: null, studios: { nodes: [] } }) as MediaCard;

describe("explainable recommendations", () => {
  const lib = [
    entry({ mediaId: 10, status: "COMPLETED", score: 92, media: snap({ genres: ["Psychological", "Thriller"] }) }),
    entry({ mediaId: 11, status: "COMPLETED", score: 85, media: snap({ genres: ["Psychological", "Mystery"] }) }),
    entry({ mediaId: 12, status: "DROPPED", score: 30, media: snap({ genres: ["Sports"] }) }),
  ];
  const profile = buildGenreProfile(lib);

  it("builds a genre profile that favours finished, high-scored genres", () => {
    expect(profile.top[0]).toBe("Psychological");
    expect(profile.weights.Sports).toBeLessThan(0);
  });

  it("ranks by affinity, excludes library titles, and explains why", () => {
    const recs = recommend([card(10, ["Psychological"]), card(20, ["Psychological", "Thriller"]), card(21, ["Sports"])], { profile, exclude: new Set([10, 11, 12]) });
    expect(recs.map((r) => r.media.id)).not.toContain(10);
    expect(recs[0].media.id).toBe(20);
    expect(recs[0].reason).toMatch(/Because you enjoy Psychological/);
  });

  it("surfaces AniList fan signals as the reason when they dominate", () => {
    const recs = recommend([card(30, ["Comedy"], 70)], { profile: buildGenreProfile([]), exclude: new Set(), peerSignals: new Map([[30, [{ seedTitle: "Monster", rating: 300 }, { seedTitle: "Erased", rating: 100 }]]]) });
    expect(recs[0].reason).toBe("Recommended by AniList fans of Monster");
  });

  it("picks the best-loved title as the seed", () => {
    expect(pickSeed(lib)?.mediaId).toBe(10);
  });
});

describe("discover URL filters", () => {
  it("round-trips params and drops invalid values without failing the rest", () => {
    const p = parseBrowseParams(new URLSearchParams("q=frieren&genres=Drama,Fantasy&format=TV,BAD&score=80&season=FALL&year=abc&sort=SCORE_DESC"));
    expect(p.search).toBe("frieren");
    expect(p.genres).toEqual(["Drama", "Fantasy"]);
    expect(p.formats).toBeUndefined();
    expect(p.minScore).toBe(80);
    expect(p.year).toBeUndefined();
    expect(parseBrowseParams(serializeBrowseParams(p))).toEqual(p);
    expect(activeFilterCount(p)).toBe(3);
  });

  it("maps to AniList variables with exclusive bounds and stable sort", () => {
    const v = browseVariables({ yearFrom: 2010, yearTo: 2015, minScore: 80, sort: "SCORE_DESC" });
    expect(v.yearFrom).toBe(20099999);
    expect(v.yearTo).toBe(20160000);
    expect(v.minScore).toBe(79);
    expect(v.sort).toEqual(["SCORE_DESC", "ID_DESC"]);
    expect(browseVariables({ search: "x" }).sort).toEqual(["SEARCH_MATCH"]);
    expect(browseVariables({}).sort).toEqual(["POPULARITY_DESC", "ID_DESC"]);
  });
});

describe("captions", () => {
  const cues = [
    { start: 1, end: 3, text: "a" },
    { start: 4, end: 6, text: "b" },
  ];
  it("applies subtitle delay", () => {
    expect(activeCues(cues, 2, 0).map((c) => c.text)).toEqual(["a"]);
    expect(activeCues(cues, 2.5, 1).map((c) => c.text)).toEqual(["a"]);
    expect(activeCues(cues, 4.5, 1)).toEqual([]);
    expect(activeCues(cues, 3.5, -1).map((c) => c.text)).toEqual(["b"]);
  });
  it("strips WebVTT markup", () => {
    expect(cueText("<v Celia><i>Hello</i> &amp; bye</v>")).toBe("Hello & bye");
  });
});

describe("security helpers", () => {
  it("allows only same-origin relative redirects", () => {
    expect(safeRedirectPath("/library?tab=CURRENT")).toBe("/library?tab=CURRENT");
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
    expect(safeRedirectPath(null, "/home")).toBe("/home");
  });
  it("cleans AniList descriptions and removes spoiler blocks", () => {
    expect(cleanDescription("Hi<br>there ~!secret!~ (Source: X)")).toBe("Hi\nthere");
  });
});

describe("misc domain logic", () => {
  it("computes seasons, including December rolling into next winter", () => {
    expect(seasonOf(new Date(Date.UTC(2026, 9, 29)))).toEqual({ season: "FALL", year: 2026 });
    expect(seasonOf(new Date(Date.UTC(2026, 11, 20)))).toEqual({ season: "WINTER", year: 2027 });
  });

  it("builds honest episode lists without inventing titles", () => {
    const eps = buildEpisodes(
      { episodes: 3, status: "RELEASING", nextAiringEpisode: { episode: 3, airingAt: 2000, timeUntilAiring: 100 }, streamingEpisodes: [{ title: "Episode 1 - Start", thumbnail: "t", url: "http://x", site: "S" }], airingSchedule: { nodes: [] }, duration: 24 },
      1000,
    );
    expect(eps).toHaveLength(3);
    expect(eps[0]).toMatchObject({ title: "Start", officialUrl: "https://x", aired: true });
    expect(eps[1]).toMatchObject({ title: null, aired: true });
    expect(eps[2].aired).toBe(false);
  });

  it("computes DNA and achievements from real entries only", () => {
    const lib = [entry({ status: "COMPLETED", progress: 12, score: 90 }), entry({ mediaId: 2, status: "PLANNING", progress: 0, media: snap({ genres: ["Romance"], year: 1998 }) })];
    const dna = computeDna(lib);
    expect(dna.total).toBe(2);
    expect(dna.genres[0].name).toBe("Action");
    expect(dna.genres.find((g) => g.name === "Romance")).toBeUndefined();
    expect(dna.meanScore).toBe(90);
    const ach = computeAchievements(lib);
    expect(ach.find((a) => a.id === "first-finish")?.earned).toBe(true);
    expect(ach.find((a) => a.id === "ten-complete")?.earned).toBe(false);
  });

  it("ranks multi-mood matches first", () => {
    const merged = mergeMoodResults([
      { moodId: "a", items: [{ id: 1, averageScore: 70 }, { id: 2, averageScore: 90 }] },
      { moodId: "b", items: [{ id: 1, averageScore: 70 }] },
    ]);
    expect(merged.map((m) => m.item.id)).toEqual([1, 2]);
    expect(merged[0].moods).toEqual(["a", "b"]);
  });

  it("treats the final stretch of an episode as watched", () => {
    expect(isEffectivelyComplete(570, 596)).toBe(true);
    expect(isEffectivelyComplete(560, 596)).toBe(false);
    expect(isEffectivelyComplete(300, 596)).toBe(false);
  });
});
