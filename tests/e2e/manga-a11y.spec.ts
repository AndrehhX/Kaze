import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * WCAG 2.2 AA audit of the KAZE MANGA surfaces, in all four themes.
 * Scoped to <main> (and the reader overlay) so pre-existing shell findings (header menu, ad iframes) are tracked by a11y.spec.ts instead.
 */
const PAGES = ["/manga", "/manga/shelf", "/manga/random", "/manga/discover", "/manga/viento-de-papel", "/manga/continue/113415", "/manga/continue/171018", "/library/manga", "/manga/reading-stats"];
const THEMES = ["midnight", "sakura", "cyber", "zen"];

async function audit(page: import("@playwright/test").Page, scope = "#main") {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  const r = await new AxeBuilder({ page }).include(scope).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").exclude("iframe").analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target.join(" ")}`);
}

for (const path of PAGES) {
  test(`manga a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    expect(await audit(page)).toEqual([]);
  });
}

for (const theme of THEMES) {
  test(`manga a11y: vault and reader in ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("kaze:theme", t), theme);
    await page.goto("/manga/shelf");
    expect(await audit(page)).toEqual([]);
    await page.goto("/manga/read/viento-de-papel/vdp-c1");
    expect(await audit(page, ".km-reader")).toEqual([]);
  });
}
