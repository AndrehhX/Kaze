// Orden del servidor (se puede volver a ejecutar: lo que ya está hecho no se repite).
//   node server-setup.mjs          muestra lo que haría (no toca nada)
//   node server-setup.mjs --apply  lo aplica
//   --sin-verificados              no reparte el rol de verificado (hazlo con el bot nuevo ya desplegado: si no, llena #Logs)
// No borra canales, roles ni mensajes: los canales sin uso se mueven a la categoría "Archivo" (oculta).
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(DIR, ".env"));
} catch {}
const TOKEN = (process.env.DISCORD_TOKEN || "").replace(/^Bot /, "");
const G = "1425279597632815167";
const APPLY = process.argv.includes("--apply");

const CH = {
  rules: "1556896259846045766",
  anuncios: "1556892980915208263",
  niveles: "1573415019801223350",
  roles: "1573415025836826658",
  general: "1573861292119298209", // chat público (todos)
  og: "1425279598454640651", // chat de los OG (privado)
  ofertas: "1556526261013057576",
  nekotina: "1556526324690984991",
  comandos: "1556526366864707604",
  media: "1573427196515717191",
  animeChat: "1573415250626089011",
  watchParty: "1573415254350762026",
  manga: "1573415258452664420",
  bugs: "1573415266950324325",
  tickets: "1573415030857404446",
  logs: "1556527794018848838",
  catCommunity: "1425279598454640650",
  catVoice: "1556525705226092684",
};
const ROLE = {
  admin: "1507547715536556122",
  jockie: "1557292107775873027",
  pingsSep: "1573416797385003211",
  orunei: "1573416800014704661",
  watchParty: "1573416802812428378",
  verificado: "1573416793840554156",
};
const B = (n) => 1n << BigInt(n);
const PERM = {
  View: B(10), Send: B(11), History: B(16), React: B(6), Embed: B(14), Attach: B(15), ExtEmoji: B(18),
  Connect: B(20), Speak: B(21), UseVAD: B(25), PubThreads: B(35), PrivThreads: B(36), SendThreads: B(38), AppCmds: B(31),
};
const READ_ONLY = { allow: PERM.View | PERM.History | PERM.React, deny: PERM.Send | PERM.PubThreads | PERM.PrivThreads | PERM.SendThreads };

async function api(method, url, body, reason = "PanBot: orden del servidor") {
  for (;;) {
    const res = await fetch(`https://discord.com/api/v10${url}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, "content-type": "application/json", "X-Audit-Log-Reason": encodeURIComponent(reason) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      const j = await res.json().catch(() => ({}));
      await new Promise((r) => setTimeout(r, Math.ceil((j.retry_after ?? 1.5) * 1000) + 100));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.status === 204 ? null : res.json();
  }
}

let changes = 0;
async function step(label, fn) {
  changes++;
  console.log(`${APPLY ? "✔" : "→"} ${label}`);
  if (!APPLY) return null;
  try {
    return await fn();
  } catch (e) {
    console.log(`  ✖ ${e.message}`);
    return null;
  }
}
const snowflake = (i) => String(((BigInt(Date.now()) - 1420070400000n) << 22n) + BigInt(i));

const guild = await api("GET", `/guilds/${G}`);
const roles = await api("GET", `/guilds/${G}/roles`);
let channels = await api("GET", `/guilds/${G}/channels`);
// Los nombres usan letras "negrita" de Unicode (𝗔𝗿𝗰𝗵𝗶𝘃𝗼): NFKC las convierte en letras normales para buscarlas.
const byName = (re, type) => channels.find((c) => re.test(c.name.normalize("NFKC")) && (type == null || c.type === type));

// 1) Rol de ping "Ofertas Gratis" (el botón del panel apuntaba al rol interno del bot Game Deals)
let ofertasRole = roles.find((r) => !r.managed && /ofertas gratis/i.test(r.name));
if (!ofertasRole) {
  ofertasRole = await step('Crear rol "🎁 Ofertas Gratis" (ping de juegos gratis)', async () => {
    const r = await api("POST", `/guilds/${G}/roles`, { name: "🎁 Ofertas Gratis", color: 0x22c55e, mentionable: true, hoist: false, permissions: "0" });
    const sep = roles.find((x) => x.id === ROLE.pingsSep);
    await api("PATCH", `/guilds/${G}/roles`, [{ id: r.id, position: Math.max(1, sep.position - 1) }]);
    return r;
  });
}
console.log(`  rol Ofertas Gratis: ${ofertasRole?.id ?? "(se crea al aplicar)"}`);

// 2) Categoría Archivo (oculta) con los canales sin uso: Reporte-Bugs (ya lo cubren los tickets) y Nekotina (ese bot ya no está)
let archive = byName(/archivo/i, 4);
if (!archive) {
  archive = await step('Crear categoría "🗄️ Archivo" (solo Admin la ve)', () =>
    api("POST", `/guilds/${G}/channels`, {
      name: "一一 ✦ 𝗔𝗥𝗖𝗛𝗜𝗩𝗢 【保管】 ✦ 一一",
      type: 4,
      position: 99,
      permission_overwrites: [
        { id: G, type: 0, allow: "0", deny: String(PERM.View) },
        { id: ROLE.admin, type: 0, allow: String(PERM.View | PERM.History), deny: "0" },
      ],
    }),
  );
}
for (const id of [CH.bugs, CH.nekotina]) {
  const c = channels.find((x) => x.id === id);
  if (!c || (archive && c.parent_id === archive.id)) continue;
  await step(`Mover #${c.name} a Archivo (oculto, no se borra)`, () =>
    api("PATCH", `/channels/${id}`, { parent_id: archive.id, permission_overwrites: archive.permission_overwrites }),
  );
}

// 3) Canal #Destacados (⭐) en la zona de comunidad, solo lectura
let destacados = byName(/destacados/i, 0);
if (!destacados) {
  destacados = await step("Crear canal #Destacados (mensajes con ⭐, solo lectura)", () =>
    api("POST", `/guilds/${G}/channels`, {
      name: "◜☆⭐﹕𝗗𝗲𝘀𝘁𝗮𝗰𝗮𝗱𝗼𝘀",
      type: 0,
      parent_id: CH.catCommunity,
      topic: "⭐ Los mejores mensajes del server. Reacciona con ⭐ a un mensaje: con 3 estrellas llega aquí.",
      permission_overwrites: [{ id: G, type: 0, allow: String(READ_ONLY.allow), deny: String(READ_ONLY.deny) }],
    }),
  );
}
console.log(`  canal Destacados: ${destacados?.id ?? "(se crea al aplicar)"}`);

// 4) Canal de voz "➕ Crear sala" (salas de voz propias)
let hub = byName(/crear sala/i, 2);
if (!hub) {
  hub = await step('Crear canal de voz "➕ Crear sala"', () =>
    api("POST", `/guilds/${G}/channels`, { name: "➕ Crear sala", type: 2, parent_id: CH.catVoice, position: 0, user_limit: 1 }),
  );
}
console.log(`  canal Crear sala: ${hub?.id ?? "(se crea al aplicar)"}`);

// 5) Mensajes del sistema de Discord en el chat público (no en el de los OG) y sin el aviso de entrada (ya lo da PanBot)
const FLAGS = 1 | 4 | 8; // sin avisos de entrada, sin consejos de configuración, sin "saluda con un sticker"
if (guild.system_channel_id !== CH.general || guild.system_channel_flags !== FLAGS || guild.verification_level < 2) {
  await step("Canal del sistema → #Chat-General, sin avisos de entrada duplicados, verificación media (cuenta de 5+ min)", () =>
    api("PATCH", `/guilds/${G}`, { system_channel_id: CH.general, system_channel_flags: FLAGS, verification_level: Math.max(2, guild.verification_level) }),
  );
}

// 6) Pantalla de bienvenida de Discord
const ws = await api("GET", `/guilds/${G}/welcome-screen`).catch(() => null);
if (!ws?.welcome_channels?.length) {
  await step("Pantalla de bienvenida de Discord (5 canales recomendados)", () =>
    api("PATCH", `/guilds/${G}/welcome-screen`, {
      enabled: true,
      description: "Comunidad de anime y gaming de Orunei. Siéntete como en casa, panita 🧈",
      welcome_channels: [
        { channel_id: CH.rules, description: "Las normas del server", emoji_name: "📖" },
        { channel_id: CH.roles, description: "Elige tus avisos e intereses", emoji_name: "🔔" },
        { channel_id: CH.general, description: "Saluda y charla con todos", emoji_name: "💬" },
        { channel_id: CH.animeChat, description: "Anime de la temporada y estrenos", emoji_name: "📺" },
        { channel_id: CH.tickets, description: "Ayuda con Orunei o el server", emoji_name: "🎫" },
      ],
    }),
  );
}

// 7) Onboarding: los nuevos entran viendo canales públicos (antes el único canal por defecto era el de los OG, que no pueden ver)
const ob = await api("GET", `/guilds/${G}/onboarding`);
const DEFAULTS = [CH.rules, CH.anuncios, CH.general, CH.animeChat, CH.comandos, CH.ofertas, CH.media, CH.watchParty, CH.manga];
const prompt = ob.prompts?.[0];
const wanted = [
  { title: "Novedades de Orunei", description: "Nuevas funciones de la web y la app", emoji: "🚀", role: ROLE.orunei },
  { title: "Watch Party", description: "Aviso cuando abrimos salas de cine", emoji: "🎉", role: ROLE.watchParty },
  { title: "Juegos gratis", description: "Ofertas de Steam y Epic", emoji: "🎁", role: ofertasRole?.id },
];
// Se busca en todas las preguntas (los avisos viven en la segunda): solo se añade lo que no esté en ninguna.
const missing = prompt ? wanted.filter((w) => w.role && !(ob.prompts ?? []).some((q) => q.options.some((o) => o.role_ids.includes(w.role)))) : [];
const defaultsOk = DEFAULTS.every((id) => ob.default_channel_ids.includes(id)) && !ob.default_channel_ids.includes(CH.og);
if (!defaultsOk || missing.length) {
  await step(`Onboarding: canales por defecto públicos${missing.length ? ` y opciones nuevas (${missing.map((m) => m.title).join(", ")})` : ""}`, () =>
    api("PUT", `/guilds/${G}/onboarding`, {
      enabled: ob.enabled,
      mode: ob.mode,
      default_channel_ids: DEFAULTS,
      prompts: (ob.prompts ?? []).map((p, i) => ({
        ...p,
        options: [
          ...p.options.map((o) => ({ id: o.id, title: o.title, description: o.description, channel_ids: o.channel_ids, role_ids: o.role_ids, emoji_name: o.emoji?.name, emoji_id: o.emoji?.id })),
          ...(i === 0 ? missing.map((m, j) => ({ id: snowflake(j), title: m.title, description: m.description, emoji_name: m.emoji, role_ids: [m.role], channel_ids: [] })) : []),
        ],
      })),
    }),
  );
}

// 8) Jockie Music sin Administrador (solo lo que necesita un bot de música)
const jockie = roles.find((r) => r.id === ROLE.jockie);
const MUSIC = PERM.View | PERM.Send | PERM.Embed | PERM.Attach | PERM.History | PERM.React | PERM.ExtEmoji | PERM.Connect | PERM.Speak | PERM.UseVAD | PERM.AppCmds;
if (jockie && BigInt(jockie.permissions) !== MUSIC) {
  await step("Jockie Music: quitar Administrador y dejar solo permisos de música", () => api("PATCH", `/guilds/${G}/roles/${ROLE.jockie}`, { permissions: String(MUSIC) }));
}

// 9) AutoMod de Discord: estafas, invitaciones a otros servers y spam
const rules = await api("GET", `/guilds/${G}/auto-moderation/rules`);
const actions = (msg) => [
  { type: 1, metadata: { custom_message: msg } },
  { type: 2, metadata: { channel_id: CH.logs } },
];
const invites = await api("GET", `/guilds/${G}/invites`).catch(() => []);
const ownInvites = invites.map((i) => `*discord.gg/${i.code}*`).slice(0, 100);
const AUTOMOD = [
  {
    name: "PanBot · Anti-estafas",
    event_type: 1,
    trigger_type: 1,
    trigger_metadata: {
      keyword_filter: ["*free nitro*", "*nitro gratis*", "*nitro free*", "*discordnitro*", "*dlscord*", "*discorcl*", "*disc0rd*", "*steamcommunlty*", "*steamcomrnunity*", "*steamcommunity.ru*", "*gift-nitro*", "*nitro-gift*"],
    },
    actions: actions("Ese mensaje parece una estafa (Nitro o Steam falsos) y se bloqueó. Si es un error, abre un ticket."),
  },
  {
    name: "PanBot · Invitaciones",
    event_type: 1,
    trigger_type: 1,
    trigger_metadata: { regex_patterns: ["(discord\\.gg|discord(app)?\\.com/invite|dsc\\.gg)/[a-zA-Z0-9-]+"], allow_list: ownInvites },
    actions: actions("No se permiten invitaciones a otros servidores (norma 2)."),
  },
  { name: "PanBot · Spam", event_type: 1, trigger_type: 3, trigger_metadata: {}, actions: [{ type: 1, metadata: { custom_message: "Tu mensaje parece spam y se bloqueó." } }] },
];
for (const r of AUTOMOD) {
  if (rules.some((x) => x.name === r.name || (r.trigger_type === 3 && x.trigger_type === 3))) continue;
  await step(`AutoMod: ${r.name}`, () => api("POST", `/guilds/${G}/auto-moderation/rules`, { ...r, enabled: true, exempt_roles: [ROLE.admin] }));
}

// 9b) Roles de Orunei (orunei-link.mjs los busca por nombre): cuenta vinculada y rangos por episodios vistos
const ORUNEI_ROLES = [
  { name: "🏆 Leyenda · 500+ eps", color: 0xf59e0b },
  { name: "🍿 Otaku · 100+ eps", color: 0xf43f5e },
  { name: "📺 Espectador · 10+ eps", color: 0x8b5cf6 },
  { name: "🔗 Orunei", color: 0xa855f7 },
];
for (const r of ORUNEI_ROLES) {
  if (roles.some((x) => x.name === r.name)) continue;
  await step(`Crear rol "${r.name}"`, async () => {
    const made = await api("POST", `/guilds/${G}/roles`, { name: r.name, color: r.color, hoist: false, mentionable: false, permissions: "0" });
    const sep = roles.find((x) => x.id === ROLE.pingsSep); // justo encima de la sección de pings
    await api("PATCH", `/guilds/${G}/roles`, [{ id: made.id, position: sep.position + 1 }]);
  });
}

// 10) Rol "Panita Verificado" para quien ya aceptó las reglas
const members = await api("GET", `/guilds/${G}/members?limit=1000`);
const toVerify = members.filter((m) => !m.user.bot && !m.pending && !m.roles.includes(ROLE.verificado));
if (toVerify.length && !process.argv.includes("--sin-verificados")) {
  await step(`Dar "🧈 Panita Verificado" a ${toVerify.length} miembros que ya aceptaron las reglas`, async () => {
    for (const m of toVerify) await api("PUT", `/guilds/${G}/members/${m.user.id}/roles/${ROLE.verificado}`, null, "PanBot: ya aceptó las reglas");
  });
}

console.log(changes ? (APPLY ? `\n${changes} cambios aplicados.` : `\n${changes} cambios por aplicar. Ejecuta con --apply.`) : "Todo estaba ya en orden.");
