// Nombres de canales y categorías con un estilo único: emoji + "・" + nombre en negrita Unicode, en español.
//   node channel-names.mjs          muestra los cambios (no toca nada)
//   node channel-names.mjs --apply  los aplica
// Se puede volver a ejecutar: solo renombra lo que no coincide. Los canales se identifican por ID.
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(DIR, ".env"));
} catch {}
const TOKEN = (process.env.DISCORD_TOKEN || "").replace(/^Bot /, "");
const G = "1425279597632815167";
const APPLY = process.argv.includes("--apply");

/** Letras y números a "negrita sans" de Unicode. Las tildes y la ñ se ponen como acentos combinados. */
export function bold(text) {
  const out = [];
  for (const ch of text.normalize("NFD")) {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) out.push(String.fromCodePoint(0x1d5d4 + c - 65));
    else if (c >= 97 && c <= 122) out.push(String.fromCodePoint(0x1d5ee + c - 97));
    else if (c >= 48 && c <= 57) out.push(String.fromCodePoint(0x1d7ec + c - 48));
    else out.push(ch);
  }
  return out.join("").normalize("NFC");
}
const ch = (emoji, name) => `${emoji}・${bold(name)}`;
const cat = (emoji, name, jp) => `${emoji} ${bold(name.toUpperCase())} 「${jp}」`;

// ID → nombre. El canal "server-hub" (directorio de Discord) no se toca.
const NAMES = {
  // Sin categoría
  "1556896259846045766": ch("📖", "reglas"),
  "1556525936256753674": ch("👋", "bienvenida"),
  "1573415016181403759": ch("💨", "despedida"),
  // Información
  "1556525476950974504": cat("📌", "información", "情報"),
  "1574956797662339184": ch("🚨", "caídas"),
  "1556892980915208263": ch("📢", "anuncios"),
  "1573415019801223350": ch("🔰", "niveles"),
  "1573415025836826658": ch("🔔", "roles"),
  "1573415038587240468": ch("🚀", "novedades-orunei"),
  // Comunidad
  "1425279598454640650": cat("💬", "comunidad", "交流"),
  "1573861292119298209": ch("💬", "chat-general"),
  "1425279598454640651": ch("🧈", "chat-og"),
  "1549615817484796035": ch("🌀", "ryunix"),
  "1556526261013057576": ch("🎁", "juegos-gratis"),
  "1556526366864707604": ch("🤖", "comandos"),
  "1573427196515717191": ch("📸", "memes-y-clips"),
  "1575032739063795743": ch("⭐", "destacados"),
  // Orunei
  "1556525614645645362": cat("🎬", "orunei", "アニメ"),
  "1573415250626089011": ch("📺", "anime"),
  "1573415254350762026": ch("🍿", "watch-party"),
  "1573415258452664420": ch("📚", "manga-y-manhwa"),
  "1573415030857404446": ch("🎫", "tickets"),
  "1575787292218368050": ch("💜", "apoyos"),
  "1575787294592606228": ch("⚡", "tormenta"),
  // Voz
  "1556525705226092684": cat("🔊", "voz", "ボイス"),
  "1575032739755720806": ch("➕", "crear sala"),
  "1556526436590948392": ch("🎮", "gaming"),
  "1573863357172158504": ch("🍿", "anime"),
  "1425279598454640654": ch("💣", "cs2"),
  "1528962197617643520": ch("⚽", "fulbito"),
  // AFK
  "1573415007578890370": cat("💤", "afk", "休憩"),
  "1573415508223598733": ch("💤", "afk"),
  // Staff
  "1556525816261906462": cat("🛡️", "staff", "管理"),
  "1556527678734082048": ch("🛡️", "staff"),
  "1556527794018848838": ch("📋", "logs"),
  "1556527880236830740": ch("⚙️", "config"),
  // Archivo
  "1556526324690984991": ch("🐈", "nekotina"),
  "1573415266950324325": ch("🐛", "reporte-bugs"),
};

async function api(method, url, body) {
  for (;;) {
    const res = await fetch(`https://discord.com/api/v10${url}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, "content-type": "application/json", "X-Audit-Log-Reason": encodeURIComponent("PanBot: estilo de nombres de canales") },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      const j = await res.json().catch(() => ({}));
      await new Promise((r) => setTimeout(r, Math.ceil((j.retry_after ?? 2) * 1000) + 200));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const channels = await api("GET", `/guilds/${G}/channels`);
  // La categoría Archivo se creó después: se busca por nombre.
  const archive = channels.find((c) => c.type === 4 && /archivo/i.test(c.name.normalize("NFKC")));
  if (archive) NAMES[archive.id] = cat("🗄️", "archivo", "保管");
  let n = 0;
  for (const [id, name] of Object.entries(NAMES)) {
    const c = channels.find((x) => x.id === id);
    if (!c) {
      console.log(`(no existe) ${name}`);
      continue;
    }
    if (c.name === name) continue;
    n++;
    console.log(`${APPLY ? "✔" : "→"} ${c.name}  ⟶  ${name}`);
    if (APPLY) {
      const r = await api("PATCH", `/channels/${id}`, { name }).catch((e) => ({ error: e.message }));
      if (r.error) console.log(`  ✖ ${r.error}`);
      else if (r.name !== name) console.log(`  ⚠ Discord lo guardó como: ${r.name}`);
    }
  }
  console.log(n ? (APPLY ? `\n${n} nombres cambiados.` : `\n${n} nombres por cambiar. Ejecuta con --apply.`) : "Todos los nombres ya están bien.");
}
