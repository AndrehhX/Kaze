/**
 * Generates the KAZE Originals demo manga (original artwork and story created for this project).
 *   node scripts/manga-demo/generate.mjs
 * Output: public/manga-demo/** (SVG pages + covers) and src/lib/manga/demo/manifest.generated.json (page metadata & alt text).
 * Re-running is deterministic.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INK, JP_FONT, LETTER_FONT, bubble, caption, cloud, demoWatermark, hana, hillTown, ito, nextId, pageNumber, panel, paperPlane, resetIds, sfx, speedLines, svgDoc, windLines } from "./draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(root, "public", "manga-demo");
const MANIFEST = join(root, "src", "lib", "manga", "demo", "manifest.generated.json");
const W = 1000;
const H = 1500;
const M = { l: 44, r: 44, t: 48, b: 64 };
const G = 18;

const write = (rel, content) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
  return `/manga-demo/${rel.replace(/\\/g, "/")}`;
};

/** Grid helper: rows of fractional heights, each row split into columns (listed right→left for RTL pages). */
function grid(rows) {
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b - G * (rows.length - 1);
  const total = rows.reduce((a, r) => a + r.h, 0);
  const out = [];
  let y = M.t;
  for (const row of rows) {
    const h = (row.h / total) * innerH;
    const cols = row.cols ?? [1];
    const cw = innerW - G * (cols.length - 1);
    const sum = cols.reduce((a, b) => a + b, 0);
    let x = W - M.r; // right-to-left
    for (const c of cols) {
      const w = (c / sum) * cw;
      out.push({ x: x - w, y, w, h });
      x -= w + G;
    }
    y += h + G;
  }
  return out;
}

function page({ title, panels, n, extra = "" }) {
  return svgDoc({ w: W, h: H, title, body: panels.join("\n") + extra + pageNumber(W, H, n) + demoWatermark(W, H) });
}

function sora(x, y, s = 1, { flip = false, mood = "calm" } = {}) {
  const eyes =
    mood === "smile"
      ? `<path d="M-34 8 Q -22 -4 -10 8 M10 8 Q 22 -4 34 8" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
      : `<ellipse cx="-22" cy="8" rx="9" ry="12" fill="${INK}"/><ellipse cx="22" cy="8" rx="9" ry="12" fill="${INK}"/><circle cx="-25" cy="3" r="3" fill="#fff"/><circle cx="19" cy="3" r="3" fill="#fff"/>`;
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})" stroke="${INK}" stroke-width="3.5">
    <path d="M-80 220 C -80 130 -44 104 0 104 C 44 104 80 130 80 220 Z" fill="url(#tone-light)"/>
    <path d="M-26 104 L 0 136 L 26 104" fill="#fff"/>
    <ellipse cx="0" cy="10" rx="56" ry="64" fill="#fff"/>
    ${eyes}
    <path d="M-10 44 Q 0 ${mood === "smile" ? 54 : 46} 10 44" fill="none" stroke-width="3" stroke-linecap="round"/>
    <path d="M-60 -6 L -70 -40 L -46 -34 L -50 -70 L -20 -52 L -10 -90 L 12 -56 L 34 -86 L 40 -48 L 70 -60 L 58 -20 L 64 -4 C 40 -30 -30 -34 -60 -6 Z" fill="${INK}"/>
    <path d="M-64 -24 C -40 -60 40 -64 66 -24 L 92 -18 C 60 -40 -10 -48 -64 -24 Z" fill="url(#tone-dense)"/>
    <path d="M-26 24 l 6 -2 M26 24 l -6 -2" stroke-width="2"/>
  </g>`;
}

function envelope(x, y, w, h, { feather = true, rot = 0 } = {}) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#fff"/>
    <path d="M${-w / 2} ${-h / 2} L 0 ${h * 0.08} L ${w / 2} ${-h / 2}" fill="url(#tone-light)"/>
    ${feather ? `<path d="M${w * 0.28} ${h * 0.05} C ${w * 0.36} ${-h * 0.2}, ${w * 0.44} ${-h * 0.25}, ${w * 0.42} ${h * 0.35} C ${w * 0.36} ${h * 0.2}, ${w * 0.3} ${h * 0.25}, ${w * 0.28} ${h * 0.05} Z M${w * 0.29} ${h * 0.02} L ${w * 0.44} ${h * 0.4}" fill="url(#tone-dots)" stroke-width="2.5"/>` : ""}
  </g>`;
}

function lighthouse(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="4" stroke-linejoin="round">
    <path d="M-70 380 L -46 0 L 46 0 L 70 380 Z" fill="#fff"/>
    <path d="M-62 260 L 62 260 L 66 320 L -66 320 Z M-54 130 L 54 130 L 58 190 L -58 190 Z" fill="url(#tone-dense)"/>
    <rect x="-56" y="-26" width="112" height="26" fill="${INK}"/>
    <rect x="-38" y="-96" width="76" height="70" fill="#fff"/>
    <path d="M-38 -96 L 0 -140 L 38 -96 Z" fill="${INK}"/>
    <path d="M38 -70 L 300 -130 L 300 -10 Z" fill="url(#glow-grad)" stroke="none" opacity="0.9"/>
    <rect x="-16" y="310" width="32" height="70" fill="${INK}"/>
  </g>`;
}

// ───────────────────────── Viento de Papel ─────────────────────────
const viento = { slug: "viento-de-papel", chapters: [] };

function vientoCover() {
  resetIds();
  const defs = `
    <linearGradient id="c-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f4e79"/><stop offset="0.55" stop-color="#5fa8c9"/><stop offset="1" stop-color="#f6c99a"/></linearGradient>
    <linearGradient id="c-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d6a4f"/><stop offset="1" stop-color="#1b4332"/></linearGradient>`;
  const body = `
  <rect width="${W}" height="${H}" fill="url(#c-sky)"/>
  <circle cx="770" cy="420" r="150" fill="#ffe8b8" opacity="0.55"/>
  ${cloud(240, 300, 1.4, "#ffffff")}${cloud(780, 640, 1.1, "#ffffff")}
  <g opacity="0.9">${windLines(60, 560, 880, { rows: 7, gap: 46, seed: 5, color: "#ffffff", opacity: 0.8 })}</g>
  <path d="M0 1180 C 260 1080 640 1100 1000 1160 L 1000 1500 L 0 1500 Z" fill="url(#c-hill)"/>
  <g transform="translate(0 0)">${hana(520, 860, 2.1, { pose: "throw", mood: "smile" })}</g>
  ${paperPlane(830, 300, 1.6, -18)}${paperPlane(170, 720, 1.1, -6)}${paperPlane(640, 180, 0.8, -26)}
  <rect x="0" y="1260" width="${W}" height="240" fill="#0d1b2a" opacity="0.82"/>
  <text x="70" y="1350" font-family="${LETTER_FONT}" font-size="86" font-weight="900" fill="#ffffff" letter-spacing="4">VIENTO DE PAPEL</text>
  <text x="72" y="1410" font-family="${LETTER_FONT}" font-size="30" fill="#f6c99a" letter-spacing="6">VOLUMEN 1 · KAZE ORIGINALS</text>
  <text x="72" y="1452" font-family="${LETTER_FONT}" font-size="20" fill="#9fb3c8" letter-spacing="3">OBRA ORIGINAL DE DEMOSTRACIÓN</text>
  <text x="900" y="160" font-family="${JP_FONT}" font-size="96" font-weight="900" fill="#ffffff" writing-mode="tb" letter-spacing="10">紙の風</text>`;
  return write(`${viento.slug}/cover.svg`, svgDoc({ w: W, h: H, title: "Viento de Papel — portada del volumen 1", body, defs }));
}

function ch1() {
  const pages = [];
  const add = (svg, alt, n, extra = {}) => pages.push({ src: write(`${viento.slug}/c1/${String(n).padStart(2, "0")}.svg`, svg), alt, width: extra.width ?? W, height: H, spread: Boolean(extra.spread) });

  resetIds();
  {
    const full = { x: 0, y: 0, w: W, h: H };
    const body =
      panel(full, () => `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#sky-grad)"/>${cloud(250, 260, 1.5)}${cloud(780, 470, 1)}${windLines(80, 520, 840, { rows: 8, gap: 40, seed: 2 })}${hillTown({ x: 0, y: 760, w: W, h: 740 }, { seed: 4 })}${hana(560, 820, 1.55, { pose: "back" })}${paperPlane(820, 330, 1.2, -16)}`, { bleed: true }) +
      `<text x="70" y="150" font-family="${LETTER_FONT}" font-size="78" font-weight="900" fill="${INK}" stroke="#fff" stroke-width="10" paint-order="stroke" letter-spacing="3">VIENTO DE PAPEL</text>
       <text x="74" y="200" font-family="${LETTER_FONT}" font-size="30" font-weight="700" fill="${INK}" stroke="#fff" stroke-width="7" paint-order="stroke">Capítulo 1 · La carta sin remitente</text>
       <text x="920" y="250" font-family="${JP_FONT}" font-size="64" font-weight="900" fill="${INK}" writing-mode="tb" stroke="#fff" stroke-width="8" paint-order="stroke">紙の風</text>`;
    add(page({ title: "Viento de Papel, capítulo 1, página 1", panels: [body], n: 1 }), "Página de título. Hana, una cartera con bufanda, contempla de espaldas el pueblo de Kazamachi desde una colina. El viento arrastra nubes y un avión de papel cruza el cielo. Título: Viento de Papel, Capítulo 1, La carta sin remitente.", 1);
  }

  resetIds();
  {
    const p = grid([{ h: 1.2 }, { h: 1, cols: [1, 1] }, { h: 1 }]);
    const panels = [
      panel(p[0], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#sky-grad)"/>${cloud(r.x + 200, r.y + 90, 0.9)}${windLines(r.x + 40, r.y + 120, r.w - 80, { rows: 4, seed: 9 })}${hillTown(r, { seed: 21 })}${caption(r.x + 24, r.y + 24, 430, "En Kazamachi, el viento nunca descansa.")}`),
      panel(p[1], (r) => `${ito(r.x + r.w * 0.55, r.y + r.h * 0.42, 1.25)}<rect x="${r.x + 20}" y="${r.y + 20}" width="150" height="58" fill="#fff" stroke="${INK}" stroke-width="3"/><text x="${r.x + 95}" y="${r.y + 59}" font-family="${LETTER_FONT}" font-size="26" font-weight="900" text-anchor="middle">CORREO</text>${bubble(r.x + r.w * 0.38, r.y + r.h * 0.85, "¡Hana! Llegas tarde otra vez.", { tx: r.x + r.w * 0.55, ty: r.y + r.h * 0.62, maxChars: 14 })}`),
      panel(p[2], (r) => `${speedLines(r, r.x + r.w / 2, r.y + r.h * 0.45, { inner: 140, seed: 3, count: 70 })}${hana(r.x + r.w / 2, r.y + r.h * 0.5, 1.15, { mood: "surprised" })}${bubble(r.x + r.w * 0.5, r.y + 76, "¡El viento cambió de dirección!", { tx: r.x + r.w * 0.5, ty: r.y + 150, shape: "shout", maxChars: 14 })}`),
      panel(p[3], (r) => `${hana(r.x + r.w * 0.7, r.y + r.h * 0.45, 1.05, { mood: "smile" })}${envelope(r.x + r.w * 0.36, r.y + r.h * 0.72, 120, 80, { feather: false, rot: -8 })}${envelope(r.x + r.w * 0.24, r.y + r.h * 0.8, 120, 80, { feather: false, rot: 6 })}${bubble(r.x + r.w * 0.3, r.y + r.h * 0.3, "Pero entregué todas las cartas... casi todas.", { tx: r.x + r.w * 0.58, ty: r.y + r.h * 0.38, maxChars: 18 })}`),
    ];
    add(page({ title: "Viento de Papel, capítulo 1, página 2", panels, n: 2 }), "Viñeta 1: vista del pueblo en la colina con el texto «En Kazamachi, el viento nunca descansa». Viñeta 2: el señor Ito, el jefe de correos con gafas y bigote, junto al letrero CORREO, dice «¡Hana! Llegas tarde otra vez». Viñeta 3: Hana, sorprendida, grita «¡El viento cambió de dirección!». Viñeta 4: Hana sonríe con sobres en la mano: «Pero entregué todas las cartas... casi todas».", 2);
  }

  resetIds();
  {
    const p = grid([{ h: 1.4, cols: [1.15, 1] }, { h: 1 }]);
    const panels = [
      panel(p[0], (r) => `${ito(r.x + r.w * 0.5, r.y + r.h * 0.36, 1.3, { flip: true })}${envelope(r.x + r.w * 0.5, r.y + r.h * 0.78, 200, 130, { rot: -4 })}${bubble(r.x + r.w * 0.5, r.y + 70, "Esta no tiene remitente ni dirección.", { tx: r.x + r.w * 0.5, ty: r.y + 150, maxChars: 16 })}`),
      panel(p[1], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#tone-light)"/>${envelope(r.x + r.w / 2, r.y + r.h * 0.5, r.w * 0.8, r.w * 0.55, { rot: 3 })}${caption(r.x + 16, r.y + r.h - 120, r.w - 32, "Solo un dibujo: una pluma.", { maxChars: 18 })}`),
      panel(p[2], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#tone-dots)" opacity="0.35"/>${hana(r.x + r.w * 0.72, r.y + r.h * 0.5, 1.1)}${bubble(r.x + r.w * 0.32, r.y + r.h * 0.42, "¿A quién se la entrego, entonces?", { shape: "thought", maxChars: 16 })}<circle cx="${r.x + r.w * 0.5}" cy="${r.y + r.h * 0.58}" r="12" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${r.x + r.w * 0.55}" cy="${r.y + r.h * 0.66}" r="7" fill="#fff" stroke="${INK}" stroke-width="3"/>`),
    ];
    add(page({ title: "Viento de Papel, capítulo 1, página 3", panels, n: 3 }), "Viñeta 1: el señor Ito sostiene un sobre: «Esta no tiene remitente ni dirección». Viñeta 2: primer plano del sobre, que solo tiene una pluma dibujada. Viñeta 3: Hana piensa: «¿A quién se la entrego, entonces?».", 3);
  }

  resetIds();
  {
    const p = grid([{ h: 1.1 }, { h: 1, cols: [1, 1] }]);
    const panels = [
      panel(p[0], (r) => `${ito(r.x + r.w * 0.78, r.y + r.h * 0.48, 1.1)}${bubble(r.x + r.w * 0.38, r.y + r.h * 0.42, "Las cartas perdidas se doblan en avión y se le dan al viento. Es la costumbre.", { tx: r.x + r.w * 0.66, ty: r.y + r.h * 0.48, maxChars: 22, size: 25 })}`),
      panel(p[1], (r) => `<g stroke="${INK}" stroke-width="3.5"><path d="M${r.x + r.w * 0.2} ${r.y + r.h * 0.95} C ${r.x + r.w * 0.25} ${r.y + r.h * 0.6}, ${r.x + r.w * 0.35} ${r.y + r.h * 0.55}, ${r.x + r.w * 0.42} ${r.y + r.h * 0.55}" fill="none" stroke-width="40" stroke-linecap="round"/><path d="M${r.x + r.w * 0.2} ${r.y + r.h * 0.95} C ${r.x + r.w * 0.25} ${r.y + r.h * 0.6}, ${r.x + r.w * 0.35} ${r.y + r.h * 0.55}, ${r.x + r.w * 0.42} ${r.y + r.h * 0.55}" fill="none" stroke="#fff" stroke-width="32" stroke-linecap="round"/></g>${paperPlane(r.x + r.w * 0.6, r.y + r.h * 0.5, 1.5, -4)}${sfx(r.x + r.w * 0.72, r.y + r.h * 0.22, "パタ", "pata", { size: 84 })}`),
      panel(p[2], (r) => `${speedLines(r, r.x + r.w / 2, r.y + r.h / 2, { inner: 80, count: 60, seed: 12 })}${paperPlane(r.x + r.w / 2, r.y + r.h / 2, 2, -10)}${caption(r.x + 16, r.y + 16, r.w - 32, "Lista para volar.", { maxChars: 20 })}`),
    ];
    add(page({ title: "Viento de Papel, capítulo 1, página 4", panels, n: 4 }), "Viñeta 1: el señor Ito explica: «Las cartas perdidas se doblan en avión y se le dan al viento. Es la costumbre». Viñeta 2: las manos de Hana doblan el sobre con el sonido «pata». Viñeta 3: el avión de papel terminado, con el texto «Lista para volar».", 4);
  }

  resetIds();
  {
    const p = grid([{ h: 2.2 }, { h: 0.8, cols: [1, 1.4] }]);
    const panels = [
      panel(p[0], (r) => `${speedLines(r, r.x + r.w * 0.62, r.y + r.h * 0.2, { inner: 60, count: 120, seed: 21 })}${hana(r.x + r.w * 0.42, r.y + r.h * 0.5, 1.75, { pose: "throw", mood: "smile" })}${paperPlane(r.x + r.w * 0.72, r.y + r.h * 0.12, 1.3, -30)}${sfx(r.x + r.w * 0.22, r.y + r.h * 0.2, "ビュウウ", "byuuu", { size: 120, rot: -12 })}${bubble(r.x + r.w * 0.74, r.y + r.h * 0.8, "¡Llévala a donde tenga que ir!", { shape: "shout", maxChars: 14 })}`),
      panel(p[1], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#sky-grad)"/>${windLines(r.x + 20, r.y + 40, r.w - 40, { rows: 6, gap: 30, seed: 31 })}${paperPlane(r.x + r.w * 0.5, r.y + r.h * 0.45, 0.8, -20)}`),
      panel(p[2], (r) => `${ito(r.x + r.w * 0.5, r.y + r.h * 0.6, 0.85)}${bubble(r.x + r.w * 0.5, r.y + 60, "Hmm... qué extraño.", { tx: r.x + r.w * 0.5, ty: r.y + 120, maxChars: 14, size: 24 })}`),
    ];
    add(page({ title: "Viento de Papel, capítulo 1, página 5", panels, n: 5 }), "Viñeta 1, grande y con líneas de velocidad: Hana lanza el avión de papel al cielo gritando «¡Llévala a donde tenga que ir!» con el sonido del viento «byuuu». Viñeta 2: el avión se aleja entre ráfagas de viento. Viñeta 3: el señor Ito, intrigado: «Hmm... qué extraño».", 5);
  }

  resetIds();
  {
    const SW = W * 2;
    const r = { x: 0, y: 0, w: SW, h: H };
    const body = panel(r, () => `<rect x="0" y="0" width="${SW}" height="${H}" fill="url(#sky-grad)"/>${cloud(300, 260, 1.8)}${cloud(1200, 180, 1.3)}${cloud(1700, 420, 1.6)}${windLines(80, 420, SW - 160, { rows: 10, gap: 44, seed: 41 })}${hillTown({ x: 0, y: 820, w: SW, h: 680 }, { seed: 52 })}${paperPlane(1180, 520, 2.4, -14)}${hana(560, 1210, 0.55, { pose: "run" })}`, { bleed: true });
    const svg = svgDoc({ w: SW, h: H, title: "Viento de Papel, capítulo 1, páginas 6 y 7 (doble página)", body: body + caption(1320, 1260, 560, "Y el viento, por primera vez, eligió un camino.", { maxChars: 30, dark: true }) + `<text x="${SW / 2 - 40}" y="${H - 18}" font-family="${LETTER_FONT}" font-size="20" text-anchor="middle" fill="#8a8a8a">6 · 7</text>` + demoWatermark(SW, H) });
    pages.push({ src: write(`${viento.slug}/c1/06-07.svg`, svg), alt: "Doble página: panorámica del cielo sobre Kazamachi. El avión de papel planea por encima de los tejados empujado por largas corrientes de viento mientras Hana, diminuta, corre detrás por la colina. Texto: «Y el viento, por primera vez, eligió un camino».", width: SW, height: H, spread: true });
  }

  resetIds();
  {
    const p = grid([{ h: 1, cols: [1.3, 1] }, { h: 1 }, { h: 0.9 }]);
    const panels = [
      panel(p[0], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#sky-grad)"/>${lighthouse(r.x + r.w * 0.68, r.y + 90, 0.62)}${paperPlane(r.x + r.w * 0.3, r.y + r.h * 0.35, 0.7, 14)}${windLines(r.x + 10, r.y + r.h * 0.6, r.w * 0.6, { rows: 3, seed: 61 })}`),
      panel(p[1], (r) => `${caption(r.x + 14, r.y + 14, r.w - 28, "¿El faro?", { maxChars: 12 })}${hana(r.x + r.w * 0.5, r.y + r.h * 0.6, 0.9, { mood: "surprised" })}`),
      panel(p[2], (r) => `${speedLines(r, r.x + r.w * 0.3, r.y + r.h * 0.5, { inner: 30, count: 0 })}<g>${windLines(r.x + 20, r.y + 60, r.w - 40, { rows: 7, gap: 34, seed: 71, opacity: 0.5 })}</g>${hana(r.x + r.w * 0.55, r.y + 30, 0.7, { pose: "run", flip: true })}${bubble(r.x + r.w * 0.82, r.y + 90, "¡Espera!", { shape: "shout", tx: r.x + r.w * 0.66, ty: r.y + 120 })}`),
      panel(p[3], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${INK}"/>${paperPlane(r.x + r.w * 0.45, r.y + r.h * 0.5, 1.6, -6)}<path d="M${r.x + r.w * 0.95} ${r.y + r.h * 0.85} C ${r.x + r.w * 0.8} ${r.y + r.h * 0.6}, ${r.x + r.w * 0.68} ${r.y + r.h * 0.55}, ${r.x + r.w * 0.6} ${r.y + r.h * 0.5}" stroke="#fff" stroke-width="44" fill="none" stroke-linecap="round"/><path d="M${r.x + r.w * 0.95} ${r.y + r.h * 0.85} C ${r.x + r.w * 0.8} ${r.y + r.h * 0.6}, ${r.x + r.w * 0.68} ${r.y + r.h * 0.55}, ${r.x + r.w * 0.6} ${r.y + r.h * 0.5}" stroke="${INK}" stroke-width="34" fill="none" stroke-linecap="round"/>${caption(r.x + 24, r.y + r.h - 86, 360, "Alguien la atrapó. Continuará...", { maxChars: 22, dark: false })}`),
    ];
    add(page({ title: "Viento de Papel, capítulo 1, página 8", panels, n: 8 }), "Viñeta 1: el avión de papel se dirige hacia un faro junto al mar. Viñeta 2: Hana, sorprendida: «¿El faro?». Viñeta 3: Hana corre tras él gritando «¡Espera!». Viñeta 4, sobre fondo negro: una mano atrapa el avión. Texto: «Alguien la atrapó. Continuará...».", 8);
  }
  return pages;
}

function ch15() {
  const pages = [];
  resetIds();
  const steps = [
    "Dobla la carta por la mitad a lo largo.",
    "Lleva las esquinas superiores al centro.",
    "Vuelve a doblar los bordes hacia el pliegue.",
    "Dobla por la mitad hacia afuera.",
    "Baja las alas a cada lado.",
    "Escribe el destino en el ala. ¡Al viento!",
  ];
  const p = grid([{ h: 0.45 }, { h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }]);
  const panels = [panel(p[0], (r) => `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 14}" font-family="${LETTER_FONT}" font-size="40" font-weight="900" text-anchor="middle">EXTRA · EL AVIÓN DE HANA</text>`)];
  steps.forEach((s, i) => {
    panels.push(
      panel(p[i + 1], (r) => {
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h * 0.42;
        const k = 1 - i * 0.1;
        const shape =
          i < 3
            ? `<rect x="${cx - 110 * k}" y="${cy - 80}" width="${220 * k}" height="160" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M${cx} ${cy - 80} L ${cx} ${cy + 80}" stroke="${INK}" stroke-width="2.5" stroke-dasharray="10 8"/>${i >= 1 ? `<path d="M${cx - 110 * k} ${cy - 80} L ${cx} ${cy - 10} L ${cx + 110 * k} ${cy - 80}" fill="url(#tone-light)" stroke="${INK}" stroke-width="3"/>` : ""}`
            : paperPlane(cx, cy, 1.4 - (5 - i) * 0.1, i === 3 ? 0 : -10);
        return `<circle cx="${r.x + 40}" cy="${r.y + 40}" r="24" fill="${INK}"/><text x="${r.x + 40}" y="${r.y + 49}" font-family="${LETTER_FONT}" font-size="26" font-weight="900" fill="#fff" text-anchor="middle">${i + 1}</text>${shape}${caption(r.x + 16, r.y + r.h - 96, r.w - 32, s, { maxChars: 22, size: 20 })}`;
      }),
    );
  });
  pages.push({
    src: write(`${viento.slug}/c1-5/01.svg`, page({ title: "Viento de Papel, extra 1.5, página 1", panels, n: 1 })),
    alt: "Página extra con instrucciones ilustradas en seis pasos para doblar el avión de papel de Hana: doblar a lo largo, llevar las esquinas al centro, volver a doblar los bordes, doblar por la mitad, bajar las alas y escribir el destino en el ala.",
    width: W,
    height: H,
    spread: false,
  });
  return pages;
}

function ch2() {
  const pages = [];
  const add = (svg, alt, n) => pages.push({ src: write(`${viento.slug}/c2/${String(n).padStart(2, "0")}.svg`, svg), alt, width: W, height: H, spread: false });

  resetIds();
  {
    const p = grid([{ h: 1.8 }, { h: 1, cols: [1, 1] }]);
    const panels = [
      panel(p[0], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#dusk-grad)"/>${lighthouse(r.x + r.w * 0.5, r.y + 170, 1.05)}<path d="M${r.x} ${r.y + r.h - 120} C ${r.x + 300} ${r.y + r.h - 160}, ${r.x + 600} ${r.y + r.h - 90}, ${r.x + r.w} ${r.y + r.h - 130} L ${r.x + r.w} ${r.y + r.h} L ${r.x} ${r.y + r.h} Z" fill="url(#tone-dots)" stroke="${INK}" stroke-width="3"/><text x="${r.x + 40}" y="${r.y + 80}" font-family="${LETTER_FONT}" font-size="44" font-weight="900" fill="#fff" stroke="${INK}" stroke-width="8" paint-order="stroke">Capítulo 2 · Corriente ascendente</text>`),
      panel(p[1], (r) => `${hana(r.x + r.w * 0.5, r.y + r.h * 0.42, 0.95, { pose: "back" })}${sfx(r.x + r.w * 0.25, r.y + r.h * 0.3, "コツ コツ", "kotsu kotsu", { size: 56, rot: 0 })}`),
      panel(p[2], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#tone-hatch)" opacity="0.4"/>${bubble(r.x + r.w / 2, r.y + r.h / 2, "¿Hola? ¿Hay alguien?", { maxChars: 12 })}`),
    ];
    add(page({ title: "Viento de Papel, capítulo 2, página 1", panels, n: 1 }), "Viñeta 1: el faro al atardecer sobre las rocas, con el título «Capítulo 2: Corriente ascendente». Viñeta 2: Hana sube las escaleras del faro con el sonido de pasos «kotsu kotsu». Viñeta 3: su voz resuena: «¿Hola? ¿Hay alguien?».", 1);
  }

  resetIds();
  {
    const p = grid([{ h: 1.3 }, { h: 1, cols: [1, 1] }]);
    const panels = [
      panel(p[0], (r) => `${sora(r.x + r.w * 0.32, r.y + r.h * 0.45, 1.25)}${paperPlane(r.x + r.w * 0.32, r.y + r.h * 0.88, 0.9, -6)}${bubble(r.x + r.w * 0.72, r.y + r.h * 0.36, "¿Esto es tuyo? Aquí llegan muchos.", { tx: r.x + r.w * 0.46, ty: r.y + r.h * 0.4, maxChars: 14 })}`),
      panel(p[1], (r) => `${speedLines(r, r.x + r.w / 2, r.y + r.h * 0.45, { inner: 120, count: 60, seed: 81 })}${hana(r.x + r.w / 2, r.y + r.h * 0.5, 0.95, { mood: "surprised" })}${bubble(r.x + r.w / 2, r.y + 70, "¿Muchos?", { shape: "shout" })}`),
      panel(p[2], (r) => `${sora(r.x + r.w / 2, r.y + r.h * 0.5, 0.95, { mood: "smile", flip: true })}${bubble(r.x + r.w / 2, r.y + 70, "Ven, te enseño.", { tx: r.x + r.w / 2, ty: r.y + 140 })}`),
    ];
    add(page({ title: "Viento de Papel, capítulo 2, página 2", panels, n: 2 }), "Viñeta 1: Sora, un chico con gorra, sostiene el avión de papel: «¿Esto es tuyo? Aquí llegan muchos». Viñeta 2: Hana, sorprendida: «¿Muchos?». Viñeta 3: Sora sonríe: «Ven, te enseño».", 2);
  }

  resetIds();
  {
    const p = grid([{ h: 2.2 }, { h: 0.8 }]);
    const planes = [];
    for (let row = 0; row < 6; row++) for (let col = 0; col < 5; col++) planes.push([col, row]);
    const panels = [
      panel(p[0], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#tone-light)" opacity="0.5"/>${planes.map(([c, rr], i) => paperPlane(r.x + 110 + c * (r.w - 200) / 4, r.y + 110 + rr * (r.h - 220) / 5, 0.75, -20 + ((i * 37) % 40))).join("")}`),
      panel(p[1], (r) => `${caption(r.x + 24, r.y + 30, r.w - 48, "Cientos de cartas que nadie reclamó, guardadas en la cima del faro.", { maxChars: 40, dark: true })}`),
    ];
    add(page({ title: "Viento de Papel, capítulo 2, página 3", panels, n: 3 }), "Viñeta grande: una pared entera cubierta de aviones de papel colgados. Texto: «Cientos de cartas que nadie reclamó, guardadas en la cima del faro».", 3);
  }

  resetIds();
  {
    const p = grid([{ h: 1, cols: [1, 1] }, { h: 1.2 }]);
    const panels = [
      panel(p[0], (r) => `${sora(r.x + r.w / 2, r.y + r.h * 0.55, 0.95)}${bubble(r.x + r.w / 2, r.y + 90, "Mi abuelo decía que el viento las trae a quien debe leerlas.", { maxChars: 16, size: 23, tx: r.x + r.w / 2, ty: r.y + 200 })}`),
      panel(p[1], (r) => `${hana(r.x + r.w / 2, r.y + r.h * 0.55, 0.95)}${bubble(r.x + r.w / 2, r.y + 80, "Entonces... ¿esta es para ti?", { maxChars: 14, tx: r.x + r.w / 2, ty: r.y + 170 })}`),
      panel(p[2], (r) => `${windLines(r.x + 30, r.y + 40, r.w - 60, { rows: 4, seed: 91, opacity: 0.4 })}${envelope(r.x + r.w / 2, r.y + r.h * 0.5, 360, 230, { rot: 0 })}${caption(r.x + 24, r.y + r.h - 90, 520, "Sora rompe el sello con cuidado.", { maxChars: 34 })}`),
    ];
    add(page({ title: "Viento de Papel, capítulo 2, página 4", panels, n: 4 }), "Viñeta 1: Sora explica: «Mi abuelo decía que el viento las trae a quien debe leerlas». Viñeta 2: Hana pregunta: «Entonces... ¿esta es para ti?». Viñeta 3: el sobre con la pluma, en primer plano, mientras Sora rompe el sello con cuidado.", 4);
  }

  resetIds();
  {
    const p = grid([{ h: 1.3 }, { h: 1, cols: [1, 1] }]);
    const panels = [
      panel(p[0], (r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#fff"/><rect x="${r.x + 110}" y="${r.y + 60}" width="${r.w - 220}" height="${r.h - 120}" fill="#fff" stroke="${INK}" stroke-width="3"/>${[0, 1, 2, 3].map((i) => `<path d="M${r.x + 150} ${r.y + 140 + i * 60} L ${r.x + r.w - 150} ${r.y + 140 + i * 60}" stroke="#c9c9c9" stroke-width="2"/>`).join("")}<text font-family="${LETTER_FONT}" font-size="30" font-style="italic" fill="${INK}"><tspan x="${r.x + 150}" y="${r.y + 130}">Para quien encuentre esta carta:</tspan><tspan x="${r.x + 150}" y="${r.y + 190}">gracias por cuidar el faro</tspan><tspan x="${r.x + 150}" y="${r.y + 250}">y todas las palabras perdidas.</tspan><tspan x="${r.x + 150}" y="${r.y + 330}">— Kazamachi</tspan></text>`),
      panel(p[1], (r) => `${sora(r.x + r.w / 2, r.y + r.h * 0.5, 0.95, { mood: "smile" })}`),
      panel(p[2], (r) => `${hana(r.x + r.w / 2, r.y + r.h * 0.5, 0.95, { mood: "smile" })}${caption(r.x + 16, r.y + r.h - 86, r.w - 32, "Fin de la demo.", { maxChars: 20, dark: true })}`),
    ];
    add(page({ title: "Viento de Papel, capítulo 2, página 5", panels, n: 5 }), "Viñeta 1: la carta abierta dice: «Para quien encuentre esta carta: gracias por cuidar el faro y todas las palabras perdidas. — Kazamachi». Viñetas 2 y 3: Sora y Hana sonríen. Texto final: «Fin de la demo».", 5);
  }
  return pages;
}

// ───────────────────────── Señal Nocturna (webtoon, color) ─────────────────────────
const senal = { slug: "senal-nocturna" };
const SW = 800;

function city(y, h, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = "";
  let x = -20;
  while (x < SW + 20) {
    const bw = 70 + rnd() * 110;
    const bh = h * (0.35 + rnd() * 0.6);
    out += `<rect x="${x}" y="${y + h - bh}" width="${bw}" height="${bh}" fill="#0b1626" stroke="#1d3557" stroke-width="2"/>`;
    for (let wy = y + h - bh + 18; wy < y + h - 20; wy += 26)
      for (let wx = x + 12; wx < x + bw - 16; wx += 22) if (rnd() > 0.55) out += `<rect x="${wx}" y="${wy}" width="10" height="14" fill="${rnd() > 0.85 ? "#7ee8fa" : "#ffd27a"}" opacity="${0.5 + rnd() * 0.5}"/>`;
    x += bw + 8;
  }
  return out;
}

function rain(y, h, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = "";
  for (let i = 0; i < 140; i++) {
    const x = rnd() * SW;
    const yy = y + rnd() * h;
    out += `<path d="M${x} ${yy} l -8 34" stroke="#9fd3ff" stroke-width="1.6" opacity="${0.25 + rnd() * 0.4}"/>`;
  }
  return out;
}

function ren(x, y, s = 1, { glow = true } = {}) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    ${glow ? `<ellipse cx="40" cy="150" rx="140" ry="110" fill="#7ee8fa" opacity="0.18"/>` : ""}
    <path d="M-110 330 C -110 190 -60 150 0 150 C 60 150 110 190 110 330 Z" fill="#1d3557" stroke="#0a0f1a" stroke-width="4"/>
    <path d="M-30 150 L 0 200 L 30 150" fill="#e63946"/>
    <ellipse cx="0" cy="40" rx="70" ry="80" fill="#f1d3c2" stroke="#0a0f1a" stroke-width="4"/>
    <path d="M-76 30 C -84 -50 -40 -86 6 -86 C 56 -86 90 -48 76 30 C 60 -10 30 -24 -10 -26 C -40 -20 -62 0 -76 30 Z" fill="#26324a"/>
    <path d="M-82 20 C -86 -60 86 -60 82 20" stroke="#0a0f1a" stroke-width="12" fill="none"/>
    <rect x="-98" y="4" width="30" height="58" rx="12" fill="#e63946" stroke="#0a0f1a" stroke-width="4"/>
    <rect x="68" y="4" width="30" height="58" rx="12" fill="#e63946" stroke="#0a0f1a" stroke-width="4"/>
    <ellipse cx="-24" cy="46" rx="9" ry="12" fill="#0a0f1a"/><ellipse cx="24" cy="46" rx="9" ry="12" fill="#0a0f1a"/>
    <circle cx="-27" cy="41" r="3" fill="#fff"/><circle cx="21" cy="41" r="3" fill="#fff"/>
    <path d="M-8 84 Q 0 90 8 84" stroke="#0a0f1a" stroke-width="3" fill="none"/>
    <rect x="22" y="200" width="56" height="96" rx="10" fill="#0a0f1a" stroke="#7ee8fa" stroke-width="3"/>
    <rect x="30" y="210" width="40" height="70" rx="4" fill="#7ee8fa" opacity="0.9"/>
  </g>`;
}

function textBox(x, y, w, text, { color = "#0a0f1a", fg = "#eafbff", size = 26 } = {}) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const wd of words) {
    if ((cur + " " + wd).length > Math.floor(w / (size * 0.52)) && cur) {
      lines.push(cur);
      cur = wd;
    } else cur = (cur + " " + wd).trim();
  }
  if (cur) lines.push(cur);
  const h = lines.length * size * 1.3 + 30;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${color}" stroke="#7ee8fa" stroke-width="2.5" opacity="0.94"/><text font-family="${LETTER_FONT}" font-size="${size}" font-weight="700" fill="${fg}">${lines.map((l, i) => `<tspan x="${x + 20}" y="${y + 22 + size * 0.9 + i * size * 1.3}">${l.replace(/&/g, "&amp;")}</tspan>`).join("")}</text>`;
}

function senalCover() {
  resetIds();
  const defs = `<linearGradient id="n-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a18"/><stop offset="0.6" stop-color="#16213e"/><stop offset="1" stop-color="#3a0f3d"/></linearGradient>`;
  const body = `<rect width="${W}" height="${H}" fill="url(#n-sky)"/>
  <g transform="scale(1.25 1)">${city(700, 800, 7)}${rain(0, H, 3)}</g>
  <circle cx="500" cy="560" r="230" fill="none" stroke="#7ee8fa" stroke-width="3" opacity="0.5"/><circle cx="500" cy="560" r="300" fill="none" stroke="#7ee8fa" stroke-width="2" opacity="0.3"/><circle cx="500" cy="560" r="380" fill="none" stroke="#7ee8fa" stroke-width="1.5" opacity="0.18"/>
  ${ren(470, 420, 1.6)}
  <text x="60" y="1300" font-family="${LETTER_FONT}" font-size="92" font-weight="900" fill="#eafbff" letter-spacing="4">SEÑAL</text>
  <text x="60" y="1392" font-family="${LETTER_FONT}" font-size="92" font-weight="900" fill="#7ee8fa" letter-spacing="4">NOCTURNA</text>
  <text x="64" y="1446" font-family="${LETTER_FONT}" font-size="24" fill="#c3c9e8" letter-spacing="5">WEBTOON ORIGINAL · DEMO KAZE</text>
  <text x="900" y="140" font-family="${JP_FONT}" font-size="70" font-weight="900" fill="#e63946" writing-mode="tb">夜の信号</text>`;
  return write(`${senal.slug}/cover.svg`, svgDoc({ w: W, h: H, title: "Señal Nocturna — portada", body, defs, bg: "#050a18" }));
}

function senalStrips() {
  const pages = [];
  const strip = (n, body, alt, h = 2000) => {
    resetIds();
    const svg = svgDoc({ w: SW, h, title: `Señal Nocturna, episodio 1, tira ${n}`, body: body + `<text x="${SW - 20}" y="${h - 16}" font-family="${LETTER_FONT}" font-size="14" text-anchor="end" fill="#55607a" letter-spacing="2">KAZE ORIGINALS · DEMO</text>`, bg: "#050a18", defs: `<linearGradient id="n2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a18"/><stop offset="1" stop-color="#16213e"/></linearGradient>` });
    pages.push({ src: write(`${senal.slug}/e1/${String(n).padStart(2, "0")}.svg`, svg), alt, width: SW, height: h, spread: false });
  };
  strip(
    1,
    `<rect width="${SW}" height="2000" fill="url(#n2)"/>${textBox(60, 120, 520, "Ciudad Hikari. 2:47 a. m. La lluvia no ha parado en tres días.")}${city(600, 700, 11)}${rain(0, 2000, 5)}<rect x="0" y="1300" width="${SW}" height="700" fill="#0a0f1a"/>${ren(400, 1380, 1.2)}${textBox(380, 1820, 380, "No puedo dormir. Otra vez.", { color: "#1d3557" })}`,
    "Tira 1: panorámica nocturna de una ciudad lluviosa llena de rascacielos con ventanas iluminadas. Texto: «Ciudad Hikari. 2:47 a. m. La lluvia no ha parado en tres días». Abajo, Ren, con auriculares rojos, mira su teléfono iluminado: «No puedo dormir. Otra vez».",
  );
  strip(
    2,
    `<rect width="${SW}" height="2000" fill="#0a0f1a"/><rect x="120" y="120" width="560" height="980" rx="48" fill="#111a2e" stroke="#7ee8fa" stroke-width="4"/><rect x="150" y="190" width="500" height="840" rx="18" fill="#0b2233"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => `<rect x="${190 + i * 38}" y="${700 - (((i * 53) % 7) + 2) * 40}" width="22" height="${(((i * 53) % 7) + 2) * 40}" fill="#7ee8fa" opacity="${0.4 + (i % 3) * 0.2}"/>`).join("")}
    <text x="400" y="300" font-family="${LETTER_FONT}" font-size="64" font-weight="900" text-anchor="middle" fill="#eafbff">88.0 FM</text>
    <text x="400" y="830" font-family="${LETTER_FONT}" font-size="28" text-anchor="middle" fill="#7ee8fa">SEÑAL DESCONOCIDA</text>
    ${textBox(80, 1240, 640, "«...si alguien escucha esto... la torre del puerto... a las tres...»", { color: "#3a0f3d", size: 28 })}
    ${textBox(260, 1600, 460, "¿Una radio pirata? Esta frecuencia lleva años muerta.", { color: "#1d3557" })}`,
    "Tira 2: primer plano de la pantalla del teléfono de Ren, con una app de radio que sintoniza 88.0 FM y muestra «Señal desconocida» con barras de ecualizador. Una voz distorsionada dice: «...si alguien escucha esto... la torre del puerto... a las tres...». Ren piensa: «¿Una radio pirata? Esta frecuencia lleva años muerta».",
  );
  strip(
    3,
    `<rect width="${SW}" height="2000" fill="url(#n2)"/>${rain(0, 2000, 9)}<rect x="300" y="200" width="200" height="1200" fill="#0b1626" stroke="#1d3557" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="320" y="${260 + i * 140}" width="160" height="10" fill="#e63946" opacity="0.7"/>`).join("")}
    <path d="M400 200 L 400 60" stroke="#eafbff" stroke-width="6"/><circle cx="400" cy="56" r="16" fill="#e63946"/>
    <circle cx="400" cy="56" r="60" fill="none" stroke="#e63946" stroke-width="3" opacity="0.6"/><circle cx="400" cy="56" r="110" fill="none" stroke="#e63946" stroke-width="2" opacity="0.35"/>
    ${textBox(60, 1480, 680, "2:58 a. m. La torre del puerto. Ninguna luz debería estar encendida.", { size: 28 })}`,
    "Tira 3: una torre de comunicaciones solitaria bajo la lluvia, con luces rojas parpadeantes y ondas de radio que se expanden desde la antena. Texto: «2:58 a. m. La torre del puerto. Ninguna luz debería estar encendida».",
  );
  strip(
    4,
    `<rect width="${SW}" height="2000" fill="#0a0f1a"/>${ren(400, 300, 1.4)}${textBox(80, 900, 640, "—¿Hola? Escuché tu señal.", { color: "#1d3557", size: 30 })}
    <rect x="0" y="1200" width="${SW}" height="800" fill="#050a18"/><circle cx="400" cy="1560" r="160" fill="#7ee8fa" opacity="0.08"/><circle cx="400" cy="1560" r="90" fill="#7ee8fa" opacity="0.16"/>
    <text x="400" y="1580" font-family="${LETTER_FONT}" font-size="44" font-weight="900" text-anchor="middle" fill="#eafbff">«Por fin. Te estaba esperando.»</text>
    <text x="400" y="1900" font-family="${LETTER_FONT}" font-size="26" text-anchor="middle" fill="#7ee8fa" letter-spacing="6">FIN DEL EPISODIO DEMO</text>`,
    "Tira 4: Ren habla hacia la oscuridad: «¿Hola? Escuché tu señal». Desde una luz tenue responde una voz: «Por fin. Te estaba esperando». Texto final: «Fin del episodio demo».",
  );
  return pages;
}

const manifest = {
  generatedBy: "scripts/manga-demo/generate.mjs",
  license: "Original artwork and story created for KAZE as demonstration content. © KAZE. Not affiliated with any commercial manga.",
  series: {
    "viento-de-papel": { cover: vientoCover(), chapters: { c1: ch1(), "c1-5": ch15(), c2: ch2() } },
    "senal-nocturna": { cover: senalCover(), chapters: { e1: senalStrips() } },
  },
};

mkdirSync(dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("demo manga generated:", Object.entries(manifest.series).map(([k, v]) => `${k}: ${Object.values(v.chapters).reduce((a, c) => a + c.length, 0)} pages`).join(", "));
void nextId;
