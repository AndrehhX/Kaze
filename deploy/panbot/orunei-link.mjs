// Cuenta de Orunei ↔ Discord.
//   /orunei vincular <usuario>   te da un código para pegar en tu bio de Orunei (así se comprueba que la cuenta es tuya)
//   /orunei confirmar            comprueba el código y vincula. Luego puedes borrarlo de la bio.
//   /orunei desvincular
//   /orunei perfil [usuario]     episodios vistos, rango y lo que está viendo
//   /orunei viendo <sí|no>       (opcional) avisar en #watch-party cuando empiezas a ver algo, con botón para unirse
//   /wrapped [mes]               tu tarjeta del mes: anime en Orunei + actividad en el server
// Además: roles automáticos por episodios vistos (cada hora) y el Wrapped del mes anterior por DM el día 1.
// Solo lee de Supabase (con la clave de servicio del .env); nunca escribe en la base de datos.
// Datos en orunei-links.json (junto a este archivo).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, MessageFlags, SlashCommandBuilder } from "discord.js";
import { animeById, titleOf, SITE } from "./kaze-features.mjs";
import { monthKey, monthStats } from "./levels.mjs";
import { wrappedCard } from "./cards.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, "orunei-links.json");
const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TZ = process.env.KAZE_TZ || "America/Mexico_City";
const CH_WATCHING = process.env.CHANNEL_WATCHPARTY_ID || "1573415254350762026";
const WRAPPED_HOUR = Number(process.env.WRAPPED_HOUR ?? 12);
const CODE_TTL_MS = 30 * 60_000;
const WATCH_REPEAT_MS = 3 * 3600_000; // mismo anime, como mucho un aviso cada 3 h
const ROLE_LINKED = "🔗 Orunei";
const TIERS = [
  { min: 500, name: "🏆 Leyenda · 500+ eps" },
  { min: 100, name: "🍿 Otaku · 100+ eps" },
  { min: 10, name: "📺 Espectador · 10+ eps" },
];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const EPH = MessageFlags.Ephemeral;
const log = (...a) => console.log("[orunei]", ...a);

let data = { links: {}, pending: {}, announced: {}, lastWrapped: null };
try {
  data = { ...data, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
} catch {}
function save() {
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(data, null, 1));
  fs.renameSync(`${FILE}.tmp`, FILE);
}

// ── Supabase (solo lectura) ─────────────────────────────────────────
async function sb(query, { count = false } = {}) {
  if (!SB_URL || !SB_KEY) throw new Error("faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${SB_URL}/rest/v1/${query}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, ...(count ? { Prefer: "count=exact", Range: "0-0" } : {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 120)}`);
  if (count) return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
  return res.json();
}
const enc = encodeURIComponent;
const PROFILE_COLS = "id,username,display_name,bio,avatar_url,show_watch_history,is_banned";
async function profileByUsername(u) {
  const safe = u.trim().replace(/^@/, "").replace(/[%_*,()]/g, "");
  if (!safe) return null;
  return (await sb(`profiles?select=${PROFILE_COLS}&username=ilike.${enc(safe)}&limit=1`))[0] ?? null;
}
const profileById = async (id) => (await sb(`profiles?select=${PROFILE_COLS}&id=eq.${id}&limit=1`))[0] ?? null;
const episodesSeen = (pid) => sb(`watch_progress?select=series_id&user_id=eq.${pid}&completed=eq.true`, { count: true });

// ── Fechas del mes en la zona horaria del server ─────────────────────
function tzOffsetMs(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(date.getTime() / 1000) * 1000;
}
/** Inicio y fin (UTC) del mes local "YYYY-MM". */
function monthRange(mo) {
  const [y, m] = mo.split("-").map(Number);
  const startGuess = Date.UTC(y, m - 1, 1), endGuess = Date.UTC(y, m, 1);
  return { from: new Date(startGuess - tzOffsetMs(new Date(startGuess))), to: new Date(endGuess - tzOffsetMs(new Date(endGuess))) };
}
const prevMonth = (mo) => {
  const [y, m] = mo.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const monthLabel = (mo) => {
  const [y, m] = mo.split("-").map(Number);
  return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} ${y}`;
};

/** Estadísticas de Orunei del mes: episodios terminados, horas, series, días y lo más visto. */
async function orunieMonth(pid, mo) {
  const { from, to } = monthRange(mo);
  const rows = await sb(`watch_progress?select=series_id,episode_id,completed,position_seconds,duration_seconds,updated_at&user_id=eq.${pid}&updated_at=gte.${enc(from.toISOString())}&updated_at=lt.${enc(to.toISOString())}&limit=5000`);
  let seconds = 0, episodes = 0;
  const bySeries = new Map(), days = new Set();
  for (const r of rows) {
    seconds += r.completed ? r.duration_seconds || 0 : r.position_seconds || 0;
    if (r.completed) {
      episodes++;
      bySeries.set(r.series_id, (bySeries.get(r.series_id) ?? 0) + 1);
    }
    days.add(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(r.updated_at)));
  }
  const top = [];
  for (const [sid, eps] of [...bySeries].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    const m = /^\d+$/.test(sid) ? await animeById(Number(sid)).catch(() => null) : null;
    top.push({ title: m ? titleOf(m) : `Anime ${sid}`, cover: m?.coverImage?.large, eps });
  }
  return { episodes, hours: seconds / 3600, series: new Set(rows.map((r) => r.series_id)).size, days: days.size, top };
}

async function wrappedFor(member, link, mo) {
  const o = await orunieMonth(link.profileId, mo);
  const d = monthStats(member.id, mo);
  const png = await wrappedCard({
    name: member.displayName || member.user.username,
    avatarUrl: member.displayAvatarURL({ extension: "png", size: 256 }),
    monthLabel: monthLabel(mo),
    ...o,
    msgs: d.msgs,
    voiceMin: d.voice,
    xp: d.xp,
  });
  return { png, o };
}

// ── Roles ───────────────────────────────────────────────────────────
const roleByName = (guild, name) => guild.roles.cache.find((r) => r.name === name);
async function syncRoles(member, link) {
  const guild = member.guild;
  const linked = roleByName(guild, ROLE_LINKED);
  const want = new Set();
  if (link) {
    if (linked) want.add(linked.id);
    const eps = await episodesSeen(link.profileId).catch(() => null);
    if (eps == null) return; // si Supabase falla, no se toca nada
    const tier = TIERS.find((t) => eps >= t.min);
    const r = tier && roleByName(guild, tier.name);
    if (r) want.add(r.id);
  }
  const managed = [linked, ...TIERS.map((t) => roleByName(guild, t.name))].filter(Boolean);
  for (const r of managed) {
    const has = member.roles.cache.has(r.id);
    if (want.has(r.id) && !has) await member.roles.add(r, "Cuenta de Orunei").catch((e) => log("rol:", e.message));
    if (!want.has(r.id) && has) await member.roles.remove(r, "Cuenta de Orunei").catch((e) => log("rol:", e.message));
  }
}

// ── Comandos ────────────────────────────────────────────────────────
export const ORUNEI_COMMANDS = [
  new SlashCommandBuilder()
    .setName("orunei")
    .setDescription("Tu cuenta de Orunei en el server")
    .addSubcommand((s) => s.setName("vincular").setDescription("Conecta tu cuenta de Orunei").addStringOption((o) => o.setName("usuario").setDescription("Tu nombre de usuario en orunei.sbs").setRequired(true)))
    .addSubcommand((s) => s.setName("confirmar").setDescription("Comprueba el código de tu bio y termina de vincular"))
    .addSubcommand((s) => s.setName("desvincular").setDescription("Desconecta tu cuenta de Orunei"))
    .addSubcommand((s) => s.setName("perfil").setDescription("Lo que alguien ve en Orunei").addUserOption((o) => o.setName("usuario").setDescription("De quién (por defecto, tú)")))
    .addSubcommand((s) =>
      s.setName("viendo").setDescription("Avisar en #watch-party cuando empiezas a ver algo").addBooleanOption((o) => o.setName("activar").setDescription("Sí o no").setRequired(true)),
    ),
  new SlashCommandBuilder()
    .setName("wrapped")
    .setDescription("Tu resumen del mes: anime en Orunei y actividad en el server")
    .addStringOption((o) => o.setName("mes").setDescription("Qué mes").addChoices({ name: "Este mes", value: "este" }, { name: "El mes pasado", value: "pasado" })),
].map((c) => c.toJSON());

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => `PAN-${Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("")}`;
const linkedTo = (pid) => Object.entries(data.links).find(([, l]) => l.profileId === pid)?.[0];
const profileUrl = (u) => `${SITE}/profile/${encodeURIComponent(u)}`;

async function onInteraction(i) {
  if (!i.isChatInputCommand() || (i.commandName !== "orunei" && i.commandName !== "wrapped")) return;
  try {
    if (i.commandName === "wrapped") {
      const link = data.links[i.user.id];
      if (!link) return i.reply({ content: "Primero conecta tu cuenta de Orunei con `/orunei vincular` 🧈", flags: EPH });
      await i.deferReply();
      const mo = i.options.getString("mes") === "pasado" ? prevMonth(monthKey()) : monthKey();
      const { png } = await wrappedFor(i.member, link, mo);
      return i.editReply({ files: [new AttachmentBuilder(png, { name: "wrapped.png" })] });
    }
    const sub = i.options.getSubcommand();

    if (sub === "vincular") {
      if (data.links[i.user.id]) return i.reply({ content: `Ya estás vinculado como **${data.links[i.user.id].username}**. Usa \`/orunei desvincular\` si quieres cambiarla.`, flags: EPH });
      await i.deferReply({ flags: EPH });
      const p = await profileByUsername(i.options.getString("usuario", true));
      if (!p) return i.editReply("No encontré ese usuario en Orunei. Es el nombre que sale en tu perfil (orunei.sbs/profile/**tu-usuario**).");
      if (p.is_banned) return i.editReply("Esa cuenta no se puede vincular.");
      const other = linkedTo(p.id);
      if (other && other !== i.user.id) return i.editReply("Esa cuenta de Orunei ya está vinculada a otra persona del server. Si es tuya, abre un ticket.");
      const code = newCode();
      data.pending[i.user.id] = { profileId: p.id, username: p.username, code, exp: Date.now() + CODE_TTL_MS };
      save();
      return i.editReply({
        content: [
          `Para comprobar que **${p.username}** es tu cuenta:`,
          `**1.** Abre tu perfil en Orunei y pega este código en tu **bio**: \`${code}\``,
          "**2.** Guarda los cambios.",
          "**3.** Vuelve aquí y usa `/orunei confirmar`.",
          "Después ya puedes borrar el código de tu bio. Tienes 30 minutos.",
        ].join("\n"),
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Editar mi perfil").setEmoji("✏️").setURL(`${SITE}/settings/profile`))],
      });
    }

    if (sub === "confirmar") {
      const pend = data.pending[i.user.id];
      if (!pend || pend.exp < Date.now()) return i.reply({ content: "No tienes un código pendiente (o caducó). Empieza con `/orunei vincular`.", flags: EPH });
      await i.deferReply({ flags: EPH });
      const p = await profileById(pend.profileId);
      if (!p?.bio?.toUpperCase().includes(pend.code)) return i.editReply(`Todavía no veo \`${pend.code}\` en la bio de **${pend.username}**. Guárdala en Orunei y vuelve a intentarlo.`);
      const other = linkedTo(p.id);
      if (other && other !== i.user.id) return i.editReply("Esa cuenta ya la vinculó otra persona mientras tanto. Abre un ticket si es tuya.");
      data.links[i.user.id] = { profileId: p.id, username: p.username, linkedAt: Date.now(), watching: false };
      delete data.pending[i.user.id];
      save();
      await syncRoles(i.member, data.links[i.user.id]).catch(() => {});
      const eps = await episodesSeen(p.id).catch(() => 0);
      log(`vinculado ${i.user.username} ↔ ${p.username}`);
      return i.editReply(
        `✅ ¡Listo! Tu Discord está conectado con **${p.username}** (${eps} episodios vistos). Ya puedes borrar el código de tu bio.\n` +
          "• `/wrapped` para tu tarjeta del mes\n• `/orunei viendo activar:sí` si quieres que avise cuando empiezas a ver algo\n• Los roles por episodios se ponen solos.",
      );
    }

    if (sub === "desvincular") {
      if (!data.links[i.user.id]) return i.reply({ content: "No tenías ninguna cuenta vinculada.", flags: EPH });
      delete data.links[i.user.id];
      save();
      await syncRoles(i.member, null).catch(() => {});
      return i.reply({ content: "Listo, desconecté tu cuenta de Orunei y te quité sus roles.", flags: EPH });
    }

    if (sub === "viendo") {
      const link = data.links[i.user.id];
      if (!link) return i.reply({ content: "Primero conecta tu cuenta con `/orunei vincular`.", flags: EPH });
      link.watching = i.options.getBoolean("activar", true);
      save();
      return i.reply({
        content: link.watching
          ? `🍿 Hecho: cuando empieces a ver algo en Orunei lo diré en <#${CH_WATCHING}> con un botón para que otros se unan. Si en Orunei tienes oculto tu historial, no se avisa.`
          : "Hecho, ya no aviso de lo que ves.",
        flags: EPH,
      });
    }

    if (sub === "perfil") {
      const user = i.options.getUser("usuario") ?? i.user;
      const link = data.links[user.id];
      if (!link) return i.reply({ content: user.id === i.user.id ? "No has vinculado tu cuenta. Usa `/orunei vincular`." : "Esa persona no ha vinculado su cuenta de Orunei.", flags: EPH });
      await i.deferReply();
      const p = await profileById(link.profileId);
      if (!p) return i.editReply("Esa cuenta de Orunei ya no existe.");
      const eps = await episodesSeen(p.id);
      const tier = TIERS.find((t) => eps >= t.min);
      const e = new EmbedBuilder()
        .setColor(0xa855f7)
        .setAuthor({ name: "Perfil de Orunei" })
        .setTitle(p.display_name || p.username)
        .setURL(profileUrl(p.username))
        .setThumbnail(p.avatar_url || user.displayAvatarURL())
        .addFields({ name: "Episodios vistos", value: String(eps), inline: true }, { name: "Rango", value: tier?.name ?? "Aún sin rango (10 eps)", inline: true });
      if (p.show_watch_history !== false) {
        const last = (await sb(`watch_progress?select=series_id,episode_id,updated_at&user_id=eq.${p.id}&order=updated_at.desc&limit=1`))[0];
        if (last) {
          const m = /^\d+$/.test(last.series_id) ? await animeById(Number(last.series_id)).catch(() => null) : null;
          e.addFields({ name: "Último que vio", value: `${m ? `[${titleOf(m)}](${SITE}/anime/${m.id})` : "Anime"} · ep. ${last.episode_id} · <t:${Math.floor(Date.parse(last.updated_at) / 1000)}:R>` });
        }
      }
      return i.editReply({ embeds: [e], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Ver perfil en Orunei").setURL(profileUrl(p.username)))] });
    }
  } catch (err) {
    log("error:", err.message);
    const msg = "Orunei no responde ahora mismo. Prueba en un minuto.";
    return (i.deferred || i.replied ? i.editReply(msg) : i.reply({ content: msg, flags: EPH })).catch(() => {});
  }
}

// ── Tareas automáticas ──────────────────────────────────────────────
async function watchingNow(client, guildId) {
  const users = Object.entries(data.links).filter(([, l]) => l.watching);
  if (!users.length) return;
  const since = new Date(Date.now() - 4 * 60_000).toISOString();
  const ids = users.map(([, l]) => l.profileId).join(",");
  const rows = await sb(`watch_progress?select=user_id,series_id,episode_id,updated_at,completed&user_id=in.(${ids})&updated_at=gte.${enc(since)}&order=updated_at.desc&limit=100`);
  const guild = client.guilds.cache.get(guildId);
  const ch = await client.channels.fetch(CH_WATCHING).catch(() => null);
  if (!guild || !ch?.isTextBased()) return;
  const seen = new Set();
  for (const r of rows) {
    if (r.completed || seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    const [did] = users.find(([, l]) => l.profileId === r.user_id) ?? [];
    const key = `${did}:${r.series_id}`;
    if (!did || Date.now() - (data.announced[key] ?? 0) < WATCH_REPEAT_MS) continue;
    const p = await profileById(r.user_id).catch(() => null);
    if (p?.show_watch_history === false) continue; // respeta la privacidad de la web
    const member = guild.members.cache.get(did);
    if (!member) continue;
    data.announced[key] = Date.now();
    const m = /^\d+$/.test(r.series_id) ? await animeById(Number(r.series_id)).catch(() => null) : null;
    const e = new EmbedBuilder()
      .setColor(0xf43f5e)
      .setAuthor({ name: `${member.displayName} está viendo`, iconURL: member.displayAvatarURL() })
      .setTitle(`${m ? titleOf(m) : "Anime"} · episodio ${r.episode_id}`)
      .setURL(`${SITE}/watch/${r.series_id}/${r.episode_id}`)
      .setThumbnail(m?.coverImage?.large || null)
      .setFooter({ text: "¿Lo ven juntos? Abran una sala de cine en Orunei 🍿" });
    await ch.send({
      embeds: [e],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Ver ese episodio").setEmoji("▶️").setURL(`${SITE}/watch/${r.series_id}/${r.episode_id}`))],
      allowedMentions: { parse: [] },
    });
  }
  for (const [k, t] of Object.entries(data.announced)) if (Date.now() - t > 24 * 3600_000) delete data.announced[k];
  save();
}

async function monthlyWrapped(client, guildId) {
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
  const mo = prevMonth(monthKey());
  if (!day.endsWith("-01") || hour < WRAPPED_HOUR || data.lastWrapped === mo) return;
  data.lastWrapped = mo;
  save();
  const guild = client.guilds.cache.get(guildId);
  let sent = 0;
  for (const [did, link] of Object.entries(data.links)) {
    const member = guild?.members.cache.get(did);
    if (!member) continue;
    try {
      const { png, o } = await wrappedFor(member, link, mo);
      if (!o.episodes && !monthStats(did, mo).msgs) continue; // mes vacío: no se manda nada
      await member.send({ content: `🎁 ¡Tu **Wrapped de ${monthLabel(mo).toLowerCase()}**! Compártelo en el server si quieres presumir 🧈`, files: [new AttachmentBuilder(png, { name: "wrapped.png" })] });
      sent++;
    } catch (e) {
      log("wrapped DM:", e.message);
    }
  }
  log(`wrapped ${mo} enviado a ${sent}`);
}

export function registerOrunei(client, { guildId }) {
  client.on(Events.InteractionCreate, (i) => onInteraction(i).catch((e) => log(e.message)));
  client.once(Events.ClientReady, () => {
    const every = (ms, name, fn, first = 30_000) => {
      const run = () => fn().catch((e) => log(`${name}:`, e.message));
      setTimeout(run, first);
      setInterval(run, ms);
    };
    every(3 * 60_000, "viendo", () => watchingNow(client, guildId));
    every(10 * 60_000, "wrapped", () => monthlyWrapped(client, guildId));
    every(3600_000, "roles", async () => {
      const guild = client.guilds.cache.get(guildId);
      for (const [did, link] of Object.entries(data.links)) {
        const m = guild?.members.cache.get(did);
        if (m) await syncRoles(m, link);
      }
      for (const [did, p] of Object.entries(data.pending)) if (p.exp < Date.now()) delete data.pending[did];
      save();
    }, 60_000);
  });
}
export const _test = { monthRange, prevMonth, monthLabel, orunieMonth, profileByUsername, episodesSeen };
