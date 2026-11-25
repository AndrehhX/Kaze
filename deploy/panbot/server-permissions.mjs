// Permisos de los canales del servidor (se puede volver a ejecutar: deja todo igual si ya está bien).
//   node server-permissions.mjs          muestra lo que cambiaría (no toca nada)
//   node server-permissions.mjs --apply  lo aplica
// Solo edita las reglas de los roles indicados en cada canal; no borra ninguna otra.
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(DIR, ".env"));
} catch {}
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD = "1425279597632815167";
const APPLY = process.argv.includes("--apply");

const B = {
  View: 1n << 10n, Send: 1n << 11n, React: 1n << 6n, History: 1n << 16n, Attach: 1n << 15n, Embed: 1n << 14n,
  PubThreads: 1n << 35n, PrivThreads: 1n << 36n, SendThreads: 1n << 38n, MentionAll: 1n << 17n,
};
const ROLE = { everyone: GUILD, coowner: "1573416756972757162", mod: "1573416759573356594", dev: "1573416767357984903" };

const READ_ONLY = { allow: B.View | B.History | B.React, deny: B.Send | B.PubThreads | B.PrivThreads | B.SendThreads };
const STAFF_WRITE = { allow: B.View | B.Send | B.History | B.Attach | B.Embed | B.React, deny: 0n };
const STAFF_READ = { allow: B.View | B.History, deny: B.Send };

// canal → { rol: regla }
const PLAN = [
  ["1556896259846045766", "Rules", { everyone: READ_ONLY }],
  ["1556525936256753674", "Bienvenida", { everyone: READ_ONLY }],
  ["1573415016181403759", "Despedida", { everyone: READ_ONLY }],
  ["1556525476950974504", "Categoría INFO / AVISOS", { everyone: READ_ONLY }],
  ["1574956797662339184", "caidas", { everyone: READ_ONLY }],
  ["1556892980915208263", "Anuncios", { everyone: READ_ONLY, coowner: STAFF_WRITE, mod: STAFF_WRITE }],
  ["1573415019801223350", "Niveles", { everyone: READ_ONLY }],
  ["1573415025836826658", "Roles", { everyone: READ_ONLY }],
  ["1573415038587240468", "Orunei-Updates", { everyone: READ_ONLY, coowner: STAFF_WRITE, dev: STAFF_WRITE }],
  ["1573415030857404446", "Tickets (panel)", { everyone: READ_ONLY }],
  ["1556527678734082048", "Staff", { coowner: STAFF_WRITE, mod: STAFF_WRITE }],
  ["1556527794018848838", "Logs", { coowner: STAFF_READ, mod: STAFF_READ }],
];

async function api(method, url, body) {
  for (;;) {
    const res = await fetch(`https://discord.com/api/v10${url}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, "content-type": "application/json", "X-Audit-Log-Reason": encodeURIComponent("PanBot: permisos de canales (solo lectura y zona staff)") },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? null : res.json();
  }
}

const names = (bits) => Object.entries(B).filter(([, v]) => bits & v).map(([k]) => k).join(",") || "-";
const channels = await api("GET", `/guilds/${GUILD}/channels`);
let changes = 0;
for (const [id, label, rules] of PLAN) {
  const ch = channels.find((c) => c.id === id);
  if (!ch) {
    console.log(`(no existe) ${label}`);
    continue;
  }
  for (const [roleKey, rule] of Object.entries(rules)) {
    const target = ROLE[roleKey];
    const cur = (ch.permission_overwrites || []).find((o) => o.id === target);
    const curAllow = BigInt(cur?.allow ?? 0), curDeny = BigInt(cur?.deny ?? 0);
    // Mezcla: conserva lo que ya había en esa regla y fuerza solo los permisos del plan
    const managed = rule.allow | rule.deny;
    const allow = (curAllow & ~managed) | rule.allow;
    const deny = (curDeny & ~managed) | rule.deny;
    if (allow === curAllow && deny === curDeny) continue;
    changes++;
    console.log(`${APPLY ? "✔" : "→"} ${label} · ${roleKey}: permitir [${names(allow)}] · denegar [${names(deny)}]`);
    if (APPLY) await api("PUT", `/channels/${id}/permissions/${target}`, { type: 0, allow: String(allow), deny: String(deny) });
  }
}
console.log(changes ? (APPLY ? `\n${changes} reglas aplicadas.` : `\n${changes} reglas por aplicar. Ejecuta con --apply.`) : "Todo estaba ya bien.");
