// Registro de actividad del servidor en #Logs (solo staff):
// entradas (con aviso si la cuenta es muy nueva), salidas, expulsiones, baneos, aislamientos (timeout),
// cambios de roles y de apodo, y canales creados o borrados. Cuando se puede, dice quién lo hizo (registro de auditoría).
import { AuditLogEvent, EmbedBuilder, Events } from "discord.js";

const C = { join: 0x22c55e, leave: 0xef4444, mod: 0xf97316, roles: 0xa855f7, info: 0x64748b };
const log = (...a) => console.log("[logs]", ...a);
const DAY = 86400_000;
const ago = (ms) => {
  const d = Math.floor(ms / DAY);
  if (d >= 365) return `${Math.floor(d / 365)} año(s)`;
  if (d >= 30) return `${Math.floor(d / 30)} mes(es)`;
  if (d >= 1) return `${d} día(s)`;
  const h = Math.floor(ms / 3600_000);
  return h >= 1 ? `${h} hora(s)` : `${Math.max(1, Math.floor(ms / 60_000))} min`;
};
const who = (u) => (u ? `<@${u.id}> (\`${u.username}\`)` : "alguien");

/** Busca en el registro de auditoría quién hizo la acción (si fue en los últimos segundos). */
async function executor(guild, type, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    const e = logs.entries.find((x) => x.target?.id === targetId && Date.now() - x.createdTimestamp < 15_000);
    return e ? { by: e.executor, reason: e.reason } : null;
  } catch {
    return null;
  }
}

/** @param {import("discord.js").Client} client @param {{ guildId: string, channelId: string }} cfg */
export function registerLogs(client, cfg) {
  const send = async (embed) => {
    const ch = await client.channels.fetch(cfg.channelId).catch(() => null);
    if (!ch?.isTextBased()) return;
    await ch.send({ embeds: [embed.setTimestamp()], allowedMentions: { parse: [] } }).catch((e) => log(e.message));
  };
  const mine = (g) => g?.id === cfg.guildId;

  client.on(Events.GuildMemberAdd, async (m) => {
    if (!mine(m.guild)) return;
    const age = Date.now() - m.user.createdTimestamp;
    const e = new EmbedBuilder()
      .setColor(C.join)
      .setAuthor({ name: "Entró al servidor", iconURL: m.user.displayAvatarURL() })
      .setDescription(`${who(m.user)}\nCuenta creada hace **${ago(age)}** · ahora somos **${m.guild.memberCount}**`);
    if (age < 7 * DAY) e.addFields({ name: "⚠️ Cuenta nueva", value: "Tiene menos de 7 días. Puede ser una cuenta secundaria o de spam." });
    if (m.user.bot) e.addFields({ name: "🤖 Bot", value: "Es un bot." });
    await send(e);
  });

  client.on(Events.GuildMemberRemove, async (m) => {
    if (!mine(m.guild)) return;
    const kick = await executor(m.guild, AuditLogEvent.MemberKick, m.id);
    const roles = m.roles?.cache?.filter((r) => r.id !== m.guild.id).map((r) => r.name).slice(0, 12) ?? [];
    const e = new EmbedBuilder()
      .setColor(kick ? C.mod : C.leave)
      .setAuthor({ name: kick ? "Expulsado del servidor" : "Salió del servidor", iconURL: m.user?.displayAvatarURL() })
      .setDescription(`${who(m.user)}${m.joinedTimestamp ? `\nEstuvo **${ago(Date.now() - m.joinedTimestamp)}**` : ""}`);
    if (roles.length) e.addFields({ name: "Roles que tenía", value: roles.join(", ").slice(0, 1000) });
    if (kick) e.addFields({ name: "Por", value: `${who(kick.by)}${kick.reason ? ` · ${kick.reason}` : ""}` });
    await send(e);
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    if (!mine(ban.guild)) return;
    const ex = await executor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    const e = new EmbedBuilder().setColor(C.mod).setAuthor({ name: "Baneado", iconURL: ban.user.displayAvatarURL() }).setDescription(who(ban.user));
    if (ex) e.addFields({ name: "Por", value: who(ex.by), inline: true });
    if (ex?.reason || ban.reason) e.addFields({ name: "Motivo", value: (ex?.reason || ban.reason).slice(0, 1000), inline: true });
    await send(e);
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    if (!mine(ban.guild)) return;
    const ex = await executor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await send(new EmbedBuilder().setColor(C.info).setAuthor({ name: "Baneo retirado", iconURL: ban.user.displayAvatarURL() }).setDescription(`${who(ban.user)}${ex ? `\nPor ${who(ex.by)}` : ""}`));
  });

  client.on(Events.GuildMemberUpdate, async (before, after) => {
    if (!mine(after.guild) || before.partial) return;
    // Roles
    const added = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
    const removed = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));
    if (added.size || removed.size) {
      const ex = await executor(after.guild, AuditLogEvent.MemberRoleUpdate, after.id);
      const byBot = ex?.by?.id === client.user.id;
      const lines = [...added.map((r) => `➕ ${r.name}`), ...removed.map((r) => `➖ ${r.name}`)].join("\n");
      const e = new EmbedBuilder()
        .setColor(C.roles)
        .setAuthor({ name: "Roles cambiados", iconURL: after.user.displayAvatarURL() })
        .setDescription(`${who(after.user)}\n${lines}`.slice(0, 4000));
      if (ex && !byBot && ex.by?.id !== after.id) e.addFields({ name: "Por", value: who(ex.by) });
      if (byBot) e.setFooter({ text: "Por PanBot (botones de roles o niveles)" });
      await send(e);
    }
    // Apodo
    if (before.nickname !== after.nickname) {
      await send(
        new EmbedBuilder()
          .setColor(C.info)
          .setAuthor({ name: "Apodo cambiado", iconURL: after.user.displayAvatarURL() })
          .setDescription(`${who(after.user)}\n\`${before.nickname ?? "(sin apodo)"}\` → \`${after.nickname ?? "(sin apodo)"}\``),
      );
    }
    // Aislamiento (timeout)
    const t0 = before.communicationDisabledUntilTimestamp ?? 0, t1 = after.communicationDisabledUntilTimestamp ?? 0;
    if (t0 !== t1) {
      const ex = await executor(after.guild, AuditLogEvent.MemberUpdate, after.id);
      const on = t1 > Date.now();
      const e = new EmbedBuilder()
        .setColor(on ? C.mod : C.info)
        .setAuthor({ name: on ? "Aislado (timeout)" : "Aislamiento retirado", iconURL: after.user.displayAvatarURL() })
        .setDescription(`${who(after.user)}${on ? `\nHasta <t:${Math.floor(t1 / 1000)}:f> (<t:${Math.floor(t1 / 1000)}:R>)` : ""}`);
      if (ex) e.addFields({ name: "Por", value: `${who(ex.by)}${ex.reason ? ` · ${ex.reason}` : ""}` });
      await send(e);
    }
  });

  client.on(Events.ChannelCreate, async (ch) => {
    if (!mine(ch.guild)) return;
    const ex = await executor(ch.guild, AuditLogEvent.ChannelCreate, ch.id);
    if (ex?.by?.id === client.user.id) return; // los tickets los crea el bot: no hace falta registrarlos
    await send(new EmbedBuilder().setColor(C.info).setAuthor({ name: "Canal creado" }).setDescription(`<#${ch.id}> (\`${ch.name}\`)${ex ? `\nPor ${who(ex.by)}` : ""}`));
  });

  client.on(Events.ChannelDelete, async (ch) => {
    if (!mine(ch.guild)) return;
    const ex = await executor(ch.guild, AuditLogEvent.ChannelDelete, ch.id);
    if (ex?.by?.id === client.user.id && ch.name.startsWith("ticket-")) return;
    await send(new EmbedBuilder().setColor(C.leave).setAuthor({ name: "Canal borrado" }).setDescription(`\`#${ch.name}\`${ex ? `\nPor ${who(ex.by)}` : ""}`));
  });

  log("registro de actividad activo");
}
