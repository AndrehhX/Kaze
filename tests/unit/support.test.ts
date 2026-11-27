import { describe, expect, it } from "vitest";
import { activeTier, computeStatus, parseEquipped, tierFromAmount, tierFromName, usernameFromMessage, validateEquip, visibleCosmetics } from "@/lib/support/tiers";

const DAY = 86_400_000;
const NOW = Date.parse("2026-12-10T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe("Apoya KAZE: niveles", () => {
  it("nivel por importe y por nombre de membresía", () => {
    expect(tierFromAmount(1)).toBe(0);
    expect(tierFromAmount(2)).toBe(1);
    expect(tierFromAmount(4)).toBe(2);
    expect(tierFromAmount(10)).toBe(3);
    expect(tierFromName("Viento 🌀")).toBe(2);
    expect(tierFromName("TORMENTA")).toBe(3);
    expect(tierFromName("Otra cosa")).toBe(0);
  });

  it("membresía activa: dura 33 días desde el último cobro", () => {
    const s = computeStatus([{ tier: 2, amount: 4, is_subscription: true, received_at: ago(10) }], null, NOW);
    expect(s?.tier).toBe(2);
    expect(Date.parse(s!.expires_at)).toBe(NOW - 10 * DAY + 33 * DAY);
  });

  it("el nivel más alto que sigue abierto manda", () => {
    const s = computeStatus(
      [
        { tier: 1, amount: 2, is_subscription: true, received_at: ago(2) },
        { tier: 3, amount: 8, is_subscription: false, received_at: ago(5) },
      ],
      null,
      NOW,
    );
    expect(s?.tier).toBe(3);
  });

  it("si vence, guarda el último nivel con su fecha (los cosméticos se ocultan, no se pierden)", () => {
    const s = computeStatus([{ tier: 2, amount: 4, is_subscription: true, received_at: ago(60) }], null, NOW);
    expect(s?.tier).toBe(2);
    expect(activeTier({ tier: s!.tier, expires_at: s!.expires_at, founder: false }, NOW)).toBe(0);
  });

  it("menos de 2 US$ no da nivel", () => {
    expect(computeStatus([{ tier: null, amount: 1, is_subscription: false, received_at: ago(1) }], null, NOW)).toBeNull();
  });

  it("regalo manual", () => {
    const s = computeStatus([], { tier: 3, until: new Date(NOW + 5 * DAY).toISOString() }, NOW);
    expect(s?.tier).toBe(3);
  });

  it("@usuario en el mensaje de Ko-fi", () => {
    expect(usernameFromMessage("¡Ánimo! @kirito_kun")).toBe("kirito_kun");
    expect(usernameFromMessage("sin usuario")).toBeNull();
    expect(usernameFromMessage(null)).toBeNull();
  });
});

describe("Apoya KAZE: cosméticos", () => {
  it("ignora cosméticos que no existen", () => {
    expect(parseEquipped({ nameColor: "sakura", avatarFrame: "inventado", x: 1 })).toEqual({ nameColor: "sakura" });
    expect(parseEquipped("basura")).toEqual({});
  });

  it("el servidor rechaza cosméticos de un nivel superior", () => {
    expect(validateEquip({ nameColor: "menta" }, 1)).toBeNull();
    expect(validateEquip({ avatarFrame: "kz-luna" }, 1)).toMatch(/Viento/);
    expect(validateEquip({ nameGradient: "aurora" }, 2)).toMatch(/Tormenta/);
  });

  it("solo se ve lo que el nivel activo permite, y nada si venció", () => {
    const equipped = { nameColor: "menta", nameGradient: "aurora", avatarFrame: "kz-luna" };
    const future = new Date(NOW + DAY).toISOString();
    expect(visibleCosmetics({ tier: 2, expires_at: future, founder: false, equipped }, NOW)).toEqual({ nameColor: "menta", avatarFrame: "kz-luna" });
    expect(visibleCosmetics({ tier: 3, expires_at: future, founder: false, equipped }, NOW)).toEqual({ nameGradient: "aurora", avatarFrame: "kz-luna" });
    expect(visibleCosmetics({ tier: 3, expires_at: ago(1), founder: true, equipped }, NOW)).toEqual({});
  });
});
