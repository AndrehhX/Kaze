// Genera los SVG del README con el estilo de la web (tema Midnight).
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Doc, C, icon, r } from "./lib.mjs";

// Por defecto escribe en docs/readme (dos carpetas arriba).
const OUT = process.argv[2] ?? fileURLToPath(new URL("../../docs/readme/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const save = (name, doc) => {
  const s = doc.toString();
  writeFileSync(join(OUT, name), s);
  console.log(name.padEnd(26), (s.length / 1024).toFixed(1), "KB");
};

/** Fondo de tarjeta con brillo suave, rejilla de puntos y borde. */
function card(doc, { w, h, glowA = C.primary, glowB = C.pink, gx = 0.85, gy = 0.1, id = "c", radius = 24, grid = true }) {
  doc.def(
    `<radialGradient id="${id}gA" cx="${gx}" cy="${gy}" r="0.75"><stop offset="0" stop-color="${glowA}" stop-opacity="0.30"/><stop offset="0.55" stop-color="${glowA}" stop-opacity="0.05"/><stop offset="1" stop-color="${glowA}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${id}gB" cx="${1 - gx}" cy="${1 - gy}" r="0.6"><stop offset="0" stop-color="${glowB}" stop-opacity="0.16"/><stop offset="1" stop-color="${glowB}" stop-opacity="0"/></radialGradient>`,
    `<pattern id="${id}dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ffffff" fill-opacity="0.07"/></pattern>`,
    `<linearGradient id="${id}fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0.2"/></linearGradient>`,
    `<mask id="${id}mask"><rect width="${w}" height="${h}" fill="url(#${id}fade)"/></mask>`,
    `<clipPath id="${id}clip"><rect width="${w}" height="${h}" rx="${radius}"/></clipPath>`,
  );
  doc.add(
    `<g clip-path="url(#${id}clip)"><rect width="${w}" height="${h}" fill="${C.bg}"/><rect width="${w}" height="${h}" fill="url(#${id}gA)"/><rect width="${w}" height="${h}" fill="url(#${id}gB)"/>${grid ? `<rect width="${w}" height="${h}" fill="url(#${id}dots)" mask="url(#${id}mask)"/>` : ""}`,
  );
}
const endCard = (doc, { w, h, id = "c", radius = 24, accent = true }) => {
  if (accent) {
    doc.def(`<linearGradient id="${id}bar" x1="0" x2="1"><stop offset="0" stop-color="${C.primary}"/><stop offset="0.55" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>`);
    doc.add(`<rect y="${h - 3}" width="${w}" height="3" fill="url(#${id}bar)"/>`);
  }
  doc.add(`</g><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${radius - 0.5}" fill="none" stroke="${C.line}"/>`);
};
/** Líneas de viento (風 = viento). */
const wind = (doc, id, lines, color = C.pink) => {
  doc.def(`<linearGradient id="${id}w" x1="0" x2="1"><stop offset="0" stop-color="${color}" stop-opacity="0"/><stop offset="0.5" stop-color="${color}" stop-opacity="0.75"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>`);
  for (const [d, wdt, op] of lines) doc.add(`<path d="${d}" fill="none" stroke="url(#${id}w)" stroke-width="${wdt}" stroke-linecap="round" opacity="${op}"/>`);
};
/** Etiqueta en mayúsculas espaciadas, como las de la web. */
const label = (doc, str, x, y, color = C.ink, size = 13) => doc.text(str.toUpperCase(), { x, y, f: "label", size, ls: 0.16, fill: color });
/** Píldora con borde. */
function chip(doc, str, x, y, { color = C.muted, stroke = C.line, f = "mono", size = 12, h = 30, padX = 14, bg = "rgba(18,18,31,0.85)" } = {}) {
  const w = doc.measure(str, { f, size, ls: 0.06 }) + padX * 2;
  doc.add(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${h}" rx="${h / 2}" fill="${bg}" stroke="${stroke}"/>`);
  doc.text(str, { x: x + padX, y: y + h / 2 + size * 0.36, f, size, ls: 0.06, fill: color });
  return w;
}

// ───────────────────────── Cabecera ─────────────────────────
{
  const W = 1280, H = 440;
  const d = new Doc(W, H, "KAZE · 風 — Plataforma de anime y manga en español");
  card(d, { w: W, h: H, id: "h", gx: 0.82, gy: 0.18 });
  d.def(
    `<linearGradient id="kStroke" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.primary}"/><stop offset="0.6" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>`,
    `<linearGradient id="kFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.primary}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.pink}" stop-opacity="0.02"/></linearGradient>`,
    `<linearGradient id="word" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9c2ff"/></linearGradient>`,
  );
  // Kanji 風 gigante a la derecha.
  d.textPath("風", { x: 1068, y: 392, f: "mincho", size: 380, anchor: "middle", attrs: `fill="url(#kFill)"` });
  d.textPath("風", { x: 1068, y: 392, f: "mincho", size: 380, anchor: "middle", attrs: `fill="none" stroke="url(#kStroke)" stroke-width="1.6" opacity="0.85"` });
  wind(d, "h", [
    ["M -40 300 C 260 240, 520 330, 820 262 S 1180 190, 1330 236", 2, 0.55],
    ["M -40 336 C 300 290, 560 368, 880 304 S 1200 250, 1330 284", 1.2, 0.35],
    ["M 380 120 C 620 70, 860 150, 1100 92 S 1260 70, 1330 84", 1, 0.25],
  ]);
  // Estado y dominio.
  const pw = d.measure("EN PRODUCCIÓN · ORUNEI.SBS", { f: "mono", size: 12, ls: 0.08 });
  const px = W - 44 - pw;
  d.add(`<rect x="${r(px - 30)}" y="34" width="${r(pw + 48)}" height="30" rx="15" fill="rgba(8,8,16,0.75)" stroke="${C.lineSoft}"/>`);
  d.add(`<circle cx="${r(px - 14)}" cy="49" r="4" fill="#3ee08f"/><circle cx="${r(px - 14)}" cy="49" r="8" fill="#3ee08f" opacity="0.18"/>`);
  d.text("EN PRODUCCIÓN · ORUNEI.SBS", { x: px, y: 53.5, f: "mono", size: 12, ls: 0.08, fill: C.muted });
  // Texto principal.
  d.add(`<rect x="72" y="66" width="8" height="8" rx="1.5" fill="${C.pink}"/>`);
  label(d, "Orunei · Plataforma de anime y manga", 92, 75, C.ink, 13);
  d.textPath("KAZE", { x: 66, y: 222, f: "display", size: 148, ls: -0.035, attrs: `fill="url(#word)"` });
  const kw = d.measure("KAZE", { f: "display", size: 148, ls: -0.035 });
  d.text("風", { x: 66 + kw + 22, y: 214, f: "mincho", size: 54, fill: C.pink });
  d.text("アニメ・マンガ・コミュニティ", { x: 72, y: 262, f: "jp", size: 17, ls: 0.12, fill: C.muted });
  d.text("Ver, leer y compartir anime en español.", { x: 72, y: 312, f: "displayMid", size: 27, ls: -0.01, fill: C.text });
  d.text("Web en Next.js 16 y app Android nativa con una sola cuenta, sincronizadas en tiempo real.", { x: 72, y: 342, f: "body", size: 16, fill: C.muted });
  let cx = 72;
  for (const t of ["NEXT.JS 16", "REACT 19", "KOTLIN · COMPOSE", "SUPABASE", "CLOUDFLARE"]) cx += chip(d, t, cx, 372) + 10;
  endCard(d, { w: W, h: H, id: "h" });
  save("hero.svg", d);
}

// ───────────────────────── Botones ─────────────────────────
const buttons = [
  ["btn-web.svg", "globe", "Abrir la web", "www.orunei.sbs", true],
  ["btn-apk.svg", "download", "Descargar la app", "Android · APK 0.3.0", false],
  ["btn-docs.svg", "book", "Documentación", "Arquitectura y despliegue", false],
];
for (const [file, ic, title, sub, primary] of buttons) {
  const W = 400, H = 88;
  const d = new Doc(W, H, `${title} — ${sub}`);
  d.def(
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9333ea"/><stop offset="1" stop-color="#6d5ef8"/></linearGradient>`,
    `<linearGradient id="ic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.primary}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.pink}" stop-opacity="0.18"/></linearGradient>`,
  );
  d.add(
    primary
      ? `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="20" fill="url(#bg)"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.18"/>`
      : `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="20" fill="${C.surface}" stroke="${C.line}"/>`,
  );
  d.add(`<rect x="18" y="18" width="52" height="52" rx="15" fill="${primary ? "rgba(255,255,255,0.16)" : "url(#ic)"}"/>`);
  d.add(icon(ic, 32, 32, 24, primary ? "#ffffff" : C.ink));
  d.text(title, { x: 88, y: 43, f: "display", size: 22, ls: -0.02, fill: "#ffffff" });
  d.text(sub, { x: 88, y: 66, f: "mono", size: 13, ls: 0.02, fill: primary ? "rgba(255,255,255,0.78)" : C.muted });
  d.add(icon("arrow", W - 50, 32, 22, primary ? "#ffffff" : C.dim));
  save(file, d);
}

// ───────────────────────── Tarjetas de funciones ─────────────────────────
const features = [
  ["feature-anime.svg", "tv", "01", "Anime", "アニメ", "Catálogo y reproductor", C.primary, [
    "Catálogo de AniList con filtros, temporadas y calendario",
    "Reproductor HLS con salto de opening y ending",
    "Progreso por episodio compartido entre web y app",
  ]],
  ["feature-manga.svg", "book", "02", "Manga", "マンガ", "Lector de manga", C.pink, [
    "Capítulos en español e inglés vía MangaDex",
    "Modo libro de derecha a izquierda y tira vertical",
    "Puente anime → manga: dónde seguir la historia",
  ]],
  ["feature-social.svg", "users", "03", "Comunidad", "コミュニティ", "Social en tiempo real", C.cyan, [
    "Perfiles, logros, reseñas y comentarios por episodio",
    "Watch parties sincronizadas con chat en vivo",
    "KAZE Wrapped: el resumen de tu año en anime",
  ]],
  ["feature-android.svg", "phone", "04", "Android", "アプリ", "App nativa", C.gold, [
    "Kotlin, Jetpack Compose, Hilt, Room y Media3",
    "La misma cuenta y los mismos datos que la web",
    "Se actualiza sola: avisa cuando hay nueva versión",
  ]],
];
for (const [file, ic, num, kicker, jp, title, accent, bullets] of features) {
  const W = 640, H = 330;
  const d = new Doc(W, H, `${kicker} — ${title}`);
  card(d, { w: W, h: H, id: "f", glowA: accent, glowB: C.indigo, gx: 0.95, gy: 0.0, radius: 22 });
  d.def(`<linearGradient id="fi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.32"/><stop offset="1" stop-color="${accent}" stop-opacity="0.08"/></linearGradient>`);
  // Número en contorno, como .k-outline-num de la web.
  d.textPath(num, { x: W - 40, y: 118, f: "display", size: 96, ls: -0.04, anchor: "end", attrs: `fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.45"` });
  d.add(`<rect x="40" y="40" width="56" height="56" rx="16" fill="url(#fi)" stroke="${accent}" stroke-opacity="0.35"/>`);
  d.add(icon(ic, 54, 54, 28, accent));
  const lw = d.measure(kicker.toUpperCase(), { f: "label", size: 13, ls: 0.16 });
  label(d, kicker, 40, 140, accent, 13);
  d.text(jp, { x: 40 + lw + 12, y: 140, f: "jp", size: 13, ls: 0.08, fill: C.dim });
  d.text(title, { x: 40, y: 180, f: "display", size: 36, ls: -0.03, fill: C.text });
  bullets.forEach((b, i) => {
    const y = 224 + i * 32;
    d.add(`<rect x="41" y="${y - 10}" width="8" height="8" rx="1.5" fill="${accent}" opacity="0.9"/>`);
    d.text(b, { x: 62, y, f: "body", size: 18.5, fill: "#bdb9d8" });
  });
  endCard(d, { w: W, h: H, id: "f", radius: 22, accent: false });
  d.body.splice(d.body.length - 1, 0, `<rect x="40" y="${H - 3}" width="120" height="3" rx="1.5" fill="${accent}"/>`);
  save(file, d);
}

// ───────────────────────── Cifras ─────────────────────────
{
  const W = 1280, H = 168;
  const d = new Doc(W, H, "KAZE en cifras");
  card(d, { w: W, h: H, id: "s", gx: 0.5, gy: -0.2, grid: false });
  d.def(`<linearGradient id="num" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${C.ink}"/></linearGradient>`);
  const stats = [
    ["2", "Plataformas", "Web y Android", "二"],
    ["4", "Temas visuales", "Midnight · Sakura · Cyber · Zen", "四"],
    ["36", "Tablas con RLS", "PostgreSQL en Supabase", "表"],
    ["113", "Pruebas", "Vitest · PGlite · Playwright", "検"],
  ];
  const colW = W / stats.length;
  stats.forEach(([n, t, s, k], i) => {
    const x0 = i * colW;
    if (i) d.add(`<line x1="${x0}" y1="36" x2="${x0}" y2="${H - 36}" stroke="${C.lineSoft}"/>`);
    d.text(k, { x: x0 + colW - 34, y: 56, f: "mincho", size: 22, anchor: "end", fill: C.primary, opacity: 0.35 });
    d.textPath(n, { x: x0 + 44, y: 96, f: "display", size: 58, ls: -0.04, attrs: `fill="url(#num)"` });
    d.text(t, { x: x0 + 46, y: 124, f: "bodyMid", size: 16, fill: C.text });
    d.text(s, { x: x0 + 46, y: 146, f: "body", size: 13, fill: C.dim });
  });
  endCard(d, { w: W, h: H, id: "s", accent: false });
  save("stats.svg", d);
}

// ───────────────────────── Arquitectura ─────────────────────────
{
  const W = 1280, H = 700;
  const d = new Doc(W, H, "Arquitectura de KAZE: clientes, Cloudflare, VPS, Supabase y servicios externos");
  card(d, { w: W, h: H, id: "a", gx: 0.5, gy: 0.0 });
  d.def(
    `<marker id="ar" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" fill="${C.ink}"/></marker>`,
    `<marker id="arP" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" fill="${C.pink}"/></marker>`,
    `<marker id="arC" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" fill="${C.cyan}"/></marker>`,
  );
  // Encabezado.
  label(d, "Arquitectura", 48, 62, C.ink, 13);
  d.text("構成", { x: 48 + d.measure("ARQUITECTURA", { f: "label", size: 13, ls: 0.16 }) + 12, y: 62, f: "jp", size: 13, fill: C.dim });
  d.text("Cómo viaja una petición en producción", { x: 48, y: 98, f: "display", size: 28, ls: -0.03, fill: C.text });
  // Leyenda.
  const lx = 860;
  d.add(`<line x1="${lx}" y1="86" x2="${lx + 34}" y2="86" stroke="${C.ink}" stroke-width="2"/>`);
  d.text("Web y API", { x: lx + 44, y: 90.5, f: "body", size: 13, fill: C.muted });
  d.add(`<line x1="${lx + 140}" y1="86" x2="${lx + 174}" y2="86" stroke="${C.pink}" stroke-width="2" stroke-dasharray="6 5"/>`);
  d.text("Video HLS", { x: lx + 184, y: 90.5, f: "body", size: 13, fill: C.muted });
  d.add(`<line x1="${lx + 270}" y1="86" x2="${lx + 304}" y2="86" stroke="${C.cyan}" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/>`);
  d.text("Datos", { x: lx + 314, y: 90.5, f: "body", size: 13, fill: C.muted });

  const box = (x, y, w, h, { title, sub, color = C.ink, fill = C.surface, stroke = C.line, rx = 14, titleSize = 17 }) => {
    d.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`);
    if (title) d.text(title, { x: x + 18, y: y + 30, f: "display", size: titleSize, ls: -0.02, fill: C.text });
    if (sub) d.text(sub, { x: x + 18, y: y + 52, f: "mono", size: 11.5, ls: 0.02, fill: color });
  };
  const group = (x, y, w, h, name, tag, color) => {
    d.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="rgba(27,27,44,0.45)" stroke="${color}" stroke-opacity="0.35" stroke-dasharray="4 6"/>`);
    label(d, name, x + 18, y + 28, color, 12);
    if (tag) d.text(tag, { x: x + w - 18, y: y + 28, f: "mono", size: 11, anchor: "end", fill: C.dim });
  };
  const arrow = (dd, color = C.ink, marker = "ar", dash = "") =>
    d.add(`<path d="${dd}" fill="none" stroke="${color}" stroke-width="1.8"${dash ? ` stroke-dasharray="${dash}"` : ""} marker-end="url(#${marker})" stroke-linejoin="round"/>`);
  const tag = (str, x, y, color = C.muted) => {
    const w = d.measure(str, { f: "mono", size: 11, ls: 0.02 }) + 14;
    d.add(`<rect x="${r(x - w / 2)}" y="${y - 13}" width="${r(w)}" height="20" rx="10" fill="${C.bg}" stroke="${C.lineSoft}"/>`);
    d.text(str, { x, y: y + 1, f: "mono", size: 11, ls: 0.02, anchor: "middle", fill: color });
  };

  // Columna 1: clientes.
  group(40, 140, 230, 350, "Clientes", "", C.ink);
  box(58, 186, 194, 120, { title: "Navegador", sub: "Next.js · hls.js" });
  d.add(icon("globe", 214, 202, 20, C.ink));
  box(58, 334, 194, 120, { title: "App Android", sub: "Kotlin · Media3" });
  d.add(icon("phone", 214, 350, 20, C.ink));
  d.text("PWA + APK propia", { x: 76, y: 290, f: "body", size: 12.5, fill: C.dim });
  d.text("orunei.sbs/kaze.apk", { x: 76, y: 438, f: "body", size: 12.5, fill: C.dim });

  // Columna 2: Cloudflare.
  group(330, 140, 280, 350, "Cloudflare", "borde", "#f6821f");
  box(348, 186, 244, 120, { title: "DNS · Caché · WAF", sub: "proxy + reglas de caché", color: "#f6a25a" });
  d.text("HTML en caché hasta 4 h", { x: 366, y: 290, f: "body", size: 12.5, fill: C.dim });
  box(348, 334, 244, 120, { title: "Worker orunei-stream", sub: "proxy HLS · CORS", color: C.pink });
  d.text("reparte 1 de cada 2 trozos", { x: 366, y: 438, f: "body", size: 12.5, fill: C.dim });

  // Columna 3: VPS.
  group(670, 140, 300, 350, "VPS · Ubuntu", "1 vCPU · 2 GB", C.primary);
  const rows = [
    ["Caddy", "entrada · solo IPs de Cloudflare"],
    ["Next.js 16 standalone", "systemd · vuelta atrás automática"],
    ["kaze-resolver + Redis", "PM2 · busca el video"],
    ["Proxy de segmentos", "HMAC · 50 % del video"],
  ];
  rows.forEach(([t, s], i) => {
    const y = 178 + i * 76;
    d.add(`<rect x="688" y="${y}" width="264" height="64" rx="12" fill="${C.surface}" stroke="${C.line}"/>`);
    d.text(t, { x: 704, y: y + 27, f: "display", size: 15.5, ls: -0.02, fill: C.text });
    d.text(s, { x: 704, y: y + 48, f: "mono", size: 11, ls: 0.02, fill: i === 3 ? C.pink : C.ink });
  });

  // Columna 4: servicios externos.
  group(1030, 140, 210, 350, "Servicios", "API", C.cyan);
  box(1048, 186, 174, 120, { title: "AniList", sub: "GraphQL · catálogo", color: C.cyan });
  d.text("caché \"use cache\"", { x: 1066, y: 290, f: "body", size: 12.5, fill: C.dim });
  box(1048, 334, 174, 120, { title: "MangaDex", sub: "capítulos · ES / EN", color: C.cyan });
  d.text("AniSkip: opening/ending", { x: 1066, y: 438, f: "body", size: 12.5, fill: C.dim });

  // Supabase (franja inferior).
  d.def(`<linearGradient id="sb" x1="0" x2="1"><stop offset="0" stop-color="#3ecf8e" stop-opacity="0.16"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0.05"/></linearGradient>`);
  d.add(`<rect x="40" y="560" width="1200" height="96" rx="18" fill="url(#sb)" stroke="#3ecf8e" stroke-opacity="0.45"/>`);
  d.text("Supabase", { x: 64, y: 600, f: "display", size: 22, ls: -0.02, fill: C.text });
  d.text("PostgreSQL + Row Level Security · Auth · Realtime · Storage", { x: 64, y: 628, f: "mono", size: 12.5, ls: 0.02, fill: "#7be3b4" });
  d.text("Una sola base de datos para la web y la app: biblioteca, progreso, perfiles, amigos, comentarios y salas.", { x: 1216, y: 614, f: "body", size: 13.5, anchor: "end", fill: C.muted });

  // Flechas.
  arrow("M252 246 H346", C.ink);
  tag("HTTPS", 299, 238);
  arrow("M252 394 H346", C.pink, "arP", "6 5");
  arrow("M592 210 H686", C.ink);
  arrow("M592 410 C 640 410, 640 438, 686 438", C.pink, "arP", "6 5");
  tag("1 de 2", 638, 434, C.pink);
  arrow("M952 286 C 992 286, 1000 246, 1046 246", C.ink);
  arrow("M952 286 C 992 286, 1000 394, 1046 394", C.ink);
  arrow("M930 318 V 329", C.ink);
  arrow("M155 454 V 558", C.cyan, "arC", "2 5");
  tag("JWT + RLS", 155, 516, C.cyan);
  arrow("M820 490 V 558", C.cyan, "arC", "2 5");
  tag("service role", 820, 526, C.cyan);
  endCard(d, { w: W, h: H, id: "a" });
  save("architecture.svg", d);
}

// ───────────────────────── Pie ─────────────────────────
{
  const W = 1280, H = 200;
  const d = new Doc(W, H, "KAZE · Orunei — Hecho por Andreh");
  card(d, { w: W, h: H, id: "p", gx: 0.5, gy: 1.1, grid: false });
  d.def(`<linearGradient id="kz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.primary}"/></linearGradient>`);
  wind(d, "p", [
    ["M -40 130 C 260 92, 470 150, 640 118 S 1000 80, 1330 116", 1.6, 0.5],
    ["M -40 156 C 300 128, 520 176, 700 146 S 1060 114, 1330 140", 1, 0.3],
  ]);
  d.textPath("風", { x: W / 2, y: 92, f: "mincho", size: 62, anchor: "middle", attrs: `fill="url(#kz)"` });
  d.text("KAZE · ORUNEI", { x: W / 2, y: 134, f: "label", size: 16, ls: 0.3, anchor: "middle", fill: C.text });
  d.text("Diseñado y desarrollado por Andreh · © 2026", { x: W / 2, y: 164, f: "body", size: 16, anchor: "middle", fill: C.muted });
  endCard(d, { w: W, h: H, id: "p" });
  save("footer.svg", d);
}
