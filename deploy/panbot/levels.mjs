// Sistema de niveles de PanBot.
//   XP por escribir: 15–25 por mensaje, como mucho 1 vez por minuto (el spam no sube de nivel).
//   XP por llamada: 8 por minuto si hay al menos 2 personas con el micro abierto (sin mutear ni ensordecer),
//     fuera del canal AFK y con un tope diario (VOICE_DAILY_CAP) para que dejar la llamada abierta no regale niveles.
//   Avisos de subida: cada quien elige con /avisos-nivel:
//     privado (por defecto) → te llega por mensaje privado, como mucho uno cada 30 min (los rangos nuevos siempre);
//     público → se anuncia en #Niveles y los rangos nuevos también en el chat general que esa persona ve;
//     apagado → sin avisos (los roles de rango se siguen dando).
//   Roles de rango automáticos: los roles del servidor cuyo nombre contiene "Nivel N+" (Bronce 5, Plata 15, Oro 30, Diamante 50).
//   /nivel [usuario]  tarjeta con nivel, puesto y progreso
//   /top              ranking del servidor
//   Resumen semanal   los lunes (WEEKLY_HOUR) se publica en #Niveles el top de la semana anterior.
// Datos en levels.json (junto a este archivo). Se guardan cada 30 s y al apagar.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AttachmentBuilder, EmbedBuilder, Events, MessageFlags, SlashCommandBuilder } from "discord.js";
import { rankCard } from "./cards.mjs";
import { levelUpGif } from "./pixel.mjs";
import { card, COLORS } from "./ui.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, "levels.json");
const MSG_COOLDOWN_MS = 60_000;
const VOICE_XP_PER_MIN = 8;
const VOICE_DAILY_CAP = Number(process.env.VOICE_DAILY_CAP ?? 360); // XP de llamada por día (≈45 min)
const TZ = process.env.KAZE_TZ || "America/Mexico_City";
const WEEKLY_HOUR = Number(process.env.WEEKLY_HOUR ?? 10);
const BUTTER = 0xfde047;
const NOTIFY_MODES = ["privado", "publico", "apagado"];
const PRIVATE_GAP_MS = 30 * 60_000; // aviso privado como mucho cada 30 min (en llamada se sube rápido)
const log = (...a) => console.log("[niveles]", ...a);

// ── Fechas locales (día y semana ISO en KAZE_TZ) ────────────────────
function local(date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: p.weekday };
}
/** Semana ISO ("2026-W48") del día local. */
export function weekKey(date = new Date()) {
  const { day } = local(date);
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - dow + 3); // jueves de esa semana
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const wk = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}
export const localDay = () => local().day;

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

/** Lleva la cuenta de la semana: al cambiar de semana guarda la anterior (para el resumen del lunes). */
function rollWeek(u) {
  const wk = weekKey();
  if (u.wk === wk) return;
  if (u.wk) Object.assign(u, { prevWk: u.wk, prevWkXp: u.wkXp ?? 0, prevWkVoice: u.wkVoice ?? 0 });
  Object.assign(u, { wk, wkXp: 0, wkVoice: 0 });
}
/** Lo mismo por mes ("2026-11"): mensajes, minutos de voz y XP, para /wrapped. */
export const monthKey = (date = new Date()) => local(date).day.slice(0, 7);
function rollMonth(u) {
  const mo = monthKey();
  if (u.mo === mo) return;
  if (u.mo) Object.assign(u, { prevMo: u.mo, prevMoXp: u.moXp ?? 0, prevMoMsgs: u.moMsgs ?? 0, prevMoVoice: u.moVoice ?? 0 });
  Object.assign(u, { mo, moXp: 0, moMsgs: 0, moVoice: 0 });
}
export function monthStats(id, mo = monthKey()) {
  const u = data.users[id];
  if (!u) return { xp: 0, msgs: 0, voice: 0 };
  if (u.mo === mo) return { xp: u.moXp ?? 0, msgs: u.moMsgs ?? 0, voice: u.moVoice ?? 0 };
  if (u.prevMo === mo) return { xp: u.prevMoXp ?? 0, msgs: u.prevMoMsgs ?? 0, voice: u.prevMoVoice ?? 0 };
  return { xp: 0, msgs: 0, voice: 0 };
}

/** XP y minutos de voz de un usuario en la semana indicada. */
function weekStats(u, wk) {
  if (u.wk === wk) return { xp: u.wkXp ?? 0, voice: u.wkVoice ?? 0 };
  if (u.prevWk === wk) return { xp: u.prevWkXp ?? 0, voice: u.prevWkVoice ?? 0 };
  return { xp: 0, voice: 0 };
}

/** Nivel actual de un usuario (lo usan otras funciones para dar ventajas por rango). */
export const levelOf = (id) => levelFromXp(data.users[id]?.xp ?? 0).level;

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
async function addXp(member, amount, cfg, { voice = false } = {}) {
  const u = userOf(member.id);
  rollWeek(u);
  rollMonth(u);
  const before = levelFromXp(u.xp).level;
  u.xp += amount;
  u.wkXp += amount;
  u.moXp += amount;
  if (voice) {
    u.wkVoice += 1;
    u.moVoice += 1;
  }
  dirty = true;
  const after = levelFromXp(u.xp).level;
  if (after <= before) return;
  const gained = await syncTier(member, after);
  const fetchCh = (id) => (id ? member.client.channels.fetch(id).catch(() => null) : null);
  const levelsCh = await fetchCh(cfg.levelUpChannelId);
  const lv = levelFromXp(u.xp);
  const gif = async () => {
    try {
      const buf = await levelUpGif({
        name: member.displayName || member.user.username,
        username: member.user.username,
        avatarUrl: member.displayAvatarURL({ extension: "png", size: 128 }),
        level: after,
        into: lv.into,
        need: lv.need,
        tier: gained ? tierName(gained) : null,
      });
      return [new AttachmentBuilder(buf, { name: "nivel.gif" })];
    } catch (err) {
      log("animación de nivel:", err.message);
      return [];
    }
  };
  const mode = NOTIFY_MODES.includes(u.notify) ? u.notify : "privado";
  if (mode === "apagado") return;
  // Privado: por DM, sin repetir cada pocos minutos (salvo rango nuevo). Si tiene los DM cerrados, no pasa nada.
  if (mode === "privado") {
    if (!gained && Date.now() - (u.lastNotify || 0) < PRIVATE_GAP_MS) return;
    u.lastNotify = Date.now();
    dirty = true;
    const files = await gif();
    await member
      .send(
        card({
          accent: gained ? gained.color || COLORS.pink : COLORS.pink,
          kicker: gained ? "🏆 Rango nuevo en Pan con mantequilla" : "🎉 Subiste de nivel en Pan con mantequilla",
          title: gained ? `Ahora eres ${gained.name}` : `Nivel ${after}`,
          body: gained ? `Llegaste a **nivel ${after}**. ¡Qué nivel, panita! 🧈` : `Vas en **nivel ${after}** (${lv.into}/${lv.need} XP para el siguiente). ¡Sigue así! 🧈`,
          image: files.length ? "attachment://nivel.gif" : null,
          imageAlt: `Nivel ${after}`,
          footer: "¿Quieres que se anuncie en el server o no recibir avisos? Usa /avisos-nivel",
          files,
        }),
      )
      .catch(() => {});
    return;
  }
  // Público: en #Niveles. La mención no notifica: solo se ve el nombre.
  if (levelsCh?.isTextBased()) {
    const files = await gif();
    const msg = card({
      accent: gained ? gained.color || COLORS.pink : COLORS.pink,
      kicker: gained ? "🏆 Rango nuevo" : "🎉 Subida de nivel",
      title: `${member.displayName} · nivel ${after}`,
      body: gained ? `<@${member.id}> desbloqueó **${gained.name}**. ¡Qué nivel, panita! 🧈` : `<@${member.id}> sigue subiendo. ¡Así se hace! 🧈`,
      image: files.length ? "attachment://nivel.gif" : null,
      imageAlt: `${member.displayName} subió a nivel ${after}`,
      files,
    });
    await levelsCh.send(msg).catch((err) => log("aviso de nivel:", err.message));
  }
  // Y los rangos nuevos también en el chat general que esa persona ve (los OG no ven el público: va al suyo).
  if (gained && cfg.rankUpChannelId) {
    let ch = await fetchCh(cfg.rankUpChannelId);
    if (ch && !ch.permissionsFor(member)?.has("ViewChannel")) ch = await fetchCh(cfg.altRankUpChannelId);
    if (ch?.isTextBased() && ch.permissionsFor(member)?.has("ViewChannel")) {
      const files = await gif();
      const msg = card({
        accent: gained.color || COLORS.pink,
        kicker: "🏆 ¡Rango nuevo en el server!",
        title: `${member.displayName} ahora es ${gained.name}`,
        body: `<@${member.id}> llegó a **nivel ${after}**. ¡Felicidades, panita! 🧈`,
        thumbnail: member.displayAvatarURL({ extension: "png", size: 256 }),
        image: files.length ? "attachment://nivel.gif" : null,
        imageAlt: `${member.displayName} llegó a nivel ${after}`,
        footer: `Todas las subidas en #niveles · /nivel para ver tu tarjeta`,
        files,
        mentions: { users: [member.id] },
      });
      await ch.send(msg).catch((err) => log("aviso de rango:", err.message));
    }
  }
}

function onMessage(cfg) {
  return async (message) => {
    if (message.author.bot || !message.guild || message.guild.id !== cfg.guildId || message.system) return;
    const u = userOf(message.author.id);
    rollMonth(u);
    u.msgs++;
    u.moMsgs++;
    dirty = true;
    const now = Date.now();
    if (now - (u.lastMsg || 0) < MSG_COOLDOWN_MS) return;
    u.lastMsg = now;
    const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;
    await addXp(member, 15 + Math.floor(Math.random() * 11), cfg);
  };
}

/** Cuenta para XP de voz: micro abierto y oyendo (ni muteado ni ensordecido, ni suprimido en escenario). */
const activeInVoice = (m) => !m.user.bot && !m.voice.selfDeaf && !m.voice.serverDeaf && !m.voice.selfMute && !m.voice.serverMute && !m.voice.suppress;

function voiceTick(client, cfg) {
  return async () => {
    const guild = client.guilds.cache.get(cfg.guildId);
    if (!guild) return;
    const today = localDay();
    for (const ch of guild.channels.cache.values()) {
      if (!ch.isVoiceBased() || ch.id === cfg.afkChannelId || ch.id === guild.afkChannelId) continue;
      const active = ch.members.filter(activeInVoice);
      if (active.size < 2) continue; // hablar solo (o con gente muteada) no cuenta
      for (const m of active.values()) {
        const u = userOf(m.id);
        if (u.voiceDay !== today) Object.assign(u, { voiceDay: today, voiceDayXp: 0 });
        u.voiceMin++;
        if (u.voiceDayXp >= VOICE_DAILY_CAP) continue; // tope diario alcanzado
        u.voiceDayXp += VOICE_XP_PER_MIN;
        await addXp(m, VOICE_XP_PER_MIN, cfg, { voice: true });
      }
    }
  };
}

// ── Resumen semanal ─────────────────────────────────────────────────
async function weeklySummary(client, cfg) {
  const now = local();
  if (now.weekday !== "Mon" || now.hour < WEEKLY_HOUR) return;
  const thisWeek = weekKey();
  data.meta ??= {};
  if (data.meta.lastWeekly === thisWeek) return;
  data.meta.lastWeekly = thisWeek; // se marca antes para no repetir si algo falla
  dirty = true;
  save();
  const prev = weekKey(new Date(Date.now() - 7 * 86400_000));
  const rows = Object.entries(data.users).map(([id, u]) => ({ id, ...weekStats(u, prev) }));
  const byXp = rows.filter((r) => r.xp > 0).sort((a, b) => b.xp - a.xp);
  if (!byXp.length) return;
  const voice = rows.filter((r) => r.voice > 0).sort((a, b) => b.voice - a.voice)[0];
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const h = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
  const podium = byXp.slice(0, 5).map((r, i) => `${medals[i]} <@${r.id}> · **+${r.xp.toLocaleString("es-MX")} XP**`).join("\n");
  // En #Niveles: lo ven todos (el chat general público no lo ven los OG).
  const ch = await client.channels.fetch(cfg.weeklyChannelId || cfg.levelUpChannelId).catch(() => null);
  const guild = client.guilds.cache.get(cfg.guildId);
  const winner = guild?.members.cache.get(byXp[0].id);
  if (ch?.isTextBased())
    await ch.send(
      card({
        accent: COLORS.butter,
        kicker: "📅 Resumen de la semana",
        title: winner ? `👑 ${winner.displayName} fue el más activo` : "Los más activos de la semana",
        thumbnail: winner?.displayAvatarURL({ extension: "png", size: 256 }) ?? null,
        body: podium,
        extra: [`👥 **${byXp.length}** panas ganaron XP`, voice ? `🎙️ Más tiempo en llamada: <@${voice.id}> · **${h(voice.voice)}**` : null].filter(Boolean).join("\n"),
        footer: "Nueva semana, nuevo ranking · /nivel para ver tu tarjeta · /top para el ranking total",
      }),
    );
  log("resumen semanal publicado", prev);
}

// ── Comandos ────────────────────────────────────────────────────────
export const LEVEL_COMMANDS = [
  new SlashCommandBuilder()
    .setName("nivel")
    .setDescription("Tu nivel en el servidor (o el de otra persona)")
    .addUserOption((o) => o.setName("usuario").setDescription("De quién (por defecto, tú)").setRequired(false)),
  new SlashCommandBuilder().setName("top").setDescription("Ranking de niveles del servidor"),
  new SlashCommandBuilder()
    .setName("avisos-nivel")
    .setDescription("Cómo quieres enterarte cuando subes de nivel")
    .addStringOption((o) =>
      o
        .setName("modo")
        .setDescription("Dónde avisarte")
        .setRequired(true)
        .addChoices({ name: "Privado (por mensaje directo)", value: "privado" }, { name: "Público (en #niveles)", value: "publico" }, { name: "Apagado", value: "apagado" }),
    ),
].map((c) => c.toJSON());

async function onInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === "avisos-nivel") {
      const mode = interaction.options.getString("modo", true);
      if (!NOTIFY_MODES.includes(mode)) return interaction.reply({ content: "Opción no válida.", flags: MessageFlags.Ephemeral });
      userOf(interaction.user.id).notify = mode;
      dirty = true;
      const text = {
        privado: "Listo: tus subidas de nivel te llegarán por mensaje privado (como mucho una cada 30 min; los rangos nuevos siempre). 🧈",
        publico: "Listo: tus subidas se anunciarán en #niveles y los rangos nuevos también en el chat general. 🎉",
        apagado: "Listo: no te avisaré cuando subas de nivel. Los roles de rango te los sigo dando. 🤐",
      }[mode];
      return interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    }
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
/** @param {import("discord.js").Client} client @param {{ guildId: string, levelUpChannelId: string, rankUpChannelId?: string, altRankUpChannelId?: string, weeklyChannelId?: string, afkChannelId?: string }} cfg */
export function registerLevels(client, cfg) {
  client.on(Events.MessageCreate, onMessage(cfg));
  client.on(Events.InteractionCreate, onInteraction);
  client.once(Events.ClientReady, async () => {
    setInterval(() => voiceTick(client, cfg)().catch((e) => log("voz:", e.message)), 60_000);
    setInterval(() => weeklySummary(client, cfg).catch((e) => log("resumen:", e.message)), 5 * 60_000);
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
