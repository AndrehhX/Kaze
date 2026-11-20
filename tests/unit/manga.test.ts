import { describe, expect, it } from "vitest";
import { mangaBrowseVariables, parseMangaParams, serializeMangaParams } from "@/lib/anilist/manga-params";
import { creditsOf, originLabel, type MangaCard } from "@/lib/anilist/manga-types";
import { adjacentChapters, chapterLabel, compareChapters, parseChapterNumber, sortChapters, type MangaChapter } from "@/lib/manga/catalog";
import { buildViews, fitSize, isChapterComplete, keyToIntent, preloadWindow, progressPercent, resolveReader, sanitizeReaderPrefs, step, swipeToIntent, tapToIntent, visualOrder, DEFAULT_READER_PREFS } from "@/lib/manga/reader/engine";
import { ADAPTATION_DATASET } from "@/lib/manga/continuity/dataset";
import { detectIssues, episodeCoverage, loadDataset, lookupContinuity, presentRecommendation, strongest, validateMapping, validateSubmission } from "@/lib/manga/continuity/engine";
import { DEFAULT_RANDOM_FILTERS, eligibility, eligiblePool, pickRandom, poolQuery, randomPage } from "@/lib/manga/random";
import { computeMangaStats, streaks } from "@/lib/manga/stats";
import { buildTaste, recommendManga } from "@/lib/manga/recommend";
import { reconcileManga, applyRemoteToLocal } from "@/lib/manga/sync";
import { newMangaEntry, normalizeMangaEntry, type MangaLibraryEntry, type MangaSnapshot } from "@/lib/manga/types";
import { DEMO_SERIES, demoChapter } from "@/lib/manga/demo/series";
import { availabilityFor } from "@/lib/manga/providers";
import { demoMangaProvider } from "@/lib/manga/providers/demo";
import type { LibraryEntry } from "@/lib/library/types";

const card = (over: Partial<MangaCard> = {}): MangaCard => ({
  id: 1,
  idMal: null,
  title: { romaji: "Test", english: null, native: null, userPreferred: "Test" },
  coverImage: { extraLarge: null, large: null, color: null },
  bannerImage: null,
  format: "MANGA",
  status: "FINISHED",
  chapters: 50,
  volumes: 5,
  averageScore: 80,
  meanScore: 80,
  popularity: 10000,
  favourites: 10,
  genres: ["Action"],
  isAdult: false,
  countryOfOrigin: "JP",
  startDate: { year: 2015, month: 1, day: 1 },
  endDate: { year: 2018, month: 1, day: 1 },
  staff: { edges: [] },
  ...over,
});

const snap = (over: Partial<MangaSnapshot> = {}): MangaSnapshot => ({ kind: "manga", title: "T", titleNative: null, cover: null, banner: null, color: null, chapters: 20, volumes: 2, format: "MANGA", country: "JP", year: 2020, genres: ["Drama"], averageScore: 70, author: "A", ...over });

const chapter = (id: string, number: string | null, sortKey: number, kind: MangaChapter["kind"] = "regular"): MangaChapter => ({ id, seriesKey: "s", editionId: "e", number, sortKey, kind, title: null, volumeId: null, language: "es", pageCount: 10, releasedAt: null });

describe("manga metadata params", () => {
  it("parses and round-trips URL filters, dropping invalid values only", () => {
    const p = parseMangaParams(new URLSearchParams("q=frieren&genres=Action,Drama&country=KR&format=MANGA,BAD&chMin=10&score=abc&sort=SCORE_DESC"));
    expect(p).toMatchObject({ search: "frieren", genres: ["Action", "Drama"], country: "KR", minChapters: 10, sort: "SCORE_DESC" });
    expect(p.formats).toBeUndefined();
    expect(p.minScore).toBeUndefined();
    expect(parseMangaParams(serializeMangaParams(p))).toEqual(p);
  });

  it("converts inclusive UI ranges into AniList's exclusive filters", () => {
    const v = mangaBrowseVariables({ minChapters: 10, maxChapters: 30, yearFrom: 2010, yearTo: 2012, minScore: 75 });
    expect(v).toMatchObject({ minChapters: 9, maxChapters: 31, yearFrom: 20099999, yearTo: 20130000, minScore: 74 });
    expect(mangaBrowseVariables({ search: "x" }).sort).toEqual(["SEARCH_MATCH"]);
  });

  it("derives credits and origin labels from real AniList fields", () => {
    const m = card({ staff: { edges: [{ role: "Story & Art (vols 1-41)", node: { id: 1, name: { full: "Kentarou Miura", native: null }, image: { large: null } } }] } });
    expect(creditsOf(m)).toEqual({ author: "Kentarou Miura", artist: "Kentarou Miura" });
    expect(creditsOf(card({ staff: { edges: [{ role: "Story", node: { id: 1, name: { full: "A", native: null }, image: { large: null } } }, { role: "Illustration", node: { id: 2, name: { full: "B", native: null }, image: { large: null } } }] } }))).toEqual({ author: "A", artist: "B" });
    expect(originLabel("KR")).toBe("Manhwa");
    expect(originLabel("CN")).toBe("Manhua");
    expect(originLabel("JP", "NOVEL")).toBe("Novela ligera");
  });
});

describe("chapter catalog", () => {
  it("orders decimal, bonus and unnumbered chapters by explicit sort key", () => {
    const list = [chapter("c2", "2", 2), chapter("x", null, 1.7, "special"), chapter("c1", "1", 1), chapter("c15", "1.5", 1.5, "bonus")];
    expect(sortChapters(list).map((c) => c.id)).toEqual(["c1", "c15", "x", "c2"]);
    expect(adjacentChapters(list, "c15")).toMatchObject({ prev: { id: "c1" }, next: { id: "x" } });
    expect(parseChapterNumber("Cap. 10,5")).toBe(10.5);
    expect(parseChapterNumber(null)).toBeNull();
    expect(chapterLabel({ number: "1.5", kind: "bonus", title: "X" })).toBe("Extra 1.5");
    expect(chapterLabel({ number: null, kind: "special", title: "Navidad" })).toBe("Especial: Navidad");
    expect(compareChapters(chapter("a", "3", 3), chapter("b", "3", 3))).toBeLessThan(0);
  });
});

describe("reader engine", () => {
  const pages = [0, 1, 2, 3, 4, 5].map((i) => ({ index: i, spread: i === 3, width: i === 3 ? 2000 : 1000, height: 1500 }));

  it("pairs pages for double-page mode, keeping covers and spreads alone", () => {
    expect(buildViews(pages, "double", { coverAlone: true })).toEqual([[0], [1, 2], [3], [4, 5]]);
    expect(buildViews(pages, "double", { coverAlone: false })).toEqual([[0, 1], [2], [3], [4, 5]]);
    expect(buildViews(pages, "single")).toHaveLength(6);
    expect(visualOrder([1, 2], "rtl")).toEqual([2, 1]);
    expect(visualOrder([1, 2], "ltr")).toEqual([1, 2]);
  });

  it("maps keys, taps and swipes according to reading direction", () => {
    expect(keyToIntent("ArrowLeft", "rtl", "paged")).toBe("next");
    expect(keyToIntent("ArrowLeft", "ltr", "paged")).toBe("prev");
    expect(keyToIntent("ArrowRight", "rtl", "paged")).toBe("prev");
    expect(keyToIntent(" ", "ltr", "vertical")).toBe("next");
    expect(keyToIntent("ArrowLeft", "ltr", "webtoon")).toBe("none");
    expect(tapToIntent(0.1, "rtl")).toBe("next");
    expect(tapToIntent(0.9, "ltr")).toBe("next");
    expect(tapToIntent(0.5, "ltr")).toBe("toggle-ui");
    expect(swipeToIntent(120, 4, "rtl")).toBe("next");
    expect(swipeToIntent(-120, 4, "ltr")).toBe("next");
    expect(swipeToIntent(20, 0, "ltr")).toBe("none");
  });

  it("navigates within bounds and reports chapter edges", () => {
    expect(step(4, 3, "next")).toEqual({ view: 3, boundary: "end" });
    expect(step(4, 0, "prev")).toEqual({ view: 0, boundary: "start" });
    expect(step(4, 1, "next")).toEqual({ view: 2, boundary: null });
    expect(step(4, 2, "first").view).toBe(0);
  });

  it("resolves auto settings from series and viewport", () => {
    expect(resolveReader(DEFAULT_READER_PREFS, { readingDirection: "rtl" }, { width: 1440, height: 900 })).toEqual({ mode: "paged", direction: "rtl", layout: "double" });
    expect(resolveReader(DEFAULT_READER_PREFS, { readingDirection: "rtl" }, { width: 390, height: 844 }).layout).toBe("single");
    expect(resolveReader(DEFAULT_READER_PREFS, { readingDirection: "vertical" }, { width: 1440, height: 900 })).toEqual({ mode: "webtoon", direction: "ltr", layout: "single" });
    expect(resolveReader({ ...DEFAULT_READER_PREFS, direction: "ltr", layout: "single" }, { readingDirection: "rtl" }, { width: 1440, height: 900 })).toMatchObject({ direction: "ltr", layout: "single" });
  });

  it("preloads a bounded window, tracks completion and preserves aspect ratio", () => {
    expect(preloadWindow(5, 20, 3)).toEqual([4, 5, 6, 7, 8]);
    expect(preloadWindow(0, 3, 6)).toEqual([0, 1, 2]);
    expect(progressPercent(4, 10)).toBe(50);
    expect(isChapterComplete(9, 10)).toBe(true);
    expect(isChapterComplete(8, 10)).toBe(false);
    const s = fitSize(1000, 1500, 800, 800, "contain");
    expect(s.width / s.height).toBeCloseTo(1000 / 1500, 2);
    expect(fitSize(1000, 1500, 500, 800, "width").width).toBe(500);
    expect(fitSize(1000, 1500, 500, 800, "original")).toEqual({ width: 1000, height: 1500 });
  });

  it("sanitizes stored preferences", () => {
    const p = sanitizeReaderPrefs({ mode: "hologram", dim: 4, preload: 99, dataSaver: "yes", direction: "ltr" });
    expect(p.mode).toBe("auto");
    expect(p.dim).toBe(0.6);
    expect(p.preload).toBe(8);
    expect(p.dataSaver).toBe(false);
    expect(p.direction).toBe("ltr");
  });
});

describe("continue the story", () => {
  it("ships a dataset where every record passes validation", () => {
    for (const r of ADAPTATION_DATASET) expect(validateMapping(r)).toMatchObject({ ok: true });
    expect(loadDataset()).toHaveLength(ADAPTATION_DATASET.length);
    expect(detectIssues(loadDataset())).toEqual([]);
  });

  it("finds verified continuations with their franchise timeline", () => {
    const r = lookupContinuity(113415);
    expect(r.status).toBe("found");
    if (r.status !== "found") return;
    expect(r.current[0].continuationChapter).toBe("64");
    expect(r.timeline.map((t) => t.id)).toEqual(["jjk-s1", "jjk-s2"]);
    expect(presentRecommendation(r.current[0])).toMatchObject({ kind: "recommendation", chapter: "64", status: "verified" });
  });

  it("never claims precision for unknown or unmapped seasons", () => {
    const frieren2 = lookupContinuity(182255);
    expect(frieren2.status).toBe("found");
    if (frieren2.status === "found") expect(presentRecommendation(frieren2.current[0])).toMatchObject({ kind: "unverified", chapter: null });
    expect(lookupContinuity(171018)).toEqual({ status: "none", animeId: 171018 });
    expect(presentRecommendation(null).headline).toMatch(/no verificado|aún no verificado/i);
  });

  it("labels approximate records as recommendations, not certainties", () => {
    const r = lookupContinuity(145064);
    if (r.status !== "found") throw new Error("missing");
    const p = presentRecommendation(r.current[0]);
    expect(p.status).toBe("approximate");
    expect(p.headline).toMatch(/recomendamos/);
    expect(r.current[0].alternativeStarts[0].chapter).toBe("138");
  });

  it("rejects records that would fabricate certainty", () => {
    const base = ADAPTATION_DATASET[0];
    expect(validateMapping({ ...base, sourceReferences: [base.sourceReferences[0]] })).toMatchObject({ ok: false });
    expect(validateMapping({ ...base, verificationStatus: "unknown" })).toMatchObject({ ok: false });
    expect(validateMapping({ ...base, verificationStatus: "approximate", basis: null })).toMatchObject({ ok: false });
    expect(validateMapping({ ...base, continuationChapter: "40" })).toMatchObject({ ok: false });
    expect(validateMapping({ ...base, mangaChapterEnd: "abc" })).toMatchObject({ ok: false });
  });

  it("detects overlaps, gaps and conflicting duplicates", () => {
    const [a, b] = loadDataset().filter((r) => r.franchise === "jujutsu-kaisen");
    expect(detectIssues([a, { ...b, mangaChapterStart: "60" }])[0].kind).toBe("overlap");
    expect(detectIssues([a, { ...b, mangaChapterStart: "70" }])[0].kind).toBe("gap");
    expect(detectIssues([a, { ...a, id: "dupe", continuationChapter: "65" }]).some((i) => i.kind === "duplicate")).toBe(true);
    expect(strongest([{ ...a, verificationStatus: "pending" }, a])?.verificationStatus).toBe("verified");
  });

  it("answers episode-level questions honestly", () => {
    const jjk = loadDataset().find((r) => r.id === "jjk-s1")!;
    expect(episodeCoverage(jjk, 24)).toBe("finished-season");
    expect(episodeCoverage(jjk, 10)).toBe("mid-season");
    expect(episodeCoverage(jjk, null)).toBe("unknown");
  });

  it("validates community submissions before they reach review", () => {
    expect(validateSubmission({ animeId: 1, animeSeason: "s1", mangaId: 2, mangaChapterEnd: "34", continuationChapter: "35", notes: "", sourceUrls: ["https://example.com/a"] })).toMatchObject({ ok: true });
    expect(validateSubmission({ animeId: 1, animeSeason: "s1", mangaId: 2, mangaChapterEnd: "34", continuationChapter: "35", notes: "", sourceUrls: [] })).toMatchObject({ ok: false });
    expect(validateSubmission({ animeId: 1, animeSeason: "s1", mangaId: 2, mangaChapterEnd: "40", continuationChapter: "35", notes: "", sourceUrls: ["https://example.com/a"] })).toMatchObject({ ok: false });
    expect(validateSubmission({ animeId: 1, animeSeason: "s1", mangaId: 2, mangaChapterEnd: null, continuationChapter: "35", notes: "", sourceUrls: ["http://insecure.example"] })).toMatchObject({ ok: false });
  });
});

describe("random discovery", () => {
  const lib: Record<number, MangaLibraryEntry> = { 2: { ...newMangaEntry(2, snap()), status: "COMPLETED" }, 3: newMangaEntry(3, snap()) };
  const pool = [card({ id: 1 }), card({ id: 2 }), card({ id: 3 }), card({ id: 4, status: "RELEASING" }), card({ id: 5, chapters: null }), card({ id: 6, isAdult: true }), card({ id: 7, genres: ["Romance"] })];

  it("applies every filter to the candidate pool", () => {
    expect(eligiblePool(pool, DEFAULT_RANDOM_FILTERS, lib).map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 7]);
    expect(eligiblePool(pool, { ...DEFAULT_RANDOM_FILTERS, excludeLibrary: true }, lib).map((m) => m.id)).toEqual([1, 4, 5, 7]);
    expect(eligiblePool(pool, { ...DEFAULT_RANDOM_FILTERS, excludeRead: true }, lib).map((m) => m.id)).toEqual([1, 3, 4, 5, 7]);
    expect(eligiblePool(pool, { ...DEFAULT_RANDOM_FILTERS, completedOnly: true }, lib).map((m) => m.id)).not.toContain(4);
    expect(eligiblePool(pool, { ...DEFAULT_RANDOM_FILTERS, length: "medium" }, lib).map((m) => m.id)).toEqual([1, 2, 3, 4, 7]);
    expect(eligiblePool(pool, { ...DEFAULT_RANDOM_FILTERS, genres: ["Romance"] }, lib).map((m) => m.id)).toEqual([7]);
    expect(eligibility(card({ startDate: { year: 2001, month: 1, day: 1 } }), { ...DEFAULT_RANDOM_FILTERS, yearFrom: 2010 }, {})).toBe("year");
  });

  it("sends the same filters to the server pool query", () => {
    const q = poolQuery({ ...DEFAULT_RANDOM_FILTERS, genres: ["Drama"], length: "short", completedOnly: true, popularity: "niche", country: "KR" }, 3);
    expect(Object.fromEntries(q)).toMatchObject({ genres: "Drama", chMax: "30", status: "FINISHED", popMax: "15000", country: "KR", page: "3" });
  });

  it("picks uniformly from the eligible pool and never from an empty one", () => {
    expect(pickRandom([], () => 0)).toBeNull();
    expect(pickRandom(["a", "b", "c"], () => 2)).toBe("c");
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const v = pickRandom(["a", "b", "c"])!;
      counts[v] = (counts[v] ?? 0) + 1;
    }
    for (const k of ["a", "b", "c"]) expect(counts[k]).toBeGreaterThan(800);
    expect(randomPage(1000, 50, 5, () => 4)).toBe(5);
    expect(randomPage(10, 50, 5, () => 0)).toBe(1);
  });
});

describe("library, stats, recommendations and sync", () => {
  it("normalizes progress against known totals only", () => {
    const e = normalizeMangaEntry({ ...newMangaEntry(1, snap({ chapters: 20 })), status: "CURRENT", progress: 25 });
    expect(e).toMatchObject({ progress: 20, status: "COMPLETED" });
    const ongoing = normalizeMangaEntry({ ...newMangaEntry(1, snap({ chapters: null })), status: "CURRENT", progress: 250 });
    expect(ongoing).toMatchObject({ progress: 250, status: "CURRENT" });
  });

  it("computes reading time only from measured sessions", () => {
    const entries = [{ ...newMangaEntry(1, snap()), status: "COMPLETED" as const, progress: 20, score: 80, completedAt: "2026-11-02" }, { ...newMangaEntry(2, snap({ author: "B" })), progress: 4 }];
    const now = Date.parse("2026-11-19T12:00:00Z");
    const day = 86_400_000;
    const sessions = [0, 1, 2].map((i) => ({ id: String(i), mangaId: 1, chapterId: "c", startedAt: now - i * day, endedAt: now - i * day + 600_000, activeSeconds: 600, pagesViewed: 10 }));
    const s = computeMangaStats(entries, sessions, [{ mangaId: 1, chapterId: "c", page: 9, pageCount: 10, completed: true, updatedAt: now }], [1], now);
    expect(s.totals).toMatchObject({ titles: 2, completed: 1, chaptersLogged: 24 });
    expect(s.measured).toMatchObject({ activeMinutes: 30, pagesRead: 30, chaptersFinishedInReader: 1, currentStreak: 3 });
    expect(s.meanScore).toBe(80);
    expect(computeMangaStats(entries, [], [], [], now).measured.activeMinutes).toBe(0);
    expect(streaks(["2026-11-10", "2026-11-11", "2026-11-13"], "2026-11-19")).toEqual({ current: 0, longest: 2 });
  });

  it("explains every recommendation", () => {
    const anime = [{ media: { genres: ["Action", "Fantasy"], title: "X" }, status: "COMPLETED", score: 90, favorite: true } as unknown as LibraryEntry];
    const recs = recommendManga([card({ id: 10, genres: ["Action", "Fantasy"] }), card({ id: 11, genres: ["Romance"] })], buildTaste(anime, []), new Set());
    expect(recs.map((r) => r.media.id)).toEqual([10]);
    expect(recs[0].reason).toMatch(/Porque disfrutas/);
  });

  it("reconciles AniList manga lists without touching KAZE-only page data", () => {
    const local: MangaLibraryEntry = { ...newMangaEntry(5, snap()), status: "CURRENT", progress: 10, progressVolumes: 1, lastChapterId: "c10", lastPage: 7, updatedAt: 2000 };
    const demo = newMangaEntry(-1001, snap());
    const decisions = reconcileManga([local, demo], [{ mediaId: 5, status: "CURRENT", progress: 12, progressVolumes: 2, score: null, notes: "", updatedAt: 3000, startedAt: null, completedAt: null, repeat: 0 }], 1000);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ kind: "merge", volumes: 2 });
    if (decisions[0].kind !== "merge") return;
    expect(decisions[0].merged.progress).toBe(12);
    const applied = applyRemoteToLocal(decisions[0].merged, 2, local, undefined, 4000);
    expect(applied).toMatchObject({ progress: 12, progressVolumes: 2, lastChapterId: "c10", lastPage: 7 });
  });
});

describe("authorized demo content", () => {
  it("ships original demo series with alt text for every page", () => {
    expect(DEMO_SERIES).toHaveLength(2);
    for (const s of DEMO_SERIES) {
      expect(s.id).toBeLessThan(0);
      for (const c of s.chapters) {
        expect(c.pages.length).toBe(c.pageCount);
        for (const p of c.pages) {
          expect(p.src).toMatch(/^\/manga-demo\//);
          expect(p.alt.length).toBeGreaterThan(30);
        }
      }
    }
    expect(demoChapter("vdp-c1")?.chapter.pages.some((p) => p.spread)).toBe(true);
  });

  it("exposes the demo through the provider contracts, and only links out for AniList titles", async () => {
    expect((await demoMangaProvider.listChapters("kaze:viento-de-papel")).map((c) => c.number)).toEqual(["1", "1.5", "2"]);
    expect(await demoMangaProvider.canRead("vdp-c2", { userId: null })).toEqual({ allowed: true, reason: "open-license" });
    expect((await demoMangaProvider.canRead("nope", { userId: null })).allowed).toBe(false);
    const external = availabilityFor({ seriesKey: "anilist:1", externalLinks: [{ site: "MANGA Plus", url: "https://mangaplus.shueisha.co.jp/titles/1", type: "STREAMING", language: "English", isDisabled: false }, { site: "Twitter", url: "https://x.com/a", type: "SOCIAL", language: null, isDisabled: false }, { site: "Viz", url: "http://insecure", type: "STREAMING", language: null, isDisabled: false }] });
    expect(external).toHaveLength(1);
    expect(external[0]).toMatchObject({ kind: "external", official: true, label: "MANGA Plus (Shueisha)" });
    expect(availabilityFor({ seriesKey: "kaze:viento-de-papel" })[0].kind).toBe("embedded");
  });
});
