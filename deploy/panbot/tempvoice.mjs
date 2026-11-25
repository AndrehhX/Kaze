// Salas de voz propias: entra en "➕ Crear sala" y PanBot te crea "🔊 Sala de <tu nombre>" y te mueve ahí.
// La sala se borra sola cuando se queda vacía. Desde Plata (nivel 15+) el dueño puede renombrarla y ponerle límite.
// Las salas que crea se guardan en tempvoice.json para limpiarlas aunque el bot se reinicie.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ChannelType, Events, PermissionFlagsBits as P } from "discord.js";
import { levelOf } from "./levels.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, "tempvoice.json");
const HUB = process.env.CHANNEL_CREAR_SALA_ID || "1575032739755720806";
const MANAGE_LEVEL = 15; // Plata
const COOLDOWN_MS = 60_000; // una sala nueva por persona y minuto
const log = (...a) => console.log("[salas]", ...a);

let rooms = {}; // { channelId: ownerId }
try {
  rooms = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {}
const save = () => fs.writeFileSync(FILE, JSON.stringify(rooms));
const lastCreate = new Map();

async function removeIfEmpty(guild, id) {
  const ch = guild.channels.cache.get(id);
  if (!ch) {
    delete rooms[id];
    return save();
  }
  if (ch.members.filter((m) => !m.user.bot).size > 0) return;
  delete rooms[id];
  save();
  await ch.delete("Sala temporal vacía").catch((e) => log("no se pudo borrar:", e.message));
}

async function onVoice(oldS, newS) {
  const guild = newS.guild;
  // Salió de una sala temporal: si quedó vacía, se borra (10 s de margen por si vuelve).
  if (oldS.channelId && rooms[oldS.channelId] && oldS.channelId !== newS.channelId) {
    setTimeout(() => removeIfEmpty(guild, oldS.channelId).catch(() => {}), 10_000);
  }
  if (newS.channelId !== HUB || !newS.member || newS.member.user.bot) return;
  const m = newS.member;
  // ¿Ya tiene una sala? Se le lleva a esa.
  const own = Object.entries(rooms).find(([, owner]) => owner === m.id)?.[0];
  if (own && guild.channels.cache.has(own)) return m.voice.setChannel(own).catch(() => {});
  if (Date.now() - (lastCreate.get(m.id) ?? 0) < COOLDOWN_MS) return m.voice.disconnect("Espera un minuto para crear otra sala").catch(() => {});
  lastCreate.set(m.id, Date.now());
  const hub = guild.channels.cache.get(HUB);
  const canManage = levelOf(m.id) >= MANAGE_LEVEL;
  const name = `🔊 Sala de ${m.displayName}`.slice(0, 100);
  try {
    const ch = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: hub?.parentId ?? null,
      bitrate: hub?.bitrate,
      // Copia los permisos de la categoría y da al dueño control de su sala.
      permissionOverwrites: [
        ...(hub?.parent?.permissionOverwrites.cache.map((o) => ({ id: o.id, allow: o.allow, deny: o.deny, type: o.type })) ?? []),
        { id: m.id, allow: [P.Connect, P.Speak, P.Stream, P.MoveMembers, P.MuteMembers, ...(canManage ? [P.ManageChannels] : [])] },
      ],
      reason: `Sala temporal de ${m.user.username}`,
    });
    rooms[ch.id] = m.id;
    save();
    await m.voice.setChannel(ch).catch(() => {});
    log(`creada ${ch.id} para ${m.user.username}`);
    setTimeout(() => removeIfEmpty(guild, ch.id).catch(() => {}), 30_000); // por si no llegó a entrar
  } catch (e) {
    log("no se pudo crear:", e.message);
  }
}

export function registerTempVoice(client, { guildId }) {
  client.on(Events.VoiceStateUpdate, (o, n) => onVoice(o, n).catch((e) => log(e.message)));
  client.once(Events.ClientReady, async () => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    // Limpieza de salas que quedaron vacías mientras el bot estaba apagado.
    for (const id of Object.keys(rooms)) await removeIfEmpty(guild, id).catch(() => {});
  });
}
