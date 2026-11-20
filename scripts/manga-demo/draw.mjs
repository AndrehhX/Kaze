/**
 * Tiny SVG drawing kit for the KAZE Originals demo manga.
 * Every shape here is original artwork authored for this project (no traced or copied material).
 */

export const INK = "#141414";
export const PAPER = "#fbfaf6";
export const LETTER_FONT = "'Trebuchet MS', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
export const JP_FONT = "'Yu Gothic', 'Hiragino Sans', 'Noto Sans JP', 'Meiryo', sans-serif";

let uid = 0;
export const nextId = (p = "k") => `${p}${++uid}`;
export const resetIds = () => (uid = 0);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Shared pattern/gradient definitions for black & white pages. */
export function toneDefs() {
  return `
  <pattern id="tone-dots" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="4.5" cy="4.5" r="1.9" fill="${INK}"/></pattern>
  <pattern id="tone-light" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="5.5" cy="5.5" r="1.2" fill="${INK}"/></pattern>
  <pattern id="tone-dense" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="3.5" cy="3.5" r="2.4" fill="${INK}"/></pattern>
  <pattern id="tone-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><line x1="0" y1="0" x2="0" y2="8" stroke="${INK}" stroke-width="1.6"/></pattern>
  <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9c9c9"/><stop offset="0.55" stop-color="#efefef"/><stop offset="1" stop-color="${PAPER}"/></linearGradient>
  <linearGradient id="dusk-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f6f6f"/><stop offset="1" stop-color="#e9e9e9"/></linearGradient>
  <radialGradient id="glow-grad" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`;
}

export function svgDoc({ w, h, body, defs = "", title, bg = PAPER }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">
<title>${esc(title)}</title>
<defs>${toneDefs()}${defs}</defs>
<rect width="${w}" height="${h}" fill="${bg}"/>
${body}
</svg>
`;
}

/** A framed panel: content is clipped to the rounded-rect frame, border drawn on top. */
export function panel({ x, y, w, h }, content, { border = 5, fill = "#ffffff", bleed = false } = {}) {
  const id = nextId("clip");
  const frame = bleed ? "" : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${INK}" stroke-width="${border}"/>`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>
<g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>${typeof content === "function" ? content({ x, y, w, h }) : content}</g>${frame}`;
}

/** Radial speed lines converging on (cx, cy). Deterministic so builds are reproducible. */
export function speedLines({ x, y, w, h }, cx, cy, { count = 90, inner = 120, color = INK, seed = 7 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const R = Math.hypot(w, h);
  let out = "";
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.05;
    const r0 = inner + rnd() * 60;
    const width = 1 + rnd() * 3.2;
    const x1 = cx + Math.cos(a) * r0, y1 = cy + Math.sin(a) * r0;
    const x2 = cx + Math.cos(a) * R, y2 = cy + Math.sin(a) * R;
    const xa = cx + Math.cos(a + 0.012 * width) * R, ya = cy + Math.sin(a + 0.012 * width) * R;
    out += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${xa.toFixed(1)} ${ya.toFixed(1)} Z" fill="${color}"/>`;
  }
  return `<g opacity="0.92">${out}</g>`;
}

/** Horizontal wind streaks — the recurring motif of "Viento de Papel". */
export function windLines(x, y, w, { rows = 6, gap = 26, seed = 3, color = INK, opacity = 0.75 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = "";
  for (let i = 0; i < rows; i++) {
    const yy = y + i * gap + rnd() * 10;
    const x0 = x + rnd() * w * 0.3;
    const len = w * (0.35 + rnd() * 0.5);
    const curl = 18 + rnd() * 20;
    out += `<path d="M${x0} ${yy} C ${x0 + len * 0.4} ${yy - 8}, ${x0 + len * 0.7} ${yy + 8}, ${x0 + len} ${yy} q ${curl} -4 ${curl * 0.6} -${curl * 0.7}" fill="none" stroke="${color}" stroke-width="${2 + rnd() * 2}" stroke-linecap="round"/>`;
  }
  return `<g opacity="${opacity}">${out}</g>`;
}

export function cloud(x, y, s = 1, fill = "#ffffff") {
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="3" fill="${fill}">
  <path d="M-110 30 C -130 -10 -80 -40 -55 -20 C -45 -65 15 -70 30 -30 C 60 -55 110 -30 100 10 C 135 15 130 50 100 52 L -95 52 C -130 52 -135 30 -110 30 Z"/></g>`;
}

/** Simple hill-town skyline: houses with sloped roofs on a ridge. */
export function hillTown({ x, y, w, h }, { seed = 11, tone = "url(#tone-light)" } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const base = y + h * 0.62;
  let out = `<path d="M${x} ${base + 40} C ${x + w * 0.25} ${base - 30}, ${x + w * 0.6} ${base - 10}, ${x + w} ${base + 20} L ${x + w} ${y + h} L ${x} ${y + h} Z" fill="${tone}" stroke="${INK}" stroke-width="3"/>`;
  let cx = x - 20;
  while (cx < x + w) {
    const bw = 60 + rnd() * 70;
    const bh = 50 + rnd() * 70;
    const t = (cx - x) / w;
    const ground = base + 40 - Math.sin(t * Math.PI) * 55;
    out += `<rect x="${cx}" y="${ground - bh}" width="${bw}" height="${bh + 30}" fill="#ffffff" stroke="${INK}" stroke-width="3"/>`;
    out += `<path d="M${cx - 8} ${ground - bh} L ${cx + bw / 2} ${ground - bh - 30 - rnd() * 18} L ${cx + bw + 8} ${ground - bh} Z" fill="${INK}"/>`;
    out += `<rect x="${cx + bw * 0.3}" y="${ground - bh + 16}" width="${bw * 0.22}" height="${bw * 0.22}" fill="url(#tone-dense)" stroke="${INK}" stroke-width="2"/>`;
    cx += bw + 6 + rnd() * 14;
  }
  return out;
}

export function paperPlane(x, y, s = 1, rot = -12) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" stroke="${INK}" stroke-width="3" stroke-linejoin="round">
  <path d="M-60 0 L 70 -22 L -20 26 Z" fill="#ffffff"/>
  <path d="M-20 26 L 70 -22 L -12 6 Z" fill="url(#tone-light)"/>
  <path d="M-60 0 L -12 6" fill="none"/></g>`;
}

/** Hana — the courier. Poses: bust | surprised | back | throw | run. */
export function hana(x, y, s = 1, { pose = "bust", flip = false, mood = "calm" } = {}) {
  const t = `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`;
  const eyes =
    mood === "surprised"
      ? `<ellipse cx="-24" cy="4" rx="12" ry="17" fill="#ffffff" stroke="${INK}" stroke-width="3"/><circle cx="-24" cy="6" r="6" fill="${INK}"/><ellipse cx="24" cy="4" rx="12" ry="17" fill="#ffffff" stroke="${INK}" stroke-width="3"/><circle cx="24" cy="6" r="6" fill="${INK}"/>`
      : mood === "smile"
        ? `<path d="M-36 6 Q -24 -6 -12 6" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M12 6 Q 24 -6 36 6" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
        : `<ellipse cx="-24" cy="6" rx="11" ry="15" fill="${INK}"/><circle cx="-28" cy="0" r="4" fill="#ffffff"/><ellipse cx="24" cy="6" rx="11" ry="15" fill="${INK}"/><circle cx="20" cy="0" r="4" fill="#ffffff"/>`;
  const mouth =
    mood === "surprised" ? `<ellipse cx="0" cy="42" rx="7" ry="9" fill="${INK}"/>` : mood === "smile" ? `<path d="M-12 36 Q 0 50 12 36" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>` : `<path d="M-7 40 L 7 40" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  const head = `
    <path d="M-12 62 L -14 96 L 14 96 L 12 62 Z" fill="#ffffff" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="0" cy="8" rx="58" ry="66" fill="#ffffff" stroke="${INK}" stroke-width="3.5"/>
    ${eyes}${mouth}
    <path d="M-30 30 l 8 -3 M30 30 l -8 -3" stroke="${INK}" stroke-width="2" opacity="0.6"/>
    <path d="M-74 22 C -86 -64 -42 -100 2 -100 C 50 -100 88 -62 74 22 L 66 52 C 60 18 56 -6 44 -28 C 26 -6 -6 -12 -30 -34 C -42 -8 -52 18 -62 52 Z" fill="${INK}"/>
    <path d="M-40 -70 C -20 -86 22 -88 40 -72" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
    <path d="M52 -40 l 26 -18 l -6 22 z" fill="${INK}"/>`;
  const scarf = `<path d="M-46 92 C -10 112 20 112 50 92 L 56 112 C 20 134 -16 134 -50 112 Z" fill="url(#tone-dots)" stroke="${INK}" stroke-width="3"/>
    <path d="M40 104 C 110 90 150 120 220 96 C 200 128 150 150 92 140 C 70 136 54 128 44 120 Z" fill="url(#tone-dots)" stroke="${INK}" stroke-width="3"/>`;
  const torso = `<path d="M-70 200 C -70 130 -40 104 0 104 C 40 104 70 130 70 200 Z" fill="#ffffff" stroke="${INK}" stroke-width="3.5"/>
    <path d="M-30 112 L -50 200 M30 112 L 50 200" stroke="${INK}" stroke-width="3" fill="none"/>`;
  if (pose === "back") {
    return `<g transform="${t}">
      <path d="M-80 260 C -80 150 -46 112 0 112 C 46 112 80 150 80 260 Z" fill="#ffffff" stroke="${INK}" stroke-width="3.5"/>
      <path d="M-60 120 C 20 100 110 140 230 100 C 210 150 130 170 60 150 Z" fill="url(#tone-dots)" stroke="${INK}" stroke-width="3"/>
      <ellipse cx="0" cy="8" rx="60" ry="66" fill="${INK}"/>
      <path d="M-60 40 C -64 70 -50 92 -30 100 M60 40 C 64 70 50 92 30 100" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M-30 -48 C -10 -60 20 -60 36 -46" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.8"/>
      <rect x="-90" y="180" width="60" height="70" fill="url(#tone-light)" stroke="${INK}" stroke-width="3" transform="rotate(-8)"/>
    </g>`;
  }
  if (pose === "throw") {
    return `<g transform="${t}">${torso}
      <path d="M40 130 C 80 90 110 40 120 -40" stroke="${INK}" stroke-width="26" fill="none" stroke-linecap="round"/>
      <path d="M40 130 C 80 90 110 40 120 -40" stroke="#ffffff" stroke-width="19" fill="none" stroke-linecap="round"/>
      <circle cx="122" cy="-52" r="16" fill="#ffffff" stroke="${INK}" stroke-width="3"/>
      ${scarf}${head}</g>`;
  }
  if (pose === "run") {
    return `<g transform="${t}">
      <path d="M-30 300 L -90 420 M30 300 L 110 400 L 150 380" stroke="${INK}" stroke-width="24" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-30 300 L -90 420 M30 300 L 110 400 L 150 380" stroke="#ffffff" stroke-width="17" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-62 300 C -70 200 -40 104 0 104 C 44 104 70 200 62 300 Z" fill="#ffffff" stroke="${INK}" stroke-width="3.5" transform="rotate(10)"/>
      <rect x="-120" y="170" width="80" height="90" rx="8" fill="url(#tone-light)" stroke="${INK}" stroke-width="3"/>
      <path d="M-40 120 C -120 110 -200 150 -300 120 C -270 170 -180 180 -100 160 Z" fill="url(#tone-dots)" stroke="${INK}" stroke-width="3"/>
      ${head}</g>`;
  }
  return `<g transform="${t}">${torso}${scarf}${head}</g>`;
}

/** Sr. Ito — the old postmaster. */
export function ito(x, y, s = 1, { flip = false } = {}) {
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})" stroke="${INK}" stroke-width="3.5">
    <path d="M-90 220 C -90 130 -50 100 0 100 C 50 100 90 130 90 220 Z" fill="url(#tone-hatch)"/>
    <path d="M-20 100 L 0 150 L 20 100" fill="#ffffff"/>
    <ellipse cx="0" cy="10" rx="62" ry="72" fill="#ffffff"/>
    <path d="M-62 -10 C -60 -50 -30 -70 0 -70 C 30 -70 60 -50 62 -10" fill="none"/>
    <path d="M-64 0 C -80 -10 -80 30 -62 34 M64 0 C 80 -10 80 30 62 34" fill="url(#tone-light)"/>
    <circle cx="-24" cy="4" r="16" fill="none" stroke-width="4"/><circle cx="24" cy="4" r="16" fill="none" stroke-width="4"/>
    <path d="M-8 4 L 8 4" stroke-width="4"/>
    <circle cx="-24" cy="6" r="4" fill="${INK}" stroke="none"/><circle cx="24" cy="6" r="4" fill="${INK}" stroke="none"/>
    <path d="M-34 40 C -20 30 -6 34 0 40 C 6 34 20 30 34 40 C 22 52 -22 52 -34 40 Z" fill="#9a9a9a"/>
    <path d="M-40 -28 l 22 -4 M40 -28 l -22 -4" stroke-width="5" stroke-linecap="round"/>
  </g>`;
}

function wrap(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Speech balloon with a tail pointing at (tx, ty). Text is real, selectable SVG text. */
export function bubble(cx, cy, text, { tx, ty, rx, size = 26, shape = "round", maxChars = 16 } = {}) {
  const lines = wrap(text, maxChars);
  const lh = size * 1.18;
  const width = rx ?? Math.max(...lines.map((l) => l.length)) * size * 0.33 + 34;
  const height = (lines.length * lh) / 2 + 30;
  let tail = "";
  if (tx !== undefined) {
    const ang = Math.atan2(ty - cy, tx - cx);
    const bx = cx + Math.cos(ang) * width * 0.75;
    const by = cy + Math.sin(ang) * height * 0.75;
    const px = Math.cos(ang + Math.PI / 2) * 14;
    const py = Math.sin(ang + Math.PI / 2) * 14;
    tail = `<path d="M${bx + px} ${by + py} L ${tx} ${ty} L ${bx - px} ${by - py} Z" fill="#ffffff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
  }
  const outline =
    shape === "shout"
      ? `<path d="${burst(cx, cy, width + 18, height + 18)}" fill="#ffffff" stroke="${INK}" stroke-width="4"/>`
      : shape === "thought"
        ? `<ellipse cx="${cx}" cy="${cy}" rx="${width}" ry="${height}" fill="#ffffff" stroke="${INK}" stroke-width="3" stroke-dasharray="10 7"/>`
        : `<ellipse cx="${cx}" cy="${cy}" rx="${width}" ry="${height}" fill="#ffffff" stroke="${INK}" stroke-width="3.5"/>`;
  const start = cy - ((lines.length - 1) * lh) / 2 + size * 0.35;
  const tspans = lines.map((l, i) => `<tspan x="${cx}" y="${(start + i * lh).toFixed(1)}">${esc(l)}</tspan>`).join("");
  return `${tail}${outline}${shape === "round" && tail ? `<ellipse cx="${cx}" cy="${cy}" rx="${width - 2}" ry="${height - 2}" fill="#ffffff"/>` : ""}<text font-family="${LETTER_FONT}" font-size="${size}" font-weight="700" text-anchor="middle" fill="${INK}" letter-spacing="0.5">${tspans}</text>`;
}

function burst(cx, cy, rx, ry, spikes = 18) {
  let d = "";
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const k = i % 2 === 0 ? 1.12 : 0.9;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d + "Z";
}

/** Rectangular caption box (narration). */
export function caption(x, y, w, text, { size = 22, maxChars = 30, dark = false } = {}) {
  const lines = wrap(text, maxChars);
  const lh = size * 1.25;
  const h = lines.length * lh + 26;
  const fg = dark ? "#ffffff" : INK;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${dark ? INK : "#ffffff"}" stroke="${INK}" stroke-width="3"/>
  <text font-family="${LETTER_FONT}" font-size="${size}" font-style="italic" fill="${fg}">${lines.map((l, i) => `<tspan x="${x + 16}" y="${y + 18 + size * 0.85 + i * lh}">${esc(l)}</tspan>`).join("")}</text>`;
}

/** Hand-lettered style sound effect: katakana with a romanized whisper beneath. */
export function sfx(x, y, jp, roman, { size = 110, rot = -8 } = {}) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <text font-family="${JP_FONT}" font-size="${size}" font-weight="900" text-anchor="middle" fill="${INK}" stroke="#ffffff" stroke-width="10" paint-order="stroke" letter-spacing="-4">${esc(jp)}</text>
    <text y="${size * 0.42}" font-family="${LETTER_FONT}" font-size="${size * 0.22}" font-weight="700" text-anchor="middle" fill="${INK}" stroke="#ffffff" stroke-width="5" paint-order="stroke">${esc(roman)}</text></g>`;
}

export function pageNumber(w, h, n) {
  return `<text x="${w / 2}" y="${h - 18}" font-family="${LETTER_FONT}" font-size="20" text-anchor="middle" fill="#8a8a8a">${n}</text>`;
}

export function demoWatermark(w, h) {
  return `<text x="${w - 24}" y="${h - 18}" font-family="${LETTER_FONT}" font-size="15" text-anchor="end" fill="#a3a3a3" letter-spacing="2">KAZE ORIGINALS · DEMO</text>`;
}
