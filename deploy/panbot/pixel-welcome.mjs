// Bienvenida animada en pixel art (GIF), con el estilo de los banners del servidor:
// arte manga rosa/negro con trama de píxeles, ventanita retro tipo "Mecu!", texto que se escribe solo,
// cursor parpadeante, barrido de luz, cortes glitch y destellos "+".
// Todo se dibuja a baja resolución (366×146) y se amplía ×3 sin suavizar: píxeles de verdad.
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import gifenc from "gifenc";

const { GIFEncoder } = gifenc;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const BANNER = path.join(DIR, "bienvenida_banner.jpg");

const LW = 366, LH = 146, SCALE = 3;

// Paleta (8 colores): la de tus banners + morado KAZE y amarillo mantequilla para detalles
const PAL = [
  [10, 5, 8], //    0 negro
  [181, 99, 127], // 1 rosa medio
  [243, 169, 192], // 2 rosa claro
  [255, 240, 245], // 3 blanco rosado
  [34, 12, 28], //  4 fondo de ventana
  [168, 85, 247], // 5 morado KAZE
  [253, 224, 71], // 6 mantequilla
  [120, 48, 84], //  7 rosa oscuro
];

// ── Fuente pixel 5×7 hecha a mano (mayúsculas, números y signos) ──
const G = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  "Ñ": ["01110", "00000", "10001", "11001", "10101", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "¡": ["00100", "00000", "00100", "00100", "00100", "00100", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "¿": ["00100", "00000", "00100", "01000", "10000", "10001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01110"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "×": ["00000", "10001", "01010", "00100", "01010", "10001", "00000"],
  "♥": ["00000", "01010", "11111", "11111", "01110", "00100", "00000"],
  "▮": ["11110", "11110", "11110", "11110", "11110", "11110", "11110"],
};

/** Texto apto para la fuente: mayúsculas, sin tildes (menos la Ñ) y sin lo que no existe. */
function pixelText(s) {
  return String(s || "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/Ñ/g, "\u0000")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0000/g, "Ñ")
    .split("")
    .filter((ch) => G[ch])
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function drawText(px, text, x, y, color, scale = 1) {
  let cx = x;
  for (const ch of text) {
    const g = G[ch];
    if (!g) continue;
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 5; c++) if (g[r][c] === "1") rect(px, cx + c * scale, y + r * scale, scale, scale, color);
    cx += 6 * scale;
  }
  return cx;
}
const textW = (t, scale = 1) => t.length * 6 * scale - scale;

// ── "Lienzo" de índices de paleta ──
function rect(px, x, y, w, h, color) {
  for (let yy = Math.max(0, y); yy < Math.min(LH, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(LW, x + w); xx++) px[yy * LW + xx] = color;
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Pasa una imagen a la paleta rosa con trama ordenada (dithering): el look 1-bit de tus banners. */
function ditherInto(px, rgba, x0, y0, w, h, levels = [0, 7, 1, 2, 3]) {
  const n = levels.length - 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] < 128) continue;
      const l = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255;
      const b = (BAYER[(y0 + y) & 3][(x0 + x) & 3] + 0.5) / 16 - 0.5;
      const idx = Math.max(0, Math.min(n, Math.round(l * n + b)));
      px[(y0 + y) * LW + (x0 + x)] = levels[idx];
    }
}

async function load(src) {
  try {
    return await loadImage(src);
  } catch {
    return null;
  }
}

function coverDraw(ctx, img, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
}

/**
 * GIF animado de bienvenida (1098×438).
 * @param {{ name: string, username: string, avatarUrl: string, memberNumber: number }} o
 */
export async function welcomeGif(o) {
  // 1) Fondo: tu banner a baja resolución y con trama rosa
  const base = new Uint8Array(LW * LH);
  const tmp = createCanvas(LW, LH);
  const tctx = tmp.getContext("2d");
  tctx.fillStyle = "#000";
  tctx.fillRect(0, 0, LW, LH);
  const banner = await load(BANNER);
  if (banner) coverDraw(tctx, banner, LW, LH);
  ditherInto(base, tctx.getImageData(0, 0, LW, LH).data, 0, 0, LW, LH);

  // 2) Ventanita retro (como la de "Mecu!")
  const WX = 10, WY = 52, WW = 190, WH = 84;
  rect(base, WX + 3, WY + 3, WW, WH, 0); // sombra
  rect(base, WX, WY, WW, WH, 3);
  rect(base, WX + 2, WY + 2, WW - 4, WH - 4, 4);
  for (let x = WX + 2; x < WX + WW - 2; x += 2) base[(WY + 2) * LW + x] = 7; // línea punteada de borde
  // Pestaña
  const tab = "¡BIENVENID@!";
  const tabW = textW(tab) + 12;
  rect(base, WX, WY - 13, tabW, 14, 3);
  rect(base, WX + 2, WY - 11, tabW - 4, 12, 5);
  drawText(base, tab, WX + 6, WY - 9, 3);
  // Botoncitos de ventana
  for (const [i, c] of [[0, 2], [1, 1], [2, 5]]) rect(base, WX + WW - 26 + i * 8, WY - 9, 5, 5, c);

  // 3) Avatar pixelado y con trama, en marco de ladrillos
  const AV = 44, AX = WX + 10, AY = WY + 14;
  rect(base, AX - 3, AY - 3, AV + 6, AV + 6, 3);
  rect(base, AX - 2, AY - 2, AV + 4, AV + 4, 0);
  const av = await load(o.avatarUrl);
  const actx = createCanvas(AV, AV).getContext("2d");
  if (av) actx.drawImage(av, 0, 0, AV, AV);
  else {
    actx.fillStyle = "#f3a9c0";
    actx.fillRect(0, 0, AV, AV);
  }
  ditherInto(base, actx.getImageData(0, 0, AV, AV).data, AX, AY, AV, AV, [0, 7, 1, 2, 3]);
  // esquinitas de "ladrillo" como en el banner
  for (const [dx, dy] of [[-6, -6], [AV + 2, -6], [-6, AV + 2], [AV + 2, AV + 2]]) rect(base, AX + dx, AY + dy, 4, 4, 2);

  // 4) Textos fijos
  const TX = AX + AV + 10;
  const maxChars = Math.floor((WX + WW - 8 - TX) / 6);
  const cut = (t) => (t.length > maxChars ? `${t.slice(0, maxChars - 2)}..` : t);
  let name = pixelText(o.name);
  if (name.replace(/[^A-Z0-9Ñ]/g, "").length < 2) name = pixelText(o.username);
  name = cut(name || "PANITA");
  const user = cut(pixelText(`@${o.username}`));
  const num = String(o.memberNumber).padStart(3, "0");
  // El nombre va al doble de tamaño si cabe
  const nameScale = (name.length + 1) * 12 <= WX + WW - 8 - TX ? 2 : 1;
  const off = nameScale === 2 ? 4 : 0;
  drawText(base, user, TX, AY + 15 + off, 1);
  drawText(base, `MIEMBRO #${num}`, TX, AY + 28 + off, 6);
  drawText(base, "PAN CON", TX, AY + 41 + off, 2);
  drawText(base, "MANTEQUILLA ♥", TX, AY + 50 + off, 2);

  // 5) Fotogramas
  const FRAMES = 34;
  const enc = GIFEncoder();
  const palette = PAL;
  let seed = 1234 + o.memberNumber;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const sparkles = Array.from({ length: 7 }, () => [215 + Math.floor(rnd() * 140), 8 + Math.floor(rnd() * 120), Math.floor(rnd() * FRAMES)]);

  for (let f = 0; f < FRAMES; f++) {
    const px = base.slice();
    // Nombre que se escribe solo + cursor
    const typed = Math.min(name.length, Math.floor((f / 12) * name.length));
    const endX = drawText(px, name.slice(0, typed), TX, AY + 1, 3, nameScale);
    if (typed < name.length || f % 6 < 3) rect(px, endX, AY + 1, 4 * nameScale, 7 * nameScale, 2);
    // Destellos "+"
    for (const [sx, sy, ph] of sparkles) {
      const t = (f + ph) % FRAMES;
      if (t < 4) {
        const len = t === 1 || t === 2 ? 3 : 1;
        rect(px, sx - len, sy, len * 2 + 1, 1, 3);
        rect(px, sx, sy - len, 1, len * 2 + 1, 3);
      }
    }
    // Barrido de luz (línea que baja)
    const sy = Math.floor((f / FRAMES) * (LH + 20)) - 10;
    for (let x = 0; x < LW; x++) {
      if (sy >= 0 && sy < LH && px[sy * LW + x] === 0) px[sy * LW + x] = 7;
      if (sy + 1 >= 0 && sy + 1 < LH && px[(sy + 1) * LW + x] === 0 && (x & 1)) px[(sy + 1) * LW + x] = 7;
    }
    // Cortes glitch en algunos fotogramas
    if (f === 14 || f === 15 || f === 27) {
      for (let k = 0; k < 4; k++) {
        const y0 = Math.floor(rnd() * (LH - 6)), hgt = 1 + Math.floor(rnd() * 4), shift = (rnd() < 0.5 ? -1 : 1) * (3 + Math.floor(rnd() * 9));
        for (let y = y0; y < y0 + hgt; y++) {
          const row = px.slice(y * LW, (y + 1) * LW);
          for (let x = 0; x < LW; x++) px[y * LW + x] = row[(x - shift + LW) % LW];
        }
      }
    }
    // Ampliar ×3 copiando índices (píxeles nítidos, sin pasar por RGB)
    const BW = LW * SCALE;
    const idx = new Uint8Array(BW * LH * SCALE);
    for (let y = 0; y < LH; y++) {
      const row = new Uint8Array(BW);
      for (let x = 0; x < LW; x++) row.fill(px[y * LW + x], x * SCALE, x * SCALE + SCALE);
      for (let k = 0; k < SCALE; k++) idx.set(row, (y * SCALE + k) * BW);
    }
    if (o.previewFrame === f) {
      // Solo para revisar el diseño: devuelve ese fotograma como PNG
      const c = createCanvas(BW, LH * SCALE);
      const cx = c.getContext("2d");
      const im = cx.createImageData(BW, LH * SCALE);
      for (let i = 0; i < idx.length; i++) {
        const p = palette[idx[i]];
        im.data.set([p[0], p[1], p[2], 255], i * 4);
      }
      cx.putImageData(im, 0, 0);
      return c.encode("png");
    }
    const delay = f < 12 ? 70 : f === FRAMES - 1 ? 900 : 110;
    enc.writeFrame(idx, LW * SCALE, LH * SCALE, { palette, delay, repeat: 0 });
  }
  enc.finish();
  return Buffer.from(enc.bytes());
}
