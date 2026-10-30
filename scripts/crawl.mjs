import { chromium } from "@playwright/test";
const base = process.argv[2] || "http://localhost:3000";
const paths = ["/", "/discover", "/discover/moods", "/discover/roulette", "/discover/similar", "/seasonal", "/anime/21", "/anime/154587/episodes", "/watch/open-cinema/1", "/watch/21/1", "/library", "/library/collections", "/community", "/community/reviews", "/community/discussions", "/community/moderation", "/friends", "/friends/requests", "/watch-parties", "/profile", "/profile/guest", "/profile/guest/stats", "/profile/guest/lists", "/settings", "/settings/appearance", "/settings/account", "/settings/privacy", "/settings/integrations", "/login", "/register"];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
let total = 0;
for (const path of paths) {
  const p = await ctx.newPage();
  const errs = new Set();
  p.on("console", (m) => { if (m.type() === "error") errs.add("console: " + m.text().split("\n")[0].slice(0, 200)); });
  p.on("pageerror", (e) => errs.add("pageerror: " + e.message.split("\n")[0].slice(0, 200)));
  // ERR_ABORTED is React Strict Mode (dev) cancelling the first fetch; real failures differ.
  p.on("requestfailed", (r) => { if (!/_rsc|favicon|\.hot-update/.test(r.url()) && r.failure()?.errorText !== "net::ERR_ABORTED") errs.add("reqfailed: " + r.url().slice(0, 120) + " " + r.failure()?.errorText); });
  p.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.add(`http ${r.status()}: ${r.url().slice(0, 120)}`); });
  await p.goto(base + path, { waitUntil: "domcontentloaded" }).catch((e) => errs.add("goto: " + e.message.slice(0, 100)));
  await p.waitForTimeout(4000);
  if (errs.size) { total += errs.size; console.log("✗", path); errs.forEach((e) => console.log("   ", e)); } else console.log("✓", path);
  await p.close();
}
console.log("TOTAL issues:", total);
await b.close();
