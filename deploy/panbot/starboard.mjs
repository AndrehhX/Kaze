// #Destacados: cuando un mensaje junta 3 ⭐ (sin contar la del autor ni de bots; las de Oro 30+ valen doble)
// PanBot lo reenvía a #Destacados con un enlace al original. Solo mensajes de canales públicos
// (nunca del chat de los OG ni de canales privados), y cada mensaje una sola vez.
// Reenviar (forward) copia el mensaje tal cual sin que el bot tenga que leer su texto.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EmbedBuilder, Events, PermissionFlagsBits as P } from "discord.js";
import { levelOf } from "./levels.mjs";
import { card, COLORS } from "./ui.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, "starboard.json");
const CHANNEL = process.env.CHANNEL_DESTACADOS_ID || "1575032739063795743";
const NEEDED = Number(process.env.STARS_NEEDED ?? 3);
const DOUBLE_LEVEL = 30; // Oro
const MAX_AGE_MS = 14 * 86400_000; // solo mensajes de las últimas 2 semanas
const log = (...a) => console.log("[destacados]", ...a);

let posted = [];
try {
  posted = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {}
const busy = new Set();

async function onReact(reaction, user) {
  if (reaction.emoji.name !== "⭐" || user.bot) return;
  if (reaction.partial) reaction = await reaction.fetch().catch(() => null);
  const msg = reaction?.message.partial ? await reaction.message.fetch().catch(() => null) : reaction?.message;
  if (!msg?.guild || msg.author?.bot || msg.channelId === CHANNEL) return;
  if (posted.includes(msg.id) || busy.has(msg.id) || Date.now() - msg.createdTimestamp > MAX_AGE_MS) return;
  const everyone = msg.guild.roles.everyone;
  if (!msg.channel.permissionsFor(everyone)?.has(P.ViewChannel) || msg.channel.nsfw) return; // solo canales públicos
  busy.add(msg.id);
  try {
    const users = await reaction.users.fetch();
    let score = 0;
    for (const u of users.values()) {
      if (u.bot || u.id === msg.author.id) continue;
      score += levelOf(u.id) >= DOUBLE_LEVEL ? 2 : 1;
    }
    if (score < NEEDED) return;
    const dest = await msg.client.channels.fetch(CHANNEL).catch(() => null);
    if (!dest?.isTextBased()) return;
    posted = [...posted, msg.id].slice(-2000);
    fs.writeFileSync(FILE, JSON.stringify(posted));
    await dest.send(
      card({
        accent: COLORS.butter,
        kicker: `⭐ ${users.filter((u) => !u.bot).size} estrellas · en <#${msg.channelId}>`,
        title: `${msg.member?.displayName || msg.author.username} brilló`,
        thumbnail: msg.author.displayAvatarURL({ extension: "png", size: 128 }),
        body: "El mensaje original va justo aquí abajo 👇",
        buttons: [{ label: "Ir al mensaje", emoji: "↗️", url: msg.url }],
      }),
    );
    await msg.forward(dest);
    log(`destacado ${msg.id} de ${msg.author.username}`);
  } catch (err) {
    log("error:", err.message);
  } finally {
    busy.delete(msg.id);
  }
}

export function registerStarboard(client) {
  client.on(Events.MessageReactionAdd, (r, u) => onReact(r, u).catch((e) => log(e.message)));
}
