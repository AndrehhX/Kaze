// Funciones de KAZE para PanBot:
//   /anime <nombre>   ficha de AniList con botón "Ver en KAZE" (con autocompletado)
//   /hoy              episodios que se estrenan hoy
//   /ruleta [género]  un anime al azar bien valorado
//   Estrenos del día  se publican solos cada mañana en #Anime-Chat
//   Anuncios          nueva versión de la APK (#Orunei-Updates) y salas de cine públicas (#Watch-Party)
//
// Configuración opcional en /opt/panbot/.env (ver .env.example). Estado en state.json (junto a este archivo).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, EmbedBuilder, Events, MediaGalleryBuilder,
  MessageFlags, SeparatorBuilder, SeparatorSpacingSize, SlashCommandBuilder, TextDisplayBuilder,
} from "discord.js";
import { estrenosPoster } from "./cards.mjs";
import { card, COLORS } from "./ui.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(DIR, "state.json");

const SITE = (process.env.KAZE_URL || "https://www.orunei.sbs").replace(/\/$/, "");
const TZ = process.env.KAZE_TZ || "America/Mexico_City";
const CH_ESTRENOS = process.env.CHANNEL_ESTRENOS_ID || "1573415250626089011"; // #Anime-Chat
const CH_UPDATES = process.env.CHANNEL_UPDATES_ID || "1573415038587240468"; // #Orunei-Updates
const CH_PARTY = process.env.CHANNEL_WATCHPARTY_ID || "1573415254350762026"; // #Watch-Party
const APP_VERSION_FILE = process.env.APP_VERSION_FILE || "/opt/orunei-web/shared/downloads/app-version.json";
const ESTRENOS_HOUR =Number(process.env.ESTRENOS_HOUR ?? 9); // hora local (KAZE_TZ) del resumen diario
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const COLOR = 0xa855f7; // morado de KAZE

const GENRES = {
  Action: "Acción", Adventure: "Aventura", Comedy: "Comedia", Drama: "Drama", Fantasy: "Fantasía", Horror: "Terror",
  "Mahou Shoujo": "Chicas mágicas", Mecha: "Mecha", Music: "Música", Mystery: "Misterio", Psychological: "Psicológico",
  Romance: "Romance", "Sci-Fi": "Ciencia ficción", "Slice of Life": "Recuentos de la vida", Sports: "Deportes",
  Supernatural: "Sobrenatural", Thriller: "Suspense", Ecchi: "Ecchi",
};
const STATUS = { RELEASING: "En emisión", FINISHED: "Finalizado", NOT_YET_RELEASED: "Próximamente", CANCELLED: "Cancelado", HIATUS: "En pausa" };
const FORMAT = { TV: "Serie TV", TV_SHORT: "Corto TV", MOVIE: "Película", SPECIAL: "Especial", OVA: "OVA", ONA: "ONA", MUSIC: "Musical" };
const SEASON = { WINTER: "Invierno", SPRING: "Primavera", SUMMER: "Verano", FALL: "Otoño" };

const log = (...a) => console.log("[kaze]", ...a);

// ── Estado persistente (qué se anunció ya) ───────────────────────────
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveState(s) {
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}
const state = loadState();

// ── AniList ─────────────────────────────────────────────────────────
const MEDIA_FIELDS = `id title { romaji english } coverImage { large color } bannerImage description(asHtml: false)
  averageScore popularity episodes status format season seasonYear genres isAdult siteUrl
  nextAiringEpisode { episode airingAt }`;

async function anilist(query, variables, tries = 2) {
  for (let i = 0; ; i++) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 429 && i < tries) {
      const wait = Math.min(Number(res.headers.get("retry-after") || 2), 10) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const json = await res.json();
    if (!res.ok || json.errors) throw new Error(json.errors?.[0]?.message || `AniList ${res.status}`);
    return json.data;
  }
}

const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, exp: Date.now() + ttlMs });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}

const titleOf = (m) => m.title.english || m.title.romaji || `Anime ${m.id}`;
const kazeUrl = (m) => `${SITE}/anime/${m.id}`;
const genreEs = (g) => GENRES[g] ?? g;
const colorOf = (m) => (m.coverImage?.color ? parseInt(m.coverImage.color.slice(1), 16) : COLOR);

function cleanDescription(d) {
  if (!d) return "";
  const text = d.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\(Source:[^)]*\)/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > 380 ? `${text.slice(0, 377).trimEnd()}…` : text;
}

async function searchAnime(q, perPage = 10) {
  return cached(`s:${q.toLowerCase()}:${perPage}`, 10 * 60_000, async () => {
    const d = await anilist(
      `query($q:String,$n:Int){ Page(perPage:$n){ media(search:$q, type:ANIME, isAdult:false, sort:[SEARCH_MATCH, POPULARITY_DESC]){ ${MEDIA_FIELDS} } } }`,
      { q, n: perPage },
    );
    return d.Page.media;
  });
}

async function animeById(id) {
  return cached(`id:${id}`, 30 * 60_000, async () => (await anilist(`query($id:Int){ Media(id:$id, type:ANIME){ ${MEDIA_FIELDS} } }`, { id })).Media);
}

function animeEmbed(m, kicker) {
  const e = new EmbedBuilder()
    .setColor(colorOf(m))
    .setTitle(titleOf(m))
    .setURL(kazeUrl(m))
    .setDescription(cleanDescription(m.description) || "AniList no tiene sinopsis.")
    .setThumbnail(m.coverImage?.large || null)
    .setFooter({ text: "KAZE · orunei.sbs · datos de AniList" });
  if (kicker) e.setAuthor({ name: kicker });
  const fields = [];
  if (m.averageScore) fields.push({ name: "Puntuación", value: `${m.averageScore}%`, inline: true });
  fields.push({ name: "Episodios", value: m.episodes ? String(m.episodes) : "—", inline: true });
  fields.push({ name: "Estado", value: STATUS[m.status] ?? "—", inline: true });
  const when = [m.season ? SEASON[m.season] : null, m.seasonYear].filter(Boolean).join(" ");
  fields.push({ name: "Formato", value: [FORMAT[m.format] ?? m.format, when].filter(Boolean).join(" · ") || "—", inline: true });
  if (m.genres?.length) fields.push({ name: "Géneros", value: m.genres.slice(0, 5).map(genreEs).join(", "), inline: true });
  if (m.nextAiringEpisode) fields.push({ name: "Próximo episodio", value: `Ep. ${m.nextAiringEpisode.episode} · <t:${m.nextAiringEpisode.airingAt}:R>`, inline: true });
  e.addFields(fields);
  if (m.bannerImage) e.setImage(m.bannerImage);
  return e;
}

const kazeButton = (m, label = "Ver en KAZE") => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(kazeUrl(m)).setEmoji("▶️");

// ── Fechas en la zona horaria del servidor de Discord ────────────────
function localParts(date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** Inicio y fin (unix) del día local actual en KAZE_TZ. */
function todayRange() {
  const now = Date.now();
  const { day } = localParts();
  // Buscar el instante UTC en que empieza "day" en la zona: probamos desplazamientos de -14 h a +14 h.
  let start = null;
  for (let h = -14; h <= 14; h++) {
    const guess = Date.parse(`${day}T00:00:00Z`) - h * 3600_000;
    if (localParts(new Date(guess)).day === day && localParts(new Date(guess - 3600_000)).day !== day) {
      start = guess;
      break;
    }
  }
  start ??= now - 12 * 3600_000;
  return { from: Math.floor(start / 1000), to: Math.floor(start / 1000) + 86400, day };
}

async function airingToday(minPopularity = 0) {
  const { from, to, day } = todayRange();
  return cached(`hoy:${day}:${minPopularity}`, 20 * 60_000, async () => {
    const out = [];
    for (let page = 1; page <= 4; page++) {
      const d = await anilist(
        `query($f:Int,$t:Int,$p:Int){ Page(page:$p, perPage:50){ pageInfo{ hasNextPage } airingSchedules(airingAt_greater:$f, airingAt_lesser:$t, sort:TIME){ episode airingAt media{ id title{ romaji english } isAdult popularity countryOfOrigin episodes coverImage{ extraLarge large color } } } } }`,
        { f: from - 1, t: to, p: page },
      );
      out.push(...d.Page.airingSchedules.filter((a) => a.media && !a.media.isAdult && (a.media.popularity ?? 0) >= minPopularity));
      if (!d.Page.pageInfo.hasNextPage) break;
    }
    return out;
  });
}

function estrenosEmbed(list, title) {
  // Los más populares (máx. 20), ordenados por hora.
  const top = [...list].sort((a, b) => (b.media.popularity ?? 0) - (a.media.popularity ?? 0)).slice(0, 20).sort((a, b) => a.airingAt - b.airingAt);
  const lines = top.map((a) => `<t:${a.airingAt}:t> · [${titleOf(a.media)}](${kazeUrl(a.media)}) · Ep. ${a.episode}`);
  const extra = list.length > top.length ? `\n\n…y ${list.length - top.length} más en el calendario.` : "";
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(title)
    .setURL(`${SITE}/calendario`)
    .setDescription(`${lines.join("\n")}${extra}`.slice(0, 4000))
    .setThumbnail(top[0]?.media.coverImage?.large || null)
    .setFooter({ text: "Horas en tu zona horaria · KAZE · orunei.sbs" });
}

/** "Martes 25 de noviembre" en la zona del server. */
function dateLabel(date = new Date()) {
  const t = new Intl.DateTimeFormat("es-MX", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(date).replace(",", "");
  return t[0].toUpperCase() + t.slice(1);
}
const hhmm = (unix) => new Intl.DateTimeFormat("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(unix * 1000));
const TZ_NAMES = { "America/Mexico_City": "Ciudad de México", "America/Lima": "Lima", "America/Bogota": "Bogotá", "America/Caracas": "Caracas", "Europe/Madrid": "Madrid" };

/**
 * Mensaje de estrenos con Components V2: póster con las portadas (los 12 más populares) y debajo la lista
 * con la hora de cada uno en la zona horaria de quien lo lee.
 */
async function estrenosMessage(list, title) {
  const popular = [...list].sort((a, b) => (b.media.popularity ?? 0) - (a.media.popularity ?? 0));
  const top = popular.slice(0, 12).sort((a, b) => a.airingAt - b.airingAt);
  const rest = popular.slice(12, 24).sort((a, b) => a.airingAt - b.airingAt);
  const png = await estrenosPoster({
    dateLabel: dateLabel(),
    total: list.length,
    tzLabel: `Horas de ${TZ_NAMES[TZ] ?? TZ} · en la lista de abajo salen en tu hora`,
    items: top.map((a) => ({
      title: titleOf(a.media),
      cover: a.media.coverImage?.extraLarge || a.media.coverImage?.large,
      color: a.media.coverImage?.color,
      episode: a.episode,
      time: hhmm(a.airingAt),
      last: !!(a.media.episodes && a.episode >= a.media.episodes),
    })),
  });
  const line = (a) => `<t:${a.airingAt}:t> · [${titleOf(a.media).replace(/[[\]]/g, "")}](${kazeUrl(a.media)}) · ep. ${a.episode}${a.media.episodes && a.episode >= a.media.episodes ? " 🏁" : ""}`;
  let listText = top.map(line).join("\n");
  if (rest.length) listText += `\n\n**También hoy**\n${rest.map(line).join("\n")}`;
  const more = list.length - top.length - rest.length;
  if (more > 0) listText += `\n-# …y ${more} más en el calendario.`;
  const container = new ContainerBuilder()
    .setAccentColor(COLOR)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n-# ${dateLabel()} · ${list.length} episodios · toca un título para verlo en KAZE`))
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems((i) => i.setURL("attachment://estrenos.png").setDescription(`Estrenos de hoy: ${top.map((a) => titleOf(a.media)).join(", ")}`.slice(0, 1000))))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(listText.slice(0, 3800)))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Calendario completo").setEmoji("📅").setURL(`${SITE}/calendario`),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Abrir KAZE").setEmoji("▶️").setURL(SITE),
      ),
    );
  return {
    components: [container],
    files: [new AttachmentBuilder(png, { name: "estrenos.png" })],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

// ── Ruleta ──────────────────────────────────────────────────────────
async function randomAnime(genre) {
  const vars = { g: genre ? [genre] : null };
  const filter = `type:ANIME, isAdult:false, averageScore_greater:69, popularity_greater:15000, format_in:[TV, MOVIE, ONA], genre_in:$g`;
  // AniList devuelve un "total" falso (siempre 5000), así que se guarda la lista real: los 200 más populares.
  const pool = await cached(`rt:${genre || "*"}`, 6 * 3600_000, async () => {
    const ids = [];
    for (let p = 1; p <= 4; p++) {
      const d = await anilist(`query($g:[String],$p:Int){ Page(page:$p, perPage:50){ pageInfo{ hasNextPage } media(${filter}, sort:POPULARITY_DESC){ id } } }`, { ...vars, p });
      ids.push(...d.Page.media.map((m) => m.id));
      if (!d.Page.pageInfo.hasNextPage) break;
    }
    return ids;
  });
  if (!pool.length) return null;
  return animeById(pool[Math.floor(Math.random() * pool.length)]);
}

async function ruletaReply(genre) {
  const m = await randomAnime(genre);
  if (!m) return { content: "No encontré nada con ese género. Prueba otro.", flags: MessageFlags.Ephemeral };
  const again = new ButtonBuilder().setCustomId(`kaze_ruleta:${genre || ""}`).setLabel("Otra").setEmoji("🎲").setStyle(ButtonStyle.Secondary);
  return {
    embeds: [animeEmbed(m, `🎲 Ruleta${genre ? ` · ${genreEs(genre)}` : ""}`)],
    components: [new ActionRowBuilder().addComponents(kazeButton(m), again)],
  };
}

// ── Comandos ────────────────────────────────────────────────────────
const COMMANDS = [
  new SlashCommandBuilder()
    .setName("anime")
    .setDescription("Busca un anime y te da su ficha con enlace a KAZE")
    .addStringOption((o) => o.setName("nombre").setDescription("Título en español, inglés, romaji o japonés").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName("hoy").setDescription("Episodios de anime que se estrenan hoy"),
  new SlashCommandBuilder()
    .setName("ruleta")
    .setDescription("Te recomiendo un anime al azar bien valorado")
    .addStringOption((o) =>
      o.setName("genero").setDescription("Género (opcional)").setRequired(false).addChoices(
        ...Object.entries(GENRES).filter(([k]) => k !== "Ecchi").map(([value, name]) => ({ name, value })),
      ),
    ),
].map((c) => c.toJSON());

async function handleInteraction(interaction) {
  try {
    if (interaction.isAutocomplete() && interaction.commandName === "anime") {
      const q = interaction.options.getFocused().trim();
      if (q.length < 2) return interaction.respond([]);
      const list = await searchAnime(q, 10).catch(() => []);
      return interaction.respond(
        list.map((m) => ({ name: `${titleOf(m)}${m.seasonYear ? ` (${m.seasonYear})` : ""}`.slice(0, 100), value: `id:${m.id}` })),
      );
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "anime") {
        await interaction.deferReply();
        const raw = interaction.options.getString("nombre", true).trim();
        const m = raw.startsWith("id:") ? await animeById(Number(raw.slice(3))) : (await searchAnime(raw, 1))[0];
        if (!m) return interaction.editReply(`No encontré ningún anime llamado **${raw.slice(0, 80)}**.`);
        return interaction.editReply({ embeds: [animeEmbed(m)], components: [new ActionRowBuilder().addComponents(kazeButton(m))] });
      }
      if (interaction.commandName === "hoy") {
        await interaction.deferReply();
        const list = await airingToday(0);
        if (!list.length) return interaction.editReply("Hoy no hay estrenos registrados en AniList.");
        try {
          return await interaction.editReply(await estrenosMessage(list, "📺 Estrenos de hoy"));
        } catch (e) {
          log("póster de /hoy:", e.message); // respaldo: el embed de siempre
          return interaction.editReply({ embeds: [estrenosEmbed(list, `📺 Estrenos de hoy · ${list.length} episodios`)] });
        }
      }
      if (interaction.commandName === "ruleta") {
        await interaction.deferReply();
        return interaction.editReply(await ruletaReply(interaction.options.getString("genero") || null));
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("kaze_ruleta:")) {
      await interaction.deferReply();
      return interaction.editReply(await ruletaReply(interaction.customId.split(":")[1] || null));
    }
  } catch (err) {
    log("error en interacción:", err.message);
    const msg = "AniList no responde ahora mismo. Prueba en un minuto.";
    if (interaction.isAutocomplete()) return interaction.respond([]).catch(() => {});
    if (interaction.deferred || interaction.replied) return interaction.editReply(msg).catch(() => {});
    return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

// ── Tareas automáticas ──────────────────────────────────────────────
async function send(client, channelId, payload) {
  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (!ch?.isTextBased()) throw new Error(`canal ${channelId} no disponible`);
  return ch.send(payload);
}

async function dailyEstrenos(client) {
  const { day, hour } = localParts();
  if (hour < ESTRENOS_HOUR || state.lastEstrenosDay === day) return;
  state.lastEstrenosDay = day; // se marca antes para no repetir si algo falla a medias
  saveState(state);
  const list = await airingToday(5000); // solo series con algo de público
  if (!list.length) return;
  try {
    await send(client, CH_ESTRENOS, await estrenosMessage(list, "☀️ ¡Buenos días! Esto se estrena hoy"));
  } catch (e) {
    log("póster de estrenos:", e.message); // respaldo: el embed de siempre
    await send(client, CH_ESTRENOS, { embeds: [estrenosEmbed(list, `☀️ Estrenos de hoy · ${list.length} episodios`)] });
  }
  log("estrenos del día publicados", day);
}

async function watchApk(client) {
  // Se lee el archivo directo en la VPS: Cloudflare guarda copias de /app-version.json durante horas
  // y PanBot veía la versión vieja. Si no está (otra máquina), se pide a la web saltándose la caché.
  let v;
  try {
    v = JSON.parse(fs.readFileSync(APP_VERSION_FILE, "utf8"));
  } catch {
    const res = await fetch(`${SITE}/app-version.json?t=${Date.now()}`, { signal: AbortSignal.timeout(10_000), headers: { "cache-control": "no-cache" } });
    if (!res.ok) return;
    v = await res.json();
  }
  if (!Number.isFinite(v.versionCode)) return;
  if (state.apkVersionCode == null) {
    state.apkVersionCode = v.versionCode; // primera vez: solo recordar, no anunciar
    saveState(state);
    return;
  }
  if (v.versionCode <= state.apkVersionCode) return;
  state.apkVersionCode = v.versionCode;
  saveState(state);
  await send(
    client,
    CH_UPDATES,
    card({
      accent: COLORS.purple,
      kicker: "KAZE para Android",
      title: `📱 Nueva versión ${v.versionName}`,
      thumbnail: `${SITE}/icon-512.png`,
      body: `${v.notes || "Mejoras y correcciones."}`.slice(0, 1500),
      extra: "**¿Cómo actualizo?** Descárgala e instálala encima de la que tienes: no pierdes nada. Si ya la tienes, la app te avisará sola.",
      footer: "KAZE · orunei.sbs",
      buttons: [
        { label: "Descargar APK", emoji: "⬇️", url: v.url || `${SITE}/kaze.apk` },
        { label: "Abrir la web", emoji: "🌐", url: SITE },
      ],
    }),
  );
  log("APK anunciada", v.versionName);
}

async function watchParties(client) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/watch_party_rooms?select=id,title,series_id,episode_id,created_at,host:profiles!watch_party_rooms_host_id_fkey(username,display_name,avatar_url)&invite_only=eq.false&ended_at=is.null&created_at=gt.${encodeURIComponent(since)}&order=created_at.asc&limit=5`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`salas: ${res.status}`);
  const rooms = await res.json();
  state.announcedRooms ??= [];
  for (const r of rooms) {
    if (state.announcedRooms.includes(r.id)) continue;
    state.announcedRooms = [...state.announcedRooms, r.id].slice(-200);
    saveState(state);
    const m = /^\d+$/.test(String(r.series_id)) ? await animeById(Number(r.series_id)).catch(() => null) : null;
    const host = r.host?.display_name || r.host?.username || "Alguien";
    await send(
      client,
      CH_PARTY,
      card({
        accent: m ? colorOf(m) : COLORS.rose,
        kicker: `🍿 ${host} abrió una sala de cine`,
        title: r.title || "Sala de cine",
        thumbnail: m?.coverImage?.large || r.host?.avatar_url || null,
        body: `${m ? `**${titleOf(m)}**` : "Anime"}${r.episode_id ? ` · episodio ${r.episode_id}` : ""}\nVelo en sincronía con chat en vivo. <t:${Math.floor(Date.parse(r.created_at) / 1000)}:R>`,
        image: m?.bannerImage || null,
        imageAlt: m ? titleOf(m) : "Sala de cine",
        footer: "Necesitas una cuenta de KAZE · las salas públicas se anuncian solas",
        buttons: [{ label: "Unirme a la sala", emoji: "🍿", url: `${SITE}/watch-parties/${r.id}` }],
      }),
    );
    log("sala anunciada", r.id);
  }
}

function every(ms, name, fn) {
  const run = () => fn().catch((e) => log(`${name}:`, e.message));
  setTimeout(run, 15_000);
  setInterval(run, ms);
}

// ── Registro ────────────────────────────────────────────────────────
/** Los comandos se registran todos juntos en panbot-service.mjs (registrar por partes borraría los demás). */
export const KAZE_COMMANDS = COMMANDS;

export function registerKazeFeatures(client) {
  client.on(Events.InteractionCreate, handleInteraction);
  client.once(Events.ClientReady, async () => {
    every(60_000, "estrenos", () => dailyEstrenos(client));
    every(15 * 60_000, "apk", () => watchApk(client));
    every(2 * 60_000, "salas", () => watchParties(client));
  });
}

// Para otros módulos (follows.mjs) y pruebas locales sin Discord.
export { estrenosMessage, airingToday, anilist, searchAnime, animeById, titleOf, kazeUrl, colorOf, kazeButton, SITE };
export const _test = { animeEmbed, estrenosEmbed, searchAnime, animeById, airingToday, randomAnime, todayRange, localParts, cleanDescription };
