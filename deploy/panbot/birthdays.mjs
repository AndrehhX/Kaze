// Cumpleaños:
//   /cumple poner <dia> <mes>   guarda tu cumpleaños (sin año)
//   /cumple quitar
//   /cumple proximos            los próximos cumpleaños del server
// Cada día a las BIRTHDAY_HOUR (hora de KAZE_TZ) PanBot felicita en #Chat-General a quien cumple.
// Datos en birthdays.json (junto a este archivo).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EmbedBuilder, Events, MessageFlags, SlashCommandBuilder } from "discord.js";
import { localDay } from "./levels.mjs";

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
  const ch = await client.channels.fetch(cfg.channelId).catch(() => null);
  if (!ch?.isTextBased()) return;
  const who = today.map((id) => `<@${id}>`).join(", ");
  await ch.send({
    content: `🎂 ¡Hoy es el cumple de ${who}! Feliz cumpleaños, panita${today.length > 1 ? "s" : ""} 🧈🎉`,
    allowedMentions: { users: today },
  });
  log("felicitados", today.length);
}

export function registerBirthdays(client, cfg) {
  client.on(Events.InteractionCreate, (i) => onInteraction(i).catch((e) => log(e.message)));
  client.once(Events.ClientReady, () => {
    setInterval(() => daily(client, cfg).catch((e) => log(e.message)), 5 * 60_000);
  });
}
