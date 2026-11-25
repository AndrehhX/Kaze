// Calcula la XP inicial de cada miembro a partir del historial de mensajes del servidor,
// con la misma regla que el sistema en vivo (1 mensaje con XP por minuto, 20 XP de media).
// Solo lectura en Discord. Escribe levels.json conservando la XP mayor si ya existía.
// Uso (en la VPS, con el bot parado o antes de activar los niveles):
//   cd /opt/panbot && node levels-backfill.mjs [--dry]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(DIR, ".env"));
} catch {}
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD = process.env.GUILD_ID || "1425279597632815167";
const DRY = process.argv.includes("--dry");
const FILE = path.join(DIR, "levels.json");
if (!TOKEN) throw new Error("Falta DISCORD_TOKEN");

async function api(url) {
  for (;;) {
    const res = await fetch(`https://discord.com/api/v10${url}`, { headers: { Authorization: `Bot ${TOKEN}` } });
    if (res.status === 429) {
      const j = await res.json().catch(() => ({}));
      await new Promise((r) => setTimeout(r, Math.ceil((j.retry_after ?? 1) * 1000) + 100));
      continue;
    }
    if (res.status === 403 || res.status === 404) return null; // canal sin acceso
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  }
}

const channels = (await api(`/guilds/${GUILD}/channels`)).filter((c) => c.type === 0 || c.type === 5);
const stamps = new Map(); // autor → [ms]
let total = 0;
for (const ch of channels) {
  let before = null, n = 0;
  for (;;) {
    const page = await api(`/channels/${ch.id}/messages?limit=100${before ? `&before=${before}` : ""}`);
    if (!page?.length) break;
    for (const m of page) {
      if (m.author.bot || (m.type !== 0 && m.type !== 19)) continue; // solo mensajes normales y respuestas
      (stamps.get(m.author.id) ?? stamps.set(m.author.id, []).get(m.author.id)).push(Date.parse(m.timestamp));
      n++;
    }
    before = page[page.length - 1].id;
    if (page.length < 100) break;
  }
  total += n;
  if (n) console.log(`#${ch.name}: ${n} mensajes`);
}

let data = { users: {} };
try {
  data = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {}
data.users ??= {};
const result = [];
for (const [id, list] of stamps) {
  list.sort((a, b) => a - b);
  let last = -Infinity, counted = 0;
  for (const t of list) {
    if (t - last >= 60_000) {
      counted++;
      last = t;
    }
  }
  const xp = counted * 20;
  const u = (data.users[id] ??= { xp: 0, msgs: 0, voiceMin: 0, lastMsg: 0 });
  u.xp = Math.max(u.xp, xp);
  u.msgs = Math.max(u.msgs ?? 0, list.length);
  result.push([id, list.length, xp]);
}
result.sort((a, b) => b[2] - a[2]);
console.log(`\n${total} mensajes de ${stamps.size} personas. Top 10 (id · mensajes · XP):`);
for (const r of result.slice(0, 10)) console.log(" ", r.join(" · "));
if (DRY) console.log("\n--dry: no se escribió nada");
else {
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(data));
  fs.renameSync(`${FILE}.tmp`, FILE);
  console.log(`\nGuardado en ${FILE}`);
}
