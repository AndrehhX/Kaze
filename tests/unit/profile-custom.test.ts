import { describe, expect, it } from "vitest";
import { DEFAULT_SHOWCASES, experience, levelFromXp, parseProfileCustom, safeImageUrl, xpForLevel } from "@/lib/profile-custom";

describe("parseProfileCustom", () => {
  it("usa los escaparates por defecto si no hay datos o es el array antiguo", () => {
    expect(parseProfileCustom(null).showcases).toEqual(DEFAULT_SHOWCASES);
    expect(parseProfileCustom([]).showcases).toEqual(DEFAULT_SHOWCASES);
  });

  it("limpia datos inválidos, duplicados y límites", () => {
    const c = parseProfileCustom({
      background: { url: "https://img.example/bg.gif", blur: 99, dim: -5 },
      showcases: [
        { type: "favorites" },
        { type: "favorites" },
        { type: "nope" },
        { type: "text", title: "x".repeat(200), body: "hola" },
        { type: "badges", ids: ["critic", "BAD ID!", "night-owl", 3] },
        { type: "stats" },
        { type: "genres" },
        { type: "watching" },
        { type: "characters" },
      ],
    });
    expect(c.background).toEqual({ url: "https://img.example/bg.gif", blur: 20, dim: 0 });
    expect(c.showcases.map((s) => s.type)).toEqual(["favorites", "text", "badges", "stats", "genres", "watching"]);
    const text = c.showcases[1] as { title: string };
    expect(text.title.length).toBe(60);
    expect((c.showcases[2] as { ids: string[] }).ids).toEqual(["critic", "night-owl"]);
  });

  it("rechaza fondos que no son https", () => {
    expect(parseProfileCustom({ background: { url: "javascript:alert(1)" } }).background).toBeNull();
    expect(safeImageUrl("data:image/png;base64,xx")).toBeNull();
    expect(safeImageUrl("http://insecure.example/a.png")).toBeNull();
  });
});

describe("nivel", () => {
  it("sube con la actividad y la barra de progreso va de 0 a 1", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(xpForLevel(2)).toBe(250);
    const xp = experience({ episodes: 300, completed: 20, achievements: 5, favorites: 10 });
    const l = levelFromXp(xp);
    expect(l.level).toBeGreaterThan(5);
    expect(l.progress).toBeGreaterThanOrEqual(0);
    expect(l.progress).toBeLessThan(1);
    expect(levelFromXp(xpForLevel(10)).level).toBe(10);
  });
});
