// Tarjetas de anuncio con Components V2 (el diseño nuevo de Discord: contenedor con borde de color).
// Todos los avisos de PanBot usan esto para verse iguales: título, texto, miniatura opcional,
// imagen grande opcional (portada, GIF o banner), nota pequeña al pie y botones de enlace.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MessageFlags,
  SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, ThumbnailBuilder,
} from "discord.js";

export const COLORS = { purple: 0xa855f7, pink: 0xf3a9c0, butter: 0xfde047, red: 0xef4444, green: 0x22c55e, rose: 0xf43f5e, blue: 0x3b82f6 };

/**
 * @param {{
 *   accent?: number, kicker?: string, title?: string, body?: string, thumbnail?: string | null,
 *   image?: string | null, imageAlt?: string, extra?: string, footer?: string,
 *   buttons?: { label: string, url: string, emoji?: string }[], files?: any[], mentions?: object,
 * }} o  image/thumbnail aceptan "attachment://archivo.png" o una URL.
 */
export function card(o) {
  const c = new ContainerBuilder().setAccentColor(o.accent ?? COLORS.purple);
  const head = [o.kicker ? `-# ${o.kicker}` : null, o.title ? `## ${o.title}` : null, o.body || null].filter(Boolean).join("\n").slice(0, 3900) || "​";
  if (o.thumbnail) {
    c.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(head)).setThumbnailAccessory(new ThumbnailBuilder().setURL(o.thumbnail)),
    );
  } else c.addTextDisplayComponents(new TextDisplayBuilder().setContent(head));
  if (o.image) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems((i) => i.setURL(o.image).setDescription((o.imageAlt || o.title || "Imagen").slice(0, 1000))));
  if (o.extra) {
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(o.extra.slice(0, 3900)));
  }
  if (o.footer) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${o.footer}`.slice(0, 500)));
  const btns = (o.buttons ?? []).filter((b) => b?.url).slice(0, 5);
  if (btns.length) {
    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        btns.map((b) => {
          const x = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label.slice(0, 80)).setURL(b.url);
          return b.emoji ? x.setEmoji(b.emoji) : x;
        }),
      ),
    );
  }
  return {
    components: [c],
    flags: MessageFlags.IsComponentsV2,
    files: o.files ?? [],
    allowedMentions: o.mentions ?? { parse: [] },
  };
}
