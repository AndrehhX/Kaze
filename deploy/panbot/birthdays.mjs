// Cumpleaños:
//   /cumple poner <dia> <mes>   guarda tu cumpleaños (sin año)
//   /cumple quitar
//   /cumple proximos            los próximos cumpleaños del server
// Cada día a las BIRTHDAY_HOUR (hora de KAZE_TZ) PanBot felicita a quien cumple en el chat general que puede ver
// (el público, o el 🧈 de los OG para quienes no ven el público).
// Datos en birthdays.json (junto a este archivo).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EmbedBuilder, Events, MessageFlags, SlashCommandBuilder } from "discord.js";
import { localDay } from "./levels.mjs";
import { card, COLORS } from "./ui.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, "birthdays.json");
const TZ = process.env.KAZE_TZ || "America/Mexico_City";
const HOUR = Number(process.env.BIRTHDAY_HOUR ?? 10);
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const EPH = MessageFlags.Ephemeral;
const log = (...a) => console.log("[cumple]", ...a);

let data = { users: {}, lastDay: null }; // users: { id: { d, m } }
try {
  data = { ...data, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
} catch {}
const save = () => fs.writeFileSync(FILE, JSON.stringify(data));

export const BIRTHDAY_COMMANDS = [
  new SlashCommandBuilder()
    .setName("cumple")
    .setDescription("Tu cumpleaños en el server")
    .addSubcommand((s) =>
      s
        .setName("poner")
        .setDescription("Guarda tu cumpleaños y PanBot te felicitará ese día")
        .addIntegerOption((o) => o.setName("dia").setDescription("Día (1-31)").setRequired(true).setMinValue(1).setMaxValue(31))
        .addIntegerOption((o) =>
          o.setName("mes").setDescription("Mes").setRequired(true).addChoices(...MESES.map((n, i) => ({ name: n[0].toUpperCase() + n.slice(1), value: i + 1 }))),
        ),
    )
    .addSubcommand((s) => s.setName("quitar").setDescription("Borra tu cumpleaños"))
    .addSubcommand((s) => s.setName("proximos").setDescription("Los próximos cumpleaños del server")),
].map((c) => c.toJSON());

/** Días que faltan desde hoy (día local) hasta el próximo d/m. */
function daysUntil(d, m) {
  const [y, mm, dd] = localDay().split("-").map(Number);
  const today = Date.UTC(y, mm - 1, dd);
  let next = Date.UTC(y, m - 1, d);
  if (next < today) next = Date.UTC(y + 1, m - 1, d);
  return Math.round((next - today) / 86400_000);
}

async function onInteraction(i) {
  if (!i.isChatInputCommand() || i.commandName !== "cumple") return;
  const sub = i.options.getSubcommand();
  if (sub === "poner") {
    const d = i.options.getInteger("dia", true), m = i.options.getInteger("mes", true);
    if (d > DIAS_MES[m - 1]) return i.reply({ content: `${MESES[m - 1]} no tiene ${d} días 🤔`, flags: EPH });
    data.users[i.user.id] = { d, m };
    save();
    return i.reply({ content: `🎂 Guardado: **${d} de ${MESES[m - 1]}**. Ese día te felicito en el chat general.`, flags: EPH });
  }
  if (sub === "quitar") {
    delete data.users[i.user.id];
    save();
    return i.reply({ content: "Listo, borré tu cumpleaños.", flags: EPH });
  }
  const list = Object.entries(data.users)
    .filter(([id]) => i.guild.members.cache.has(id))
    .map(([id, b]) => ({ id, ...b, left: daysUntil(b.d, b.m) }))
    .sort((a, b) => a.left - b.left)
    .slice(0, 10);
  if (!list.length) return i.reply({ content: "Nadie ha guardado su cumpleaños todavía. ¡Sé el primero con `/cumple poner`! 🎂", flags: EPH });
  const lines = list.map((b) => `• <@${b.id}> · ${b.d} de ${MESES[b.m - 1]}${b.left === 0 ? " · **¡hoy!** 🎉" : b.left === 1 ? " · mañana" : ` · en ${b.left} días`}`);
  return i.reply({ embeds: [new EmbedBuilder().setColor(0xf3a9c0).setTitle("🎂 Próximos cumpleaños").setDescription(lines.join("\n"))], allowedMentions: { parse: [] } });
}

async function daily(client, cfg) {
  const day = localDay();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (hour < HOUR || data.lastDay === day) return;
  data.lastDay = day;
  save();
  const [, mm, dd] = day.split("-").map(Number);
  const guild = client.guilds.cache.get(cfg.guildId);
  const today = Object.entries(data.users).filter(([id, b]) => b.d === dd && b.m === mm && guild?.members.cache.has(id)).map(([id]) => id);
  if (!today.length) return;
  const main = await client.channels.fetch(cfg.channelId).catch(() => null);
  const alt = cfg.altChannelId ? await client.channels.fetch(cfg.altChannelId).catch(() => null) : null;
  // Cada quien se felicita en el chat general que puede ver (los OG no ven el público: va al suyo).
  const groups = new Map();
  for (const id of today) {
    const m = guild.members.cache.get(id);
    const ch = main?.permissionsFor(m)?.has("ViewChannel") ? main : alt?.permissionsFor(m)?.has("ViewChannel") ? alt : null;
    if (!ch?.isTextBased()) continue;
    groups.set(ch, [...(groups.get(ch) ?? []), id]);
  }
  for (const [ch, ids] of groups) {
    const who = ids.map((id) => `<@${id}>`).join(", ");
    const first = guild.members.cache.get(ids[0]);
    const many = ids.length > 1;
    await ch
      .send(
        card({
          accent: COLORS.pink,
          kicker: "🎂 Cumpleaños en el server",
          title: many ? "¡Hoy hay doble pastel!" : `¡Feliz cumple, ${first?.displayName ?? "panita"}!`,
          thumbnail: first?.displayAvatarURL({ extension: "png", size: 256 }) ?? null,
          body: `Hoy cumple${many ? "n" : ""} ${who}. ¡Que lo pasen bonito, panita${many ? "s" : ""}! 🧈🎉\nDéjenles un mensaje aquí abajo 👇`,
          footer: "¿Quieres que te feliciten? /cumple poner",
          mentions: { users: ids },
        }),
      )
      .catch((e) => log("felicitar:", e.message));
  }
  log("felicitados", today.length);
}

export function registerBirthdays(client, cfg) {
  client.on(Events.InteractionCreate, (i) => onInteraction(i).catch((e) => log(e.message)));
  client.once(Events.ClientReady, () => {
    setInterval(() => daily(client, cfg).catch((e) => log(e.message)), 5 * 60_000);
  });
}
