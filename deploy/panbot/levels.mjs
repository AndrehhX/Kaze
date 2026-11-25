// Sistema de niveles de PanBot.
//   XP por escribir: 15–25 por mensaje, como mucho 1 vez por minuto (el spam no sube de nivel).
//   XP por llamada: 8 por minuto si hay al menos 2 personas, sin estar ensordecido y fuera del canal AFK.
//   Roles de rango automáticos: los roles del servidor cuyo nombre contiene "Nivel N+" (Bronce 5, Plata 15, Oro 30, Diamante 50).
//   /nivel [usuario]  tarjeta con nivel, puesto y progreso
//   /top              ranking del servidor
// Datos en levels.json (junto a este archivo). Se guardan cada 30 s y al apagar.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AttachmentBuilder, EmbedBuilder, Events, SlashCommandBuilder } from "discord.js";
import { rankCard } from "./cards.mjs";
import { levelUpGif } from "./pixel.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, "levels.json");
const MSG_COOLDOWN_MS = 60_000;
const VOICE_XP_PER_MIN = 8;
const BUTTER = 0xfde047;
const log = (...a) => console.log("[niveles]", ...a);

/** XP necesaria para pasar del nivel n al n+1 (curva clásica: 100, 155, 220…). */
export const xpToNext = (n) => 5 * n * n + 50 * n + 100;
export function levelFromXp(total) {
  let level = 0, rem = Math.max(0, Math.floor(total));
  while (rem >= xpToNext(level)) {
    rem -= xpToNext(level);
    level++;
  }
  return { level, into: rem, need: xpToNext(level) };
}

// ── Datos ───────────────────────────────────────────────────────────
let data = { users: {} };
try {
  data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  data.users ??= {};
} catch {
  /* primera vez */
}
let dirty = false;
function save() {
  if (!dirty) return;
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
  dirty = false;
}
setInterval(save, 30_000).unref();
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.once(sig, () => {
    try {
      save();
    } finally {
      process.exit(0);
    }
  });
}

const userOf = (id) => (data.users[id] ??= { xp: 0, msgs: 0, voiceMin: 0, lastMsg: 0 });

export function ranking() {
  return Object.entries(data.users)
    .filter(([, u]) => u.xp > 0)
    .sort((a, b) => b[1].xp - a[1].xp);
}

// ── Roles de rango ──────────────────────────────────────────────────
/** Roles "Nivel N+" del servidor, de mayor a menor nivel. */
function tierRoles(guild) {
  return guild.roles.cache
    .map((r) => ({ role: r, min: Number(r.name.match(/Nivel\s*(\d+)\s*\+/i)?.[1]) }))
    .filter((t) => Number.isFinite(t.min))
    .sort((a, b) => b.min - a.min);
}

const tierName = (role) => role.name.split("|").pop().trim();

let warnedHierarchy = false;
/** Deja al miembro solo con el rol de rango que le toca. Devuelve el rol nuevo si lo acaba de ganar. */
async function syncTier(member, level) {
  const tiers = tierRoles(member.guild);
  if (!tiers.length) return null;
  const target = tiers.find((t) => level >= t.min)?.role ?? null;
  const me = member.guild.members.me;
  const canManage = (r) => me && r.position < me.roles.highest.position && me.permissions.has("ManageRoles");
  let gained = null;
  for (const { role } of tiers) {
    const has = member.roles.cache.has(role.id);
    const should = target?.id === role.id;
    if (has === should) continue;
    if (!canManage(role)) {
      if (!warnedHierarchy) log(`no puedo dar/quitar "${role.name}": sube el rol de PanBot por encima de los rangos en Ajustes del servidor → Roles`);
      warnedHierarchy = true;
      continue;
    }
    if (should) {
      await member.roles.add(role, `Nivel ${level}`).catch((e) => log("rol:", e.message));
      gained = role;
    } else await member.roles.remove(role, `Nivel ${level}`).catch((e) => log("rol:", e.message));
  }
  return gained;
}

// ── Ganar XP ────────────────────────────────────────────────────────
async function addXp(member, amount, channelForLevelUp, cfg) {
  const u = userOf(member.id);
  const before = levelFromXp(u.xp).level;
  u.xp += amount;
  dirty = true;
  const after = levelFromXp(u.xp).level;
  if (after <= before) return;
  const gained = await syncTier(member, after);
  const ch = channelForLevelUp ?? (await member.client.channels.fetch(cfg.levelUpChannelId).catch(() => null));
  if (!ch?.isTextBased()) return;
  const e = new EmbedBuilder()
    .setColor(0xf3a9c0)
    .setDescription(
      gained
        ? `🎉 <@${member.id}> subió a **nivel ${after}** y desbloqueó el rango **${gained.name}**. ¡Qué nivel, panita! 🧈`
        : `🎉 <@${member.id}> subió a **nivel ${after}**. ¡Sigue así! 🧈`,
    );
  let files = [];
  try {
    const lv = levelFromXp(u.xp);
    const gif = await levelUpGif({
      name: member.displayName || member.user.username,
      username: member.user.username,
      avatarUrl: member.displayAvatarURL({ extension: "png", size: 128 }),
      level: after,
      into: lv.into,
      need: lv.need,
      tier: gained ? tierName(gained) : null,
    });
    files = [new AttachmentBuilder(gif, { name: "nivel.gif" })];
    e.setImage("attachment://nivel.gif");
  } catch (err) {
    log("animación de nivel:", err.message);
  }
  await ch.send({ embeds: [e], files, allowedMentions: { users: [member.id] } }).catch((err) => log("aviso de nivel:", err.message));
}

function onMessage(cfg) {
  return async (message) => {
    if (message.author.bot || !message.guild || message.guild.id !== cfg.guildId || message.system) return;
    const u = userOf(message.author.id);
    u.msgs++;
    dirty = true;
    const now = Date.now();
    if (now - (u.lastMsg || 0) < MSG_COOLDOWN_MS) return;
    u.lastMsg = now;
    const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;
    await addXp(member, 15 + Math.floor(Math.random() * 11), null, cfg);
  };
}

function voiceTick(client, cfg) {
  return async () => {
    const guild = client.guilds.cache.get(cfg.guildId);
    if (!guild) return;
    for (const ch of guild.channels.cache.values()) {
      if (!ch.isVoiceBased() || ch.id === cfg.afkChannelId || ch.id === guild.afkChannelId) continue;
      const humans = ch.members.filter((m) => !m.user.bot);
      if (humans.size < 2) continue;
      for (const m of humans.values()) {
        if (m.voice.selfDeaf || m.voice.serverDeaf) continue;
        userOf(m.id).voiceMin++;
        await addXp(m, VOICE_XP_PER_MIN, null, cfg);
      }
    }
  };
}

// ── Comandos ────────────────────────────────────────────────────────
export const LEVEL_COMMANDS = [
  new SlashCommandBuilder()
    .setName("nivel")
    .setDescription("Tu nivel en el servidor (o el de otra persona)")
    .addUserOption((o) => o.setName("usuario").setDescription("De quién (por defecto, tú)").setRequired(false)),
  new SlashCommandBuilder().setName("top").setDescription("Ranking de niveles del servidor"),
].map((c) => c.toJSON());

async function onInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === "nivel") {
      await interaction.deferReply();
      const user = interaction.options.getUser("usuario") ?? interaction.user;
      if (user.bot) return interaction.editReply("Los bots no suben de nivel 🤖");
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const u = data.users[user.id] ?? { xp: 0 };
      const lv = levelFromXp(u.xp);
      const rankIdx = ranking().findIndex(([id]) => id === user.id);
      const tier = member ? tierRoles(interaction.guild).find((t) => member.roles.cache.has(t.role.id)) : null;
      const png = await rankCard({
        name: member?.displayName || user.globalName || user.username,
        avatarUrl: (member ?? user).displayAvatarURL({ extension: "png", size: 256 }),
        level: lv.level,
        rank: rankIdx >= 0 ? rankIdx + 1 : null,
        into: lv.into,
        need: lv.need,
        totalXp: u.xp,
        tier: tier ? tierName(tier.role) : null,
      });
      return interaction.editReply({ files: [new AttachmentBuilder(png, { name: "nivel.png" })] });
    }
    if (interaction.commandName === "top") {
      await interaction.deferReply();
      const top = ranking().slice(0, 10);
      if (!top.length) return interaction.editReply("Todavía nadie tiene XP. ¡A chatear! 🧈");
      const medals = ["🥇", "🥈", "🥉"];
      const lines = top.map(([id, u], i) => `${medals[i] ?? `\`#${i + 1}\``} <@${id}> · nivel **${levelFromXp(u.xp).level}** · ${u.xp.toLocaleString("es-MX")} XP`);
      const mine = ranking().findIndex(([id]) => id === interaction.user.id);
      const e = new EmbedBuilder()
        .setColor(BUTTER)
        .setTitle("🏆 Ranking de Pan con mantequilla")
        .setDescription(lines.join("\n"))
        .setFooter({ text: mine >= 0 ? `Tu puesto: #${mine + 1} · /nivel para ver tu tarjeta` : "Escribe en el servidor para empezar a ganar XP" });
      return interaction.editReply({ embeds: [e], allowedMentions: { parse: [] } });
    }
  } catch (err) {
    log("error en comando:", err.message);
    if (interaction.deferred) await interaction.editReply("Algo falló al calcular tu nivel. Prueba otra vez.").catch(() => {});
  }
}

// ── Registro ────────────────────────────────────────────────────────
/** @param {import("discord.js").Client} client @param {{ guildId: string, levelUpChannelId: string, afkChannelId?: string }} cfg */
export function registerLevels(client, cfg) {
  client.on(Events.MessageCreate, onMessage(cfg));
  client.on(Events.InteractionCreate, onInteraction);
  client.once(Events.ClientReady, async () => {
    setInterval(() => voiceTick(client, cfg)().catch((e) => log("voz:", e.message)), 60_000);
    // Al arrancar y cada hora, deja a cada uno con el rango que le corresponde
    // (por si se importó XP o el rol del bot estaba por debajo de los rangos y ya se movió).
    const syncAll = async () => {
      const guild = client.guilds.cache.get(cfg.guildId);
      if (!guild) return;
      warnedHierarchy = false;
      const members = await guild.members.fetch().catch(() => null);
      let fixed = 0;
      for (const [id, u] of Object.entries(data.users)) {
        const m = members?.get(id);
        if (m && (await syncTier(m, levelFromXp(u.xp).level))) fixed++;
      }
      log(`${Object.keys(data.users).length} usuarios con XP, ${fixed} rangos nuevos asignados`);
    };
    await syncAll().catch((e) => log("sync:", e.message));
    setInterval(() => syncAll().catch((e) => log("sync:", e.message)), 3600_000);
  });
}
