import { expect, test, type Page } from "@playwright/test";

/**
 * KAZE MANGA end-to-end flows. Reader/library tests use the bundled KAZE Originals demo series (no network);
 * discovery and continuity tests use live AniList data like the rest of the KAZE e2e suite.
 */

const readerRegion = (page: Page) => page.getByRole("region", { name: /Viento de Papel, Cap\. 1/ });

test.describe("KAZE MANGA", () => {
  test("manga home shows real AniList data and is reachable from the main navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Manga" }).click();
    await expect(page).toHaveURL(/\/manga$/);
    const hero = page.getByRole("region", { name: "Manga destacado" });
    await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tendencias" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "KAZE Originals" })).toBeVisible();
  });

  test("explorer keeps filters in the URL and finds manga", async ({ page }) => {
    await page.goto("/manga/discover?country=KR&sort=SCORE_DESC");
    await expect(page.getByRole("button", { name: "Quitar filtro Manhwa (Corea)" })).toBeVisible();
    await page.getByRole("combobox", { name: "Buscar manga" }).fill("solo leveling");
    await expect(page).toHaveURL(/q=solo\+leveling|q=solo%20leveling/);
    await expect(page.getByRole("link", { name: /Solo Leveling|Na Honjaman Level Up/i }).first()).toBeVisible();
  });

  test("manga detail separates source, adaptation and spin-off relations", async ({ page }) => {
    await page.goto("/manga/101517");
    await expect(page.getByRole("heading", { level: 1, name: "Jujutsu Kaisen" })).toBeVisible();
    const anime = page.locator("#anime");
    await expect(anime.getByRole("link", { name: "Continuar la historia" }).first()).toBeVisible();
    await expect(page.locator("#related").getByText("Adaptación", { exact: false }).first()).toBeVisible();
    // AniList totals are shown, but no chapter list is fabricated from them.
    await expect(page.getByText("Catálogo de capítulos no disponible en KAZE")).toBeVisible();
  });

  test("the Vault is operable with the keyboard and has a list alternative", async ({ page }) => {
    await page.goto("/manga/shelf");
    await page.getByRole("tab", { name: /KAZE Originals/ }).click();
    const shelf = page.getByRole("listbox", { name: /KAZE Originals/ });
    await shelf.focus();
    await expect(shelf.getByRole("option", { selected: true })).toHaveAccessibleName(/Viento de Papel/);
    await page.keyboard.press("ArrowRight");
    await expect(shelf.getByRole("option", { selected: true })).toHaveAccessibleName(/Señal Nocturna/);
    await expect(page.getByRole("heading", { level: 3, name: "Señal Nocturna" })).toBeVisible();
    await page.getByRole("button", { name: "Vista de lista" }).click();
    await expect(page.getByRole("list", { name: "KAZE Originals" }).getByRole("link", { name: "Viento de Papel" })).toBeVisible();
  });

  test("random discovery lands on a title that satisfies the filters", async ({ page }) => {
    await page.goto("/manga/random");
    await page.getByText("Solo series completas").click();
    await page.getByRole("button", { name: "Girar la ruleta" }).click();
    await expect(page.getByText(/Sorteado entre \d+ títulos/)).toBeVisible({ timeout: 30_000 });
    const winnerLink = page.getByRole("link", { name: "Ver ficha" }).first();
    const href = await winnerLink.getAttribute("href");
    await winnerLink.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    // The winner's own page confirms the filter: AniList status "Finalizado".
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("article header").getByText(/· Finalizado/)).toBeVisible();
  });

  test("demo reader: RTL navigation, double-page spread, progress and resume", async ({ page }) => {
    await page.goto("/manga/viento-de-papel");
    await expect(page.getByText("KAZE Originals · obra de demostración")).toBeVisible();
    await page.getByRole("link", { name: "Empezar a leer" }).click();
    await expect(page).toHaveURL(/\/manga\/read\/viento-de-papel\/vdp-c1/);
    const reader = readerRegion(page);
    await expect(reader.getByRole("img", { name: /Página de título/ })).toBeVisible();
    await expect(reader.getByText(/Demo · KAZE Originals/)).toBeVisible();
    await expect(reader).toBeFocused();
    // Right-to-left: ← advances. On a wide screen pages 2–3 are paired; the first page stands alone.
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/page=2/);
    await expect(reader.getByRole("img", { name: /el señor Ito, el jefe de correos/ })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(reader.getByRole("img", { name: /Doble página/ })).toBeVisible();
    // Bookmark, then leave and come back: the reader resumes on the same page.
    await page.keyboard.press("b");
    await expect(page.getByText(/Marcador en la página/)).toBeVisible();
    await page.goto("/manga/viento-de-papel");
    await page.getByRole("link", { name: /Continuar · Cap\. 1/ }).click();
    await expect(readerRegion(page).getByRole("img", { name: /Doble página/ })).toBeVisible();
    await page.goto("/library/manga?tab=BOOKMARKS");
    await expect(page.getByText(/Cap\. 1 · página 6/)).toBeVisible();
  });

  test("finishing a chapter offers the next one and marks it read", async ({ page }) => {
    await page.goto("/manga/read/viento-de-papel/vdp-c2?page=5");
    await expect(page.getByRole("img", { name: /Fin de la demo/ })).toBeVisible();
    // The reader focuses itself once hydrated; keys pressed before that would go nowhere.
    await expect(page.getByRole("region", { name: /Viento de Papel, Cap\. 2/ })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("button", { name: /Volver a la última página/ })).toBeVisible();
    await page.goto("/manga/viento-de-papel/chapters");
    await expect(page.getByRole("link", { name: /Corriente ascendente/ }).getByText("Leído")).toBeVisible();
  });

  test("continue the story: verified mapping shows chapter, status and sources", async ({ page }) => {
    await page.goto("/manga/continue/113415");
    await expect(page.getByRole("heading", { level: 2, name: "Empieza en el capítulo 64" })).toBeVisible();
    await expect(page.getByText("Verificado", { exact: true })).toBeVisible();
    const sources = page.getByRole("button", { name: /Fuentes consultadas/ });
    // Retry until hydrated: a click that lands before hydration is a no-op.
    await expect(async () => {
      if ((await sources.getAttribute("aria-expanded")) !== "true") await sources.click();
      await expect(sources).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
    }).toPass();
    await expect(page.getByRole("link", { name: /Jujutsu Kaisen Season 1/i }).first()).toBeVisible();
  });

  test("continue the story: unknown mapping never fabricates a chapter", async ({ page }) => {
    await page.goto("/manga/continue/171018");
    await expect(page.getByRole("heading", { level: 2, name: "Capítulo de continuación aún no verificado." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar desde el capítulo 1" })).toBeVisible();
    await expect(page.getByText(/Empieza aquí/)).toHaveCount(0);
  });

  test("adding manga to the library persists on the device", async ({ page }) => {
    await page.goto("/manga/senal-nocturna");
    await page.getByRole("button", { name: /^Añadir a mi biblioteca: Señal Nocturna/ }).first().click();
    await page.getByRole("menuitem", { name: /Por leer/ }).click();
    await page.goto("/library/manga?tab=PLANNING");
    await expect(page.getByRole("link", { name: "Señal Nocturna" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: "Señal Nocturna" }).first()).toBeVisible();
  });

  test("webtoon reader works on a phone @mobile", async ({ page }) => {
    await page.goto("/manga/read/senal-nocturna/sn-e1");
    const reader = page.getByRole("region", { name: /Señal Nocturna/ });
    await expect(reader.getByRole("img", { name: /Tira 1/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
