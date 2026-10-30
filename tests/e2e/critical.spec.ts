import { expect, test } from "@playwright/test";

test.describe("KAZE critical flows", () => {
  test("home renders real AniList data in a cinematic hero", async ({ page }) => {
    await page.goto("/");
    const hero = page.getByRole("region", { name: "Featured anime" });
    await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trending Now" })).toBeVisible();
    // Hero auto-rotation can be paused (WCAG 2.2.2).
    await hero.getByRole("button", { name: "Pause auto-rotation" }).click();
    await expect(hero.getByRole("button", { name: "Resume auto-rotation" })).toBeVisible();
  });

  test("theme persists across reloads without a flash of the default theme", async ({ page }) => {
    await page.goto("/settings/appearance");
    await page.getByRole("button", { name: /Zen Studio/ }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "zen");
    // Capture the attribute before any client JS runs on the next load.
    await page.addInitScript(() => {
      document.addEventListener("readystatechange", () => {
        if (document.readyState === "interactive") (window as unknown as { __firstTheme: string }).__firstTheme = document.documentElement.dataset.theme ?? "";
      });
    });
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __firstTheme: string }).__firstTheme)).toBe("zen");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "zen");
  });

  test("search with URL-persisted filters", async ({ page }) => {
    await page.goto("/discover?genres=Drama&sort=SCORE_DESC");
    await expect(page.getByRole("button", { name: "Remove filter Drama" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search anime", exact: true }).fill("frieren");
    await expect(page).toHaveURL(/q=frieren/);
    await expect(page.getByRole("link", { name: /Frieren/ }).first()).toBeVisible();
  });

  test("library operations persist on the device", async ({ page }) => {
    await page.goto("/anime/154587");
    await page.getByRole("button", { name: /^Add .* to your list$/ }).first().click();
    await page.getByRole("menuitem", { name: /Watching/ }).click();
    await page.getByRole("button", { name: "Mark next episode watched" }).click();
    await page.goto("/library?tab=CURRENT");
    await expect(page.getByText(/Frieren/).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(/1\/28 ep/).first()).toBeVisible();
  });

  test("demo player streams authorized HLS and saves progress", async ({ page }) => {
    await page.goto("/watch/open-cinema/1");
    const video = page.locator("video");
    await expect(video).toBeAttached();
    await page.waitForFunction(() => {
      const v = document.querySelector("video");
      return Boolean(v && v.readyState >= 2);
    }, null, { timeout: 45_000 });
    await page.evaluate(async () => {
      const v = document.querySelector("video")!;
      v.muted = true;
      await v.play().catch(() => {});
    });
    await page.waitForFunction(() => (document.querySelector("video")?.currentTime ?? 0) > 2, null, { timeout: 45_000 });
    await page.evaluate(() => document.querySelector("video")!.pause());
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("kaze:progress") ?? "{}"));
    expect(saved.state.items["open-cinema::1"].position).toBeGreaterThan(1);
    // Keyboard control on the focused player.
    await page.getByRole("region", { name: /Video player/ }).focus();
    await page.keyboard.press("k");
    await expect.poll(() => page.evaluate(() => document.querySelector("video")!.paused)).toBe(false);
  });

  test("AniList titles without a license are not streamed", async ({ page }) => {
    await page.goto("/watch/21/1");
    await expect(page.getByRole("heading", { name: /isn.t licensed for streaming on KAZE/ })).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("command palette is keyboard-first", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const input = page.getByRole("combobox");
    await expect(input).toBeFocused();
    await input.fill("roulette");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/discover\/roulette/);
  });

  test("account features explain when the backend is not configured", async ({ page }) => {
    test.skip(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), "Supabase is configured");
    await page.goto("/friends");
    await expect(page.getByText(/isn't configured on this deployment/)).toBeVisible();
  });

  test("mobile navigation and layout @mobile", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary mobile" });
    await expect(nav).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    // The pathname-aware bar replaces the static shell once it streams in.
    const universe = nav.getByRole("button", { name: "Universe" });
    await expect(universe).toBeVisible();
    await universe.click();
    await expect(page.getByRole("dialog", { name: "Your universe" })).toBeVisible();
  });
});
