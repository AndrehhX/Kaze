// Estado de Orunei en #caidas: cada 2 minutos se revisa la web y el resolver de video desde fuera
// (pasando por Cloudflare). Con 2 fallos seguidos se avisa de la caída; al volver, se avisa con lo que duró.
// Como PanBot vive en la misma VPS, si se cae la VPS entera no puede avisar: eso lo cubre el monitor externo (deploy/monitor-worker).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Events } from "discord.js";
import { card, COLORS } from "./ui.mjs";

const TICKETS_URL = "https://discord.com/channels/1425279597632815167/1573415030857404446";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, "status.json");
const CHANNEL = process.env.CHANNEL_CAIDAS_ID || "1574956797662339184";
const FAILS_TO_ALERT = 2;
const SITE = (process.env.KAZE_URL || "https://www.orunei.sbs").replace(/\/$/, "");
const CHECKS = [
  { key: "web", label: "Web de Orunei", url: `${SITE}/robots.txt` },
  { key: "resolver", label: "Videos (resolver)", url: "https://resolver.orunei.sbs/health" },
];
const log = (...a) => console.log("[caidas]", ...a);

let st = {};
try {
  st = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {}
const save = () => fs.writeFileSync(FILE, JSON.stringify(st, null, 1));

async function probe(url) {
  try {
    // ?t= evita la copia en caché de Cloudflare
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { signal: AbortSignal.timeout(15_000), headers: { "cache-control": "no-cache", "user-agent": "PanBot-status" } });
    return res.ok ? null : `HTTP ${res.status}`;
  } catch (e) {
    return e.name === "TimeoutError" ? "no responde (15 s)" : e.message;
  }
}

const dur = (ms) => {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.max(1, m)} min`;
};

async function tick(client) {
  const ch = await client.channels.fetch(CHANNEL).catch(() => null);
  for (const c of CHECKS) {
    const s = (st[c.key] ??= { fails: 0, down: false, since: 0 });
    const err = await probe(c.url);
    if (err) {
      s.fails++;
      if (!s.down && s.fails >= FAILS_TO_ALERT) {
        s.down = true;
        s.since = Date.now();
        log(`${c.key} caído: ${err}`);
        const since = Math.floor(s.since / 1000);
        const msg = await ch
          ?.send(
            card({
              accent: COLORS.red,
              kicker: "🚨 Estado de Orunei",
              title: `🔴 ${c.label}: caído`,
              body: `Estamos en ello. Te avisamos aquí mismo en cuanto vuelva.\nDesde <t:${since}:t> (<t:${since}:R>).`,
              footer: `Detalle técnico: ${err}`,
              buttons: [{ label: "Reportar un problema", emoji: "🎫", url: TICKETS_URL }],
            }),
          )
          .catch((x) => log(x.message));
        if (msg?.crosspostable) await msg.crosspost().catch(() => {}); // #caidas es un canal de anuncios: se puede seguir desde otros servers
      }
    } else {
      if (s.down) {
        log(`${c.key} volvió`);
        const msg = await ch
          ?.send(
            card({
              accent: COLORS.green,
              kicker: "✅ Estado de Orunei",
              title: `🟢 ${c.label}: funcionando otra vez`,
              body: `Estuvo caído **${dur(Date.now() - s.since)}**. ¡Gracias por la paciencia! 🧈`,
              buttons: [{ label: "Abrir Orunei", emoji: "▶️", url: SITE }],
            }),
          )
          .catch((x) => log(x.message));
        if (msg?.crosspostable) await msg.crosspost().catch(() => {});
      }
      Object.assign(s, { fails: 0, down: false, since: 0 });
    }
  }
  save();
}

export function registerStatus(client) {
  client.once(Events.ClientReady, () => {
    const run = () => tick(client).catch((e) => log(e.message));
    setTimeout(run, 20_000);
    setInterval(run, 2 * 60_000);
  });
}
