import { describe, expect, it } from "vitest";
import { computeWrapped, type WrappedProgress } from "@/lib/wrapped";
import type { LibraryEntry } from "@/lib/library/types";

const entry = (mediaId: number, genres: string[], extra: Partial<LibraryEntry> = {}): LibraryEntry => ({
  mediaId,
  status: "CURRENT",
  progress: 0,
  score: null,
  notes: "",
  favorite: false,
  startedAt: null,
  completedAt: null,
  repeat: 0,
  createdAt: 0,
  updatedAt: 0,
  media: { title: `Anime ${mediaId}`, titleNative: null, cover: `c${mediaId}`, banner: null, color: null, episodes: 12, format: "TV", year: 2026, genres, averageScore: 80, studio: null, duration: 24 },
  ...extra,
});

const ep = (seriesId: string, n: number, date: string, opts: Partial<WrappedProgress> = {}): WrappedProgress => ({
  seriesId,
  episodeId: String(n),
  position: 1400,
  duration: 1440,
  completed: true,
  updatedAt: new Date(date).getTime(),
  ...opts,
});

describe("computeWrapped", () => {
  it("cuenta solo el año pedido y episodios vistos de verdad", () => {
    const w = computeWrapped(2026, [], [
      ep("1", 1, "2026-03-01T20:00:00"),
      ep("1", 2, "2025-12-31T20:00:00"), // otro año
      ep("1", 3, "2026-03-02T20:00:00", { completed: false, position: 30 }), // menos de 1 min
    ]);
    expect(w.episodes).toBe(1);
    expect(w.minutes).toBe(24);
    expect(w.series).toBe(1);
  });

  it("ordena el top por episodios y usa datos de la biblioteca", () => {
    const lib = [entry(10, ["Action"]), entry(20, ["Romance"])];
    const prog = [ep("10", 1, "2026-05-01T18:00:00"), ep("20", 1, "2026-05-02T18:00:00"), ep("20", 2, "2026-05-03T18:00:00")];
    const w = computeWrapped(2026, lib, prog);
    expect(w.top.map((t) => t.seriesId)).toEqual(["20", "10"]);
    expect(w.top[0].title).toBe("Anime 20");
    expect(w.topGenres[0]).toEqual({ name: "Romance", count: 2 });
    expect(w.busiestMonth).toBe(4); // mayo
  });

  it("detecta maratonistas y noctámbulos", () => {
    const binge = Array.from({ length: 12 }, (_, i) => ep("1", i + 1, "2026-07-04T15:00:00"));
    expect(computeWrapped(2026, [entry(1, ["Comedy"])], binge).personality.id).toBe("binge");

    const nights = Array.from({ length: 24 }, (_, i) => ep("2", i + 1, `2026-08-${String((i % 20) + 1).padStart(2, "0")}T02:00:00`));
    expect(computeWrapped(2026, [entry(2, ["Drama"])], nights).personality.id).toBe("night");
  });

  it("usa el género favorito y marca a quien recién empieza", () => {
    const prog = Array.from({ length: 6 }, (_, i) => ep("3", i + 1, `2026-02-0${(i % 6) + 1}T19:00:00`));
    expect(computeWrapped(2026, [entry(3, ["Mystery"])], prog).personality.id).toBe("detective");
    expect(computeWrapped(2026, [], []).personality.id).toBe("newcomer");
  });

  it("si no hay progreso, saca géneros de lo completado en el año", () => {
    const lib = [entry(5, ["Sports"], { status: "COMPLETED", completedAt: "2026-04-10", score: 90 }), entry(6, ["Sports"], { status: "COMPLETED", completedAt: "2026-06-01", score: 70 })];
    const w = computeWrapped(2026, lib, []);
    expect(w.completedTitles).toBe(2);
    expect(w.topGenres[0].name).toBe("Sports");
    expect(w.averageScore).toBe(80);
  });
});
