// Tickets de soporte (botones del panel de #Tickets).
//   - Un ticket abierto por persona (si ya tiene uno, se le manda a ese).
//   - Canal privado en la zona staff: lo ven la persona, Co-Owner, Moderadores y Admin.
//   - Se avisa al staff con una mención al abrirlo.
//   - Solo quien lo abrió o el staff pueden cerrarlo. Al cerrar se pide confirmación.
//   - Apertura y cierre quedan en #Logs (quién, tipo, cuánto duró y cuántos mensajes tuvo).
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits as P } from "discord.js";

const STAFF_ROLES = (process.env.STAFF_ROLE_IDS || "1573416756972757162,1573416759573356594").split(",").filter(Boolean); // Co-Owner, Moderador
const LOGS_CHANNEL = process.env.CHANNEL_LOGS_ID || "1556527794018848838";
const TYPES = {
  ticket_general: { label: "Soporte general", emoji: "📩", slug: "soporte", color: 0x3b82f6 },
  ticket_bug: { label: "Bug de Orunei", emoji: "🐛", slug: "bug", color: 0xef4444 },
  ticket_suggestion: { label: "Sugerencia", emoji: "💡", slug: "idea", color: 0x22c55e },
};
const log = (...a) => console.log("[tickets]", ...a);

/** El tema del canal guarda los datos del ticket: "ticket:<userId>:<tipo>:<abiertoEn>". */
const parseTopic = (topic) => {
  const m = /^ticket:(\d+):([a-z_]+):(\d+)/.exec(topic || "");
  return m ? { userId: m[1], type: m[2], openedAt: Number(m[3]) } : null;
};

const isStaff = (member) =>
  member.permissions.has(P.Administrator) || member.permissions.has(P.ManageChannels) || STAFF_ROLES.some((id) => member.roles.cache.has(id));

async function logEmbed(guild, embed) {
  const ch = await guild.channels.fetch(LOGS_CHANNEL).catch(() => null);
  if (ch?.isTextBased()) await ch.send({ embeds: [embed.setTimestamp()], allowedMentions: { parse: [] } }).catch(() => {});
}

async function openTicket(interaction) {
  const type = TYPES[interaction.customId] ?? TYPES.ticket_general;
  const { guild, user } = interaction;
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  // ¿Ya tiene uno abierto?
  const existing = guild.channels.cache.find((c) => parseTopic(c.topic)?.userId === user.id);
  if (existing) return interaction.editReply(`Ya tienes un ticket abierto: <#${existing.id}>. Escríbenos ahí 🧈`);

  const staffCat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && /STAFF/i.test(c.name.normalize("NFKC")));
  const slug = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || user.id;
  const staffAllow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.ManageMessages];
  const channel = await guild.channels.create({
    name: `${type.slug}-${slug}`,
    type: ChannelType.GuildText,
    parent: staffCat?.id ?? null,
    topic: `ticket:${user.id}:${interaction.customId}:${Date.now()} · ${type.label} de ${user.username}`,
    reason: `Ticket de ${user.username}`,
    permissionOverwrites: [
      { id: guild.id, deny: [P.ViewChannel] },
      { id: user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
      { id: guild.members.me.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels] },
      ...STAFF_ROLES.filter((id) => guild.roles.cache.has(id)).map((id) => ({ id, allow: staffAllow })),
    ],
  });

  const close = new ButtonBuilder().setCustomId("close_ticket").setLabel("Cerrar ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger);
  const pings = STAFF_ROLES.filter((id) => guild.roles.cache.has(id));
  await channel.send({
    content: `👋 <@${user.id}> ${pings.map((id) => `<@&${id}>`).join(" ")}`,
    embeds: [
      new EmbedBuilder()
        .setColor(type.color)
        .setTitle(`${type.emoji} ${type.label}`)
        .setDescription(
          "Este canal es privado: solo lo ves tú y el staff.\n\n**Cuéntanos con detalle qué pasa** (y si es un fallo, en qué anime/episodio, desde la web o la app, y una captura si puedes). Te respondemos aquí.",
        )
        .setFooter({ text: "Cuando esté resuelto, pulsa 🔒 Cerrar ticket" }),
    ],
    components: [new ActionRowBuilder().addComponents(close)],
    allowedMentions: { users: [user.id], roles: pings },
  });
  await interaction.editReply(`✅ Ticket creado: <#${channel.id}>`);
  await logEmbed(
    guild,
    new EmbedBuilder().setColor(type.color).setAuthor({ name: "Ticket abierto", iconURL: user.displayAvatarURL() }).setDescription(`<#${channel.id}> · ${type.emoji} ${type.label}\nPor <@${user.id}> (\`${user.username}\`)`),
  );
  log("abierto", channel.name);
}

async function askClose(interaction) {
  const info = parseTopic(interaction.channel?.topic);
  if (!info) return interaction.reply({ content: "Este canal no es un ticket.", ephemeral: true });
  if (interaction.user.id !== info.userId && !isStaff(interaction.member))
    return interaction.reply({ content: "Solo quien abrió el ticket o el staff pueden cerrarlo.", ephemeral: true });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("close_ticket_yes").setLabel("Sí, cerrar").setEmoji("🔒").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("close_ticket_no").setLabel("Cancelar").setStyle(ButtonStyle.Secondary),
  );
  return interaction.reply({ content: "¿Seguro que quieres cerrar el ticket? El canal se borrará.", components: [row], ephemeral: true });
}

async function closeTicket(interaction) {
  const ch = interaction.channel;
  const info = parseTopic(ch?.topic);
  if (!info) return interaction.update({ content: "Este canal no es un ticket.", components: [] });
  if (interaction.user.id !== info.userId && !isStaff(interaction.member)) return interaction.update({ content: "No puedes cerrar este ticket.", components: [] });
  await interaction.update({ content: "🔒 Cerrando…", components: [] });
  // Cuenta los mensajes (sin leer su contenido) para el registro
  let count = 0;
  try {
    let before;
    for (let i = 0; i < 10; i++) {
      const batch = await ch.messages.fetch({ limit: 100, before });
      count += batch.filter((m) => !m.author.bot).size;
      if (batch.size < 100) break;
      before = batch.last().id;
    }
  } catch {}
  await ch.send(`🔒 Ticket cerrado por <@${interaction.user.id}>. Este canal se borrará en 5 segundos.`).catch(() => {});
  const type = TYPES[info.type] ?? TYPES.ticket_general;
  const mins = Math.round((Date.now() - info.openedAt) / 60000);
  const dur = mins >= 1440 ? `${Math.round(mins / 1440)} día(s)` : mins >= 60 ? `${Math.round(mins / 60)} h` : `${mins} min`;
  await logEmbed(
    ch.guild,
    new EmbedBuilder()
      .setColor(0x64748b)
      .setAuthor({ name: "Ticket cerrado" })
      .setDescription(`\`#${ch.name}\` · ${type.emoji} ${type.label}\nAbierto por <@${info.userId}> · cerrado por <@${interaction.user.id}>\nDuró **${dur}** · **${count}** mensajes`),
  );
  setTimeout(() => ch.delete(`Ticket cerrado por ${interaction.user.username}`).catch((e) => log("borrar:", e.message)), 5000);
  log("cerrado", ch.name);
}

/** Devuelve true si la interacción era de tickets (y la atendió). */
export async function handleTicketButton(interaction) {
  if (!interaction.isButton()) return false;
  const id = interaction.customId;
  try {
    if (TYPES[id]) await openTicket(interaction);
    else if (id === "close_ticket") await askClose(interaction);
    else if (id === "close_ticket_yes") await closeTicket(interaction);
    else if (id === "close_ticket_no") await interaction.update({ content: "Listo, el ticket sigue abierto.", components: [] });
    else return false;
  } catch (err) {
    log("error:", err.message);
    const msg = `❌ No se pudo completar: ${err.message}`;
    if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
    else await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
  return true;
}
