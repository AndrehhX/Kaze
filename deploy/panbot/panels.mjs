// Paneles del servidor (reglas, roles, niveles y tickets) con cabecera animada en pixel art.
// Uso en la VPS:
//   node panels.mjs preview            genera las cabeceras en /tmp/panel-*.gif para revisarlas
//   node panels.mjs publish [clave…]   publica los paneles y, si salió bien, borra los mensajes
//                                      anteriores de PanBot en ese canal (los paneles viejos/duplicados)
// Los botones mantienen los mismos identificadores, así que siguen funcionando con panbot-service.mjs.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { headerGif } from "./pixel.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(DIR, ".env"));
} catch {}
const TOKEN = process.env.DISCORD_TOKEN;
const API = "https://discord.com/api/v10";
const PINK = 0xf3a9c0;
const CH = { comandos: "1556526366864707604", media: "1573427196515717191", anime: "1573415250626089011", general: "1573861292119298209" };

const btn = (custom_id, label, emoji, style) => ({ type: 2, custom_id, label, emoji: { name: emoji }, style });

export const PANELS = {
  rules: {
    channel: "1556896259846045766",
    header: { title: "Reglas", subtitle: "Lee antes de participar", tab: "Normas" },
    embed: {
      title: "📜 Normas de Pan con mantequilla",
      description: "Para que esto siga siendo un buen lugar para todos los panas:",
      fields: [
        { name: "1 ✦ Respeto y cero toxicidad", value: "El bardo sano y las bromas entre cuates son bienvenidos; el acoso, las amenazas, el doxxing o la discriminación son ban inmediato." },
        { name: "2 ✦ Nada de spam ni promoción", value: "No envíes enlaces no pedidos ni hagas publicidad de otros servidores, ni en los canales ni por privado a los miembros." },
        { name: "3 ✦ Spoilers siempre ocultos", value: "Usa `||texto||` para los spoilers de animes, mangas o juegos recientes. Respeta a quien va al día." },
        { name: "4 ✦ Cada cosa en su canal", value: `Comandos en <#${CH.comandos}>, memes y clips en <#${CH.media}>, anime en <#${CH.anime}>.` },
        { name: "5 ✦ Sanciones", value: "Saltarse las normas lleva a advertencia, aislamiento temporal, expulsión o baneo, según lo grave que sea." },
      ],
      footer: { text: "Staff de Pan con mantequilla · Al participar aceptas estas normas" },
    },
  },
  roles: {
    channel: "1573415025836826658",
    header: { title: "Roles", subtitle: "Elige tus notificaciones", tab: "Auto-roles" },
    embed: {
      title: "🔔 Elige tus roles",
      description: "Pulsa un botón para **ponerte o quitarte** el rol. Solo te llegarán los avisos que elijas.",
      fields: [
        { name: "📢 Notificaciones", value: "🚀 **Orunei Updates** · novedades de orunei.sbs y de la app\n🎉 **Watch Party** · cuando abrimos salas de cine\n🎁 **Ofertas Gratis** · juegos gratis en Steam y Epic\n📢 **Avisos** · anuncios importantes del server" },
        { name: "🎮 Intereses", value: "📺 **Anime** · debates de la temporada\n🎮 **Juegos** · buscar partida\n🌟 **Beta Tester KAZE** · probar versiones nuevas de la app antes que nadie" },
      ],
      footer: { text: "Un clic para ponértelo, otro para quitártelo" },
    },
    components: [
      { type: 1, components: [btn("role_1573416800014704661", "Orunei Updates", "🚀", 1), btn("role_1573416802812428378", "Watch Party", "🎉", 1), btn("role_1556541196677939274", "Ofertas Gratis", "🎁", 1), btn("role_1556896713501974579", "Avisos", "📢", 1)] },
      { type: 1, components: [btn("role_1556896537806643281", "Anime", "📺", 2), btn("role_1556896650901848115", "Juegos", "🎮", 2), btn("role_1573416770864418817", "Beta Tester KAZE", "🌟", 3)] },
    ],
  },
  levels: {
    channel: "1573415019801223350",
    header: { title: "Niveles", subtitle: "Chatea, sube, desbloquea", tab: "Rangos" },
    embed: {
      title: "🔰 Sistema de niveles",
      description: `Ganas **XP al escribir** (una vez por minuto: el spam no cuenta) y **al estar en llamada** con más gente. Cuando subes de nivel, PanBot lo anuncia en <#${CH.general}>.`,
      fields: [
        { name: "🥉 Nivel 5+ · Bronce", value: "Permisos para enviar imágenes y enlaces.", inline: true },
        { name: "🥈 Nivel 15+ · Plata", value: "Color plateado y emojis externos.", inline: true },
        { name: "​", value: "​", inline: true },
        { name: "🥇 Nivel 30+ · Oro", value: "Veterano destacado en la lista de miembros.", inline: true },
        { name: "💎 Nivel 50+ · Diamante", value: "El rango máximo del server.", inline: true },
        { name: "​", value: "​", inline: true },
        { name: "📊 Tu nivel", value: `Usa \`/nivel\` para ver tu tarjeta y \`/top\` para el ranking, en <#${CH.comandos}>.` },
      ],
      footer: { text: "Los rangos se dan solos al llegar al nivel" },
    },
  },
  tickets: {
    channel: "1573415030857404446",
    header: { title: "Tickets", subtitle: "Soporte y reportes", tab: "Ayuda", palette: "lilac" },
    embed: {
      title: "🎫 Soporte de Pan con mantequilla y Orunei",
      description: "¿Algo no va en **orunei.sbs** o en la app **KAZE**, o necesitas hablar con el staff? Abre un ticket: se crea un canal privado solo para ti y el staff.",
      fields: [
        { name: "📩 Soporte general", value: "Dudas del servidor, alianzas o consultas al staff." },
        { name: "🐛 Reportar bug de Orunei", value: "Fallos del reproductor, capítulos caídos o problemas en la app." },
        { name: "💡 Sugerencias", value: "Animes que falten o funciones que te gustaría ver en la web." },
      ],
      footer: { text: "Cuando termines, cierra el ticket con el botón 🔒" },
    },
    components: [{ type: 1, components: [btn("ticket_general", "Soporte", "📩", 1), btn("ticket_bug", "Reportar bug", "🐛", 4), btn("ticket_suggestion", "Sugerencia", "💡", 3)] }],
  },
};

async function api(method, url, body) {
  for (;;) {
    const res = await fetch(`${API}${url}`, { method, headers: { Authorization: `Bot ${TOKEN}`, ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
    if (res.status === 429) {
      const j = await res.json().catch(() => ({}));
      await new Promise((r) => setTimeout(r, Math.ceil((j.retry_after ?? 1) * 1000) + 100));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? null : res.json();
  }
}

async function publish(key) {
  const p = PANELS[key];
  const me = await api("GET", "/users/@me");
  // Solo los paneles anteriores (mensajes de PanBot con la cabecera panel.gif), nunca los avisos de nivel ni otros mensajes.
  const before = (await api("GET", `/channels/${p.channel}/messages?limit=100`)).filter(
    (m) => m.author.id === me.id && m.attachments?.some((a) => a.filename === "panel.gif"),
  );
  const gif = await headerGif(p.header);
  const form = new FormData();
  const payload = { embeds: [{ ...p.embed, color: PINK, image: { url: "attachment://panel.gif" } }], components: p.components ?? [], attachments: [{ id: 0, filename: "panel.gif" }] };
  form.append("payload_json", JSON.stringify(payload));
  form.append("files[0]", new Blob([gif], { type: "image/gif" }), "panel.gif");
  const msg = await api("POST", `/channels/${p.channel}/messages`, form);
  console.log(`✔ ${key}: publicado ${msg.id}`);
  for (const old of before) {
    await api("DELETE", `/channels/${p.channel}/messages/${old.id}`);
    console.log(`  borrado el panel anterior ${old.id}`);
  }
  if (p.pin) await api("PUT", `/channels/${p.channel}/pins/${msg.id}`).catch((e) => console.log("  no se pudo fijar:", e.message));
  // Registro aparte de state.json: el bot reescribe state.json desde memoria y borraría esta clave.
  const stateFile = path.join(DIR, "panels.json");
  const state = (() => {
    try {
      return JSON.parse(fs.readFileSync(stateFile, "utf8"));
    } catch {
      return {};
    }
  })();
  state[key] = { channel: p.channel, message: msg.id };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

const [cmd, ...keys] = process.argv.slice(2);
if (cmd === "preview") {
  for (const [k, p] of Object.entries(PANELS)) fs.writeFileSync(`/tmp/panel-${k}.gif`, await headerGif(p.header));
  console.log("Cabeceras en /tmp/panel-*.gif");
} else if (cmd === "publish") {
  if (!TOKEN) throw new Error("Falta DISCORD_TOKEN");
  for (const k of keys.length ? keys : Object.keys(PANELS)) await publish(k);
} else if (cmd) {
  console.log("Uso: node panels.mjs preview | publish [rules roles levels tickets]");
}
