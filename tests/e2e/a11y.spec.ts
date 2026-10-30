import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/discover", "/anime/154587", "/watch/open-cinema/1", "/library", "/seasonal", "/settings/appearance", "/login", "/profile/guest/stats"];
const THEMES = ["midnight", "sakura", "cyber", "zen"];

async function audit(page: import("@playwright/test").Page) {
  // Wait for client stores so interactive controls are in their final state.
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target.join(" ")}`);
}

for (const path of PAGES) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    expect(await audit(page)).toEqual([]);
  });
}

for (const theme of THEMES) {
  test(`a11y contrast: home in ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("kaze:theme", t), theme);
    await page.goto("/");
    expect(await audit(page)).toEqual([]);
  });
}
