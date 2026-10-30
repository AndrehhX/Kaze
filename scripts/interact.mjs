import { chromium } from "@playwright/test";
const b = await chromium.launch();
const errs = [];
async function run(name, viewport, fn) {
  const ctx = await b.newContext({ viewport });
  const p = await ctx.newPage();
  const bag = new Set();
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_ABORTED/.test(m.text())) bag.add(m.text().split("\n")[0].slice(0, 180)); });
  p.on("pageerror", (e) => bag.add("pageerror: " + e.message.slice(0, 180)));
  p.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) bag.add(`http ${r.status()} ${r.url().slice(0, 100)}`); });
  try { await fn(p); } catch (e) { bag.add("STEP FAILED: " + e.message.split("\n")[0].slice(0, 160)); }
  await p.waitForTimeout(1200);
  console.log(bag.size ? "✗" : "✓", name); bag.forEach((e) => console.log("    ", e));
  errs.push(...bag); await ctx.close();
}
const D = { width: 1280, height: 800 }, M = { width: 390, height: 844 };
await run("quick view + list menu", D, async (p) => {
  await p.goto("http://localhost:3000/discover"); 
  await p.getByRole("button", { name: /^Quick view/ }).first().waitFor({ timeout: 45000 });
  await p.getByRole("button", { name: /^Quick view/ }).first().click({ force: true });
  await p.getByRole("dialog").waitFor(); await p.waitForTimeout(1500);
  await p.getByRole("dialog").getByRole("button", { name: /^Add to list/ }).click();
  await p.getByRole("menuitem", { name: /Planning|Plan to Watch/ }).first().click();
});
await run("theme switch all", D, async (p) => {
  await p.goto("http://localhost:3000/");
  for (const t of ["Sakura Dream", "Cyber Pulse", "Zen Studio", "Midnight Neon"]) {
    await p.getByRole("button", { name: /^Theme:/ }).click();
    await p.getByRole("menuitem", { name: new RegExp(t) }).click();
    await p.waitForTimeout(1200);
  }
});
await run("palette search", D, async (p) => {
  await p.goto("http://localhost:3000/"); await p.waitForTimeout(2500);
  await p.keyboard.press("Control+k"); await p.getByRole("combobox").fill("frieren"); await p.waitForTimeout(2500);
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await p.waitForURL(/\/(anime|discover)/);
});
await run("moods + roulette", D, async (p) => {
  await p.goto("http://localhost:3000/discover/moods");
  await p.getByRole("button", { name: /Emotional/ }).click(); await p.getByRole("button", { name: /Relaxing/ }).click(); await p.waitForTimeout(3500);
  await p.goto("http://localhost:3000/discover/roulette"); await p.getByRole("button", { name: /^Spin/ }).click(); await p.waitForTimeout(7000);
});
await run("similarity graph", D, async (p) => { await p.goto("http://localhost:3000/discover/similar"); await p.waitForTimeout(4000); await p.locator("button[aria-label*='Recentre']").first().click(); await p.waitForTimeout(3000); });
await run("detail page sections", D, async (p) => {
  await p.goto("http://localhost:3000/anime/154587"); await p.waitForTimeout(2500);
  await p.locator("#characters button").first().click(); await p.waitForTimeout(2500);
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "Trailer" }).first().click(); await p.waitForTimeout(1500); await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "Share" }).click().catch(() => {});
  await p.goto("http://localhost:3000/anime/154587/episodes"); await p.waitForTimeout(2500);
});
await run("player menus + shortcuts", D, async (p) => {
  await p.goto("http://localhost:3000/watch/open-cinema/2"); await p.waitForFunction(() => document.querySelector("video")?.readyState >= 2, null, { timeout: 45000 });
  await p.getByRole("button", { name: "Settings" }).click(); await p.getByRole("menuitem", { name: /Speed/ }).click(); await p.getByRole("menuitemradio", { name: "1.5×" }).click();
  await p.keyboard.press("Escape"); const player = p.getByRole("region", { name: /Video player/ }); await player.focus();
  for (const k of ["k", "ArrowRight", "j", "m", "t", "c", "ArrowUp", "k"]) { await p.keyboard.press(k); await p.waitForTimeout(250); }
  await p.mouse.move(600, 400); await p.waitForTimeout(300);
  await p.getByRole("button", { name: /Next episode/ }).click(); await p.waitForURL(/open-cinema\/3/); await p.waitForTimeout(3500);
});
await run("library flows", D, async (p) => {
  await p.goto("http://localhost:3000/anime/21"); 
  await p.getByRole("button", { name: /^Add to list:/ }).first().click(); await p.getByRole("menuitem", { name: /Watching/ }).click();
  await p.goto("http://localhost:3000/library"); await p.waitForTimeout(1500);
  await p.getByRole("button", { name: "Select" }).click(); await p.waitForTimeout(500);
  await p.goto("http://localhost:3000/library/collections"); await p.getByRole("button", { name: "New collection" }).first().click();
  await p.getByLabel("Name").fill("Test"); await p.getByRole("button", { name: "Create" }).click(); await p.waitForURL(/collections\/.+/); await p.waitForTimeout(1500);
});
await run("discover filters + seasonal", D, async (p) => {
  await p.goto("http://localhost:3000/discover"); await p.getByRole("button", { name: "Action", exact: true }).first().click(); await p.waitForTimeout(3000);
  await p.getByRole("button", { name: /Save search/ }).click(); await p.getByRole("button", { name: /List view|^List$/ }).click().catch(() => {});
  await p.goto("http://localhost:3000/seasonal"); await p.waitForTimeout(3000); await p.getByLabel("Sort").selectOption("day"); await p.waitForTimeout(1500);
});
await run("mobile nav + sheet", M, async (p) => {
  await p.goto("http://localhost:3000/"); await p.waitForTimeout(3000);
  await p.getByRole("navigation", { name: "Primary mobile" }).getByRole("button", { name: "Universe" }).click(); await p.waitForTimeout(800); await p.keyboard.press("Escape");
  await p.getByRole("navigation", { name: "Primary mobile" }).getByRole("button", { name: "Search" }).click(); await p.waitForTimeout(800);
});
await run("auth pages + forms", D, async (p) => { await p.goto("http://localhost:3000/login"); await p.waitForTimeout(1500); await p.goto("http://localhost:3000/register"); await p.waitForTimeout(1500); await p.goto("http://localhost:3000/settings/integrations"); await p.waitForTimeout(1500); });
console.log("\nTOTAL:", errs.length); await b.close();
