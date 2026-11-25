// Avisos de capítulos nuevos por DM:
//   /seguir <anime>         te aviso por mensaje privado cuando sale cada capítulo nuevo (con enlace a KAZE)
//   /siguiendo              lo que sigues y cuándo sale lo próximo
//   /dejar-de-seguir <anime>
// El aviso sale una hora después del estreno (lo que suele tardar en estar en KAZE).
// Datos en follows.json (junto a este archivo).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ActionRowBuilder, EmbedBuilder, Events, MessageFlags, SlashCommandBuilder } from "discord.js";
import { anilist, searchAnime, animeById, titleOf, kazeButton, colorOf } from "./kaze-features.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, "follows.json");
const DELAY_S = Number(process.env.FOLLOW_DELAY_MIN ?? 60) * 60; // espera tras el estreno
const MAX_PER_USER = 25;
const EPH = MessageFlags.Ephemeral;
const log = (...a) => console.log("[seguir]", ...a);

// { media: { [mediaId]: { title, users: [userId] } }, lastCheck: unix, sent: ["mediaId:ep"] }
let data = { media: {}, lastCheck: 0, sent: [] };
try {
  data = { ...data, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
} catch {}
function save() {
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(data, null, 1));
  fs.renameSync(`${FILE}.tmp`, FILE);
}
const followsOf = (uid) => Object.entries(data.media).filter(([, m]) => m.users.includes(uid));

export const FOLLOW_COMMANDS = [
  new SlashCommandBuilder()
    .setName("seguir")
    .setDescription("Te aviso por DM cuando salga el capítulo nuevo de un anime")
    .addStringOption((o) => o.setName("anime").setDescription("Busca el anime").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName("siguiendo").setDescription("Los animes de los que te aviso"),
  new SlashCommandBuilder()
    .setName("dejar-de-seguir")
    .setDescription("Dejo de avisarte de un anime")
    .addStringOption((o) => o.setName("anime").setDescription("Uno de los que sigues").setRequired(true).setAutocomplete(true)),
].map((c) => c.toJSON());

async function resolveAnime(raw) {
  raw = raw.trim();
  if (raw.startsWith("id:")) return animeById(Number(raw.slice(3)));
  return (await searchAnime(raw, 1))[0] ?? null;
}

async function onInteraction(i) {
  const names = ["seguir", "siguiendo", "dejar-de-seguir"];
  if (!names.includes(i.commandName)) return;
  try {
    if (i.isAutocomplete()) {
      const q = i.options.getFocused().trim().toLowerCase();
      if (i.commandName === "dejar-de-seguir") {
        return i.respond(
          followsOf(i.user.id)
            .filter(([, m]) => !q || m.title.toLowerCase().includes(q))
            .slice(0, 25)
            .map(([id, m]) => ({ name: m.title.slice(0, 100), value: `id:${id}` })),
        );
      }
      if (q.length < 2) return i.respond([]);
      const list = await searchAnime(q, 10).catch(() => []);
      return i.respond(
        list
          .filter((m) => m.status === "RELEASING" || m.status === "NOT_YET_RELEASED")
          .map((m) => ({ name: `${titleOf(m)}${m.status === "NOT_YET_RELEASED" ? " (próximamente)" : ""}`.slice(0, 100), value: `id:${m.id}` })),
      );
    }
    if (!i.isChatInputCommand()) return;

    if (i.commandName === "siguiendo") {
      const mine = followsOf(i.user.id);
      if (!mine.length) return i.reply({ content: "No sigues ningún anime todavía. Usa `/seguir` y te aviso por DM de cada capítulo nuevo 🧈", flags: EPH });
      await i.deferReply({ flags: EPH });
      const lines = [];
      for (const [id, m] of mine) {
        const a = await animeById(Number(id)).catch(() => null);
        const next = a?.nextAiringEpisode;
        lines.push(`• **${m.title}**${next ? ` · ep. ${next.episode} <t:${next.airingAt}:R>` : a?.status === "FINISHED" ? " · terminó" : ""}`);
      }
      return i.editReply({ embeds: [new EmbedBuilder().setColor(0xa855f7).setTitle(`📺 Te aviso de ${mine.length} anime(s)`).setDescription(lines.join("\n").slice(0, 4000)).setFooter({ text: "Los avisos llegan por DM · /dejar-de-seguir para quitar uno" })] });
    }

    await i.deferReply({ flags: EPH });
    const m = await resolveAnime(i.options.getString("anime", true));
    if (!m) return i.editReply("No encontré ese anime.");
    const entry = data.media[m.id];

    if (i.commandName === "dejar-de-seguir") {
      if (!entry?.users.includes(i.user.id)) return i.editReply(`No seguías **${titleOf(m)}**.`);
      entry.users = entry.users.filter((u) => u !== i.user.id);
      if (!entry.users.length) delete data.media[m.id];
      save();
      return i.editReply(`Listo, ya no te aviso de **${titleOf(m)}**.`);
    }

    // seguir
    if (m.status !== "RELEASING" && m.status !== "NOT_YET_RELEASED") return i.editReply(`**${titleOf(m)}** ya no está en emisión, así que no habrá capítulos nuevos. Míralo completo en KAZE 😉`);
    if (entry?.users.includes(i.user.id)) return i.editReply(`Ya sigues **${titleOf(m)}**.`);
    if (followsOf(i.user.id).length >= MAX_PER_USER) return i.editReply(`Puedes seguir hasta ${MAX_PER_USER} animes. Quita alguno con \`/dejar-de-seguir\`.`);
    data.media[m.id] = { title: titleOf(m), users: [...(entry?.users ?? []), i.user.id] };
    save();
    // Mensaje de prueba por DM: así la persona sabe si tiene los mensajes privados cerrados.
    const dmOk = await i.user
      .send({ content: `✅ Te avisaré aquí de cada capítulo nuevo de **${titleOf(m)}**.`, components: [new ActionRowBuilder().addComponents(kazeButton(m))] })
      .then(() => true)
      .catch(() => false);
    const next = m.nextAiringEpisode;
    return i.editReply(
      `🔔 Sigues **${titleOf(m)}**.${next ? ` Próximo capítulo (${next.episode}) <t:${next.airingAt}:R>.` : ""}` +
        (dmOk ? " Te llegará un DM cuando salga." : "\n⚠️ **No pude escribirte por DM.** Activa *Mensajes directos* en la configuración de privacidad de este servidor o no te llegarán los avisos."),
    );
  } catch (err) {
    log("error:", err.message);
    if (i.isAutocomplete()) return i.respond([]).catch(() => {});
    const msg = "AniList no responde ahora mismo. Prueba en un minuto.";
    return (i.deferred ? i.editReply(msg) : i.reply({ content: msg, flags: EPH })).catch(() => {});
  }
}

async function checkAiring(client) {
  const ids = Object.keys(data.media).map(Number);
  const now = Math.floor(Date.now() / 1000);
  const to = now - DELAY_S;
  const from = data.lastCheck || to - 15 * 60;
  if (!ids.length || to <= from) {
    data.lastCheck = Math.max(data.lastCheck, to);
    return;
  }
  const found = [];
  for (let k = 0; k < ids.length; k += 50) {
    const d = await anilist(
      `query($ids:[Int],$f:Int,$t:Int){ Page(perPage:50){ airingSchedules(mediaId_in:$ids, airingAt_greater:$f, airingAt_lesser:$t, sort:TIME){ episode airingAt media{ id title{ romaji english } coverImage{ large color } episodes } } } }`,
      { ids: ids.slice(k, k + 50), f: from, t: to + 1 },
    );
    found.push(...d.Page.airingSchedules);
  }
  data.lastCheck = to;
  for (const a of found) {
    const key = `${a.media.id}:${a.episode}`;
    if (data.sent.includes(key)) continue;
    data.sent = [...data.sent, key].slice(-500);
    const entry = data.media[a.media.id];
    if (!entry) continue;
    const last = a.media.episodes && a.episode >= a.media.episodes;
    const e = new EmbedBuilder()
      .setColor(colorOf(a.media))
      .setAuthor({ name: "📺 Capítulo nuevo" })
      .setTitle(`${titleOf(a.media)} · episodio ${a.episode}${last ? " (final)" : ""}`)
      .setDescription(`Salió <t:${a.airingAt}:R>. Si aún no aparece en KAZE, espera un ratito: se suben poco después del estreno.`)
      .setThumbnail(a.media.coverImage?.large || null)
      .setFooter({ text: "Pan con mantequilla × Orunei · /dejar-de-seguir para no recibir más" });
    const row = new ActionRowBuilder().addComponents(kazeButton(a.media, "Ver en KAZE"));
    let ok = 0;
    for (const uid of entry.users) {
      const u = await client.users.fetch(uid).catch(() => null);
      if (await u?.send({ embeds: [e], components: [row] }).then(() => true).catch(() => false)) ok++;
    }
    log(`aviso ${key} → ${ok}/${entry.users.length}`);
    // Serie terminada: se deja de seguir sola.
    if (last) delete data.media[a.media.id];
  }
  save();
}

export function registerFollows(client) {
  client.on(Events.InteractionCreate, onInteraction);
  client.once(Events.ClientReady, () => {
    const run = () => checkAiring(client).catch((e) => log("revisión:", e.message));
    setTimeout(run, 30_000);
    setInterval(run, 10 * 60_000);
  });
}
