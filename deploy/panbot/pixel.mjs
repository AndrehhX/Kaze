// Motor pixel art de PanBot: GIFs animados con el estilo de los banners del servidor
// (trama de píxeles, ventanitas retro, texto que se escribe solo, barrido de luz, glitch y destellos).
// Todo se dibuja a baja resolución y se amplía sin suavizar: píxeles de verdad.
//   welcomeGif   bienvenida (banner rosa)
//   leaveGif     despedida (banner morado "Mecu!")
//   levelUpGif   subida de nivel
//   headerGif    cabecera de los paneles (reglas, roles, niveles, tickets)
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import gifenc from "gifenc";
import { G, pixelText } from "./pixel-font.mjs";

const { GIFEncoder } = gifenc;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const BANNER_IN = path.join(DIR, "bienvenida_banner.jpg");
const BANNER_OUT = path.join(DIR, "despedida_banner.jpg");

// Paletas de 8 colores. Índices: 0 fondo, 1 medio, 2 claro, 3 blanco, 4 ventana, 5 acento, 6 dorado, 7 oscuro
export const PINK = [
  [10, 5, 8], [181, 99, 127], [243, 169, 192], [255, 240, 245],
  [34, 12, 28], [168, 85, 247], [253, 224, 71], [120, 48, 84],
];
export const LILAC = [
  [14, 6, 30], [112, 66, 190], [190, 150, 240], [244, 236, 255],
  [24, 10, 44], [255, 79, 216], [253, 224, 71], [62, 28, 112],
];

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

async function load(src) {
  try {
    return await loadImage(src);
  } catch {
    return null;
  }
}

/** Lienzo de índices de paleta a baja resolución. */
class Scene {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h);
  }
  clone() {
    const s = new Scene(this.w, this.h);
    s.px = this.px.slice();
    return s;
  }
  rect(x, y, w, h, c) {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) this.px[yy * this.w + xx] = c;
  }
  text(t, x, y, c, scale = 1) {
    let cx = x;
    for (const ch of t) {
      const g = G[ch];
      if (!g) continue;
      for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r][k] === "1") this.rect(cx + k * scale, y + r * scale, scale, scale, c);
      cx += 6 * scale;
    }
    return cx;
  }
  /** Dibuja una imagen con trama ordenada (look 1-bit). levels: índices de oscuro a claro. */
  dither(img, x0, y0, w, h, levels = [0, 7, 1, 2, 3], fit = "cover") {
    const c = createCanvas(w, h);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (img) {
      const s = fit === "cover" ? Math.max(w / img.width, h / img.height) : Math.min(w / img.width, h / img.height);
      ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
    }
    const d = ctx.getImageData(0, 0, w, h).data;
    const n = levels.length - 1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        const b = (BAYER[(y0 + y) & 3][(x0 + x) & 3] + 0.5) / 16 - 0.5;
        const X = x0 + x, Y = y0 + y;
        if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        this.px[Y * this.w + X] = levels[Math.max(0, Math.min(n, Math.round(l * n + b)))];
      }
  }
  /** Ventanita retro con pestaña y botoncitos. */
  window(x, y, w, h, tab) {
    this.rect(x + 3, y + 3, w, h, 0);
    this.rect(x, y, w, h, 3);
    this.rect(x + 2, y + 2, w - 4, h - 4, 4);
    for (let xx = x + 2; xx < x + w - 2; xx += 2) this.px[(y + 2) * this.w + xx] = 7;
    if (tab) {
      const tw = textW(tab) + 12;
      this.rect(x, y - 13, tw, 14, 3);
      this.rect(x + 2, y - 11, tw - 4, 12, 5);
      this.text(tab, x + 6, y - 9, 3);
    }
    for (const [i, c] of [[0, 2], [1, 1], [2, 5]]) this.rect(x + w - 26 + i * 8, y - 9, 5, 5, c);
  }
  /** Avatar pixelado con marco y esquinas de "ladrillo". */
  avatar(img, x, y, size) {
    this.rect(x - 3, y - 3, size + 6, size + 6, 3);
    this.rect(x - 2, y - 2, size + 4, size + 4, 0);
    this.dither(img, x, y, size, size);
    for (const [dx, dy] of [[-6, -6], [size + 2, -6], [-6, size + 2], [size + 2, size + 2]]) this.rect(x + dx, y + dy, 4, 4, 2);
  }
  sparkle(x, y, t) {
    const len = t === 1 || t === 2 ? 3 : 1;
    this.rect(x - len, y, len * 2 + 1, 1, 3);
    this.rect(x, y - len, 1, len * 2 + 1, 3);
  }
  /** Línea de luz que barre de arriba abajo. */
  scan(f, frames, on = 0, color = 7) {
    const sy = Math.floor((f / frames) * (this.h + 20)) - 10;
    for (let x = 0; x < this.w; x++) {
      if (sy >= 0 && sy < this.h && this.px[sy * this.w + x] === on) this.px[sy * this.w + x] = color;
      if (sy + 1 >= 0 && sy + 1 < this.h && (x & 1) && this.px[(sy + 1) * this.w + x] === on) this.px[(sy + 1) * this.w + x] = color;
    }
  }
  /** Corta franjas horizontales y las desplaza (glitch). */
  glitch(rnd, bands = 4, maxShift = 10) {
    for (let k = 0; k < bands; k++) {
      const y0 = Math.floor(rnd() * (this.h - 6)), hgt = 1 + Math.floor(rnd() * 4), shift = (rnd() < 0.5 ? -1 : 1) * (3 + Math.floor(rnd() * maxShift));
      for (let y = y0; y < y0 + hgt; y++) {
        const row = this.px.slice(y * this.w, (y + 1) * this.w);
        for (let x = 0; x < this.w; x++) this.px[y * this.w + x] = row[(x - shift + this.w) % this.w];
      }
    }
  }
}

export const textW = (t, scale = 1) => [...t].length * 6 * scale - scale;

const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

/** Codifica fotogramas (Scenes) a GIF ampliando ×scale. Si previewFrame es un número, devuelve ese fotograma en PNG. */
function encode(frames, palette, scale, delays, previewFrame) {
  const { w, h } = frames[0];
  const BW = w * scale, BH = h * scale;
  const enc = GIFEncoder();
  for (let f = 0; f < frames.length; f++) {
    if (previewFrame != null && previewFrame !== f) continue;
    const px = frames[f].px;
    const idx = new Uint8Array(BW * BH);
    const row = new Uint8Array(BW);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) row.fill(px[y * w + x], x * scale, x * scale + scale);
      for (let k = 0; k < scale; k++) idx.set(row, (y * scale + k) * BW);
    }
    if (previewFrame === f) {
      const c = createCanvas(BW, BH);
      const cx = c.getContext("2d");
      const im = cx.createImageData(BW, BH);
      for (let i = 0; i < idx.length; i++) {
        const p = palette[idx[i]];
        im.data[i * 4] = p[0];
        im.data[i * 4 + 1] = p[1];
        im.data[i * 4 + 2] = p[2];
        im.data[i * 4 + 3] = 255;
      }
      cx.putImageData(im, 0, 0);
      return c.encode("png");
    }
    enc.writeFrame(idx, BW, BH, { palette, delay: delays[f], repeat: 0 });
  }
  enc.finish();
  return Buffer.from(enc.bytes());
}

function displayName(o) {
  let n = pixelText(o.name);
  if (n.replace(/[^A-Z0-9Ñ]/g, "").length < 2) n = pixelText(o.username);
  return n || "PANITA";
}
const cutTo = (t, max) => (t.length > max ? `${t.slice(0, max - 2)}..` : t);

// ═══════════════════════════════════════════════════════════════════
// Bienvenida
// ═══════════════════════════════════════════════════════════════════
/** @param {{ name: string, username: string, avatarUrl: string, memberNumber: number, previewFrame?: number }} o */
export async function welcomeGif(o) {
  const W = 366, H = 146, FR = 34;
  const base = new Scene(W, H);
  base.dither(await load(BANNER_IN), 0, 0, W, H);
  const WX = 10, WY = 52, WW = 190, WH = 84;
  base.window(WX, WY, WW, WH, "¡BIENVENID@!");
  const AV = 44, AX = WX + 10, AY = WY + 14;
  base.avatar(await load(o.avatarUrl), AX, AY, AV);
  const TX = AX + AV + 10, room = WX + WW - 8 - TX, maxChars = Math.floor(room / 6);
  const name = cutTo(displayName(o), maxChars);
  const nameScale = (name.length + 1) * 12 <= room ? 2 : 1;
  const off = nameScale === 2 ? 4 : 0;
  base.text(cutTo(pixelText(`@${o.username}`), maxChars), TX, AY + 15 + off, 1);
  base.text(`MIEMBRO #${String(o.memberNumber).padStart(3, "0")}`, TX, AY + 28 + off, 6);
  base.text("PAN CON", TX, AY + 41 + off, 2);
  base.text("MANTEQUILLA ♥", TX, AY + 50 + off, 2);

  const rnd = rng(1234 + o.memberNumber);
  const sparkles = Array.from({ length: 7 }, () => [215 + Math.floor(rnd() * 140), 8 + Math.floor(rnd() * 120), Math.floor(rnd() * FR)]);
  const frames = [], delays = [];
  for (let f = 0; f < FR; f++) {
    const s = base.clone();
    const typed = Math.min(name.length, Math.floor((f / 12) * name.length));
    const endX = s.text(name.slice(0, typed), TX, AY + 1, 3, nameScale);
    if (typed < name.length || f % 6 < 3) s.rect(endX, AY + 1, 4 * nameScale, 7 * nameScale, 2);
    for (const [x, y, ph] of sparkles) {
      const t = (f + ph) % FR;
      if (t < 4) s.sparkle(x, y, t);
    }
    s.scan(f, FR);
    if (f === 14 || f === 15 || f === 27) s.glitch(rnd);
    frames.push(s);
    delays.push(f < 12 ? 70 : f === FR - 1 ? 900 : 110);
  }
  return encode(frames, PINK, 3, delays, o.previewFrame);
}

// ═══════════════════════════════════════════════════════════════════
// Despedida: banner morado, "DESCONECTANDO...", glitch fuerte y "SEÑAL PERDIDA"
// ═══════════════════════════════════════════════════════════════════
/** @param {{ name: string, username: string, avatarUrl: string, days?: number|null, previewFrame?: number }} o */
export async function leaveGif(o) {
  const W = 366, H = 146, FR = 36;
  const base = new Scene(W, H);
  base.dither(await load(BANNER_OUT), 0, 0, W, H, [0, 7, 1, 2, 3]);
  const WX = 166, WY = 52, WW = 190, WH = 84; // ventana a la derecha (el "Mecu!" del banner queda a la izquierda)
  base.window(WX, WY, WW, WH, "¡HASTA LUEGO!");
  const AV = 44, AX = WX + 10, AY = WY + 14;
  const avImg = await load(o.avatarUrl);
  base.avatar(avImg, AX, AY, AV);
  const TX = AX + AV + 10, room = WX + WW - 8 - TX, maxChars = Math.floor(room / 6);
  const name = cutTo(displayName(o), maxChars);
  const nameScale = (name.length + 1) * 12 <= room ? 2 : 1;
  const off = nameScale === 2 ? 4 : 0;
  base.text(name, TX, AY + 1, 3, nameScale);
  base.text(cutTo(pixelText(`@${o.username}`), maxChars), TX, AY + 15 + off, 1);
  if (o.days != null) base.text(cutTo(o.days === 0 ? "ESTUVO HOY" : `ESTUVO ${o.days} ${o.days === 1 ? "DIA" : "DIAS"}`, maxChars), TX, AY + 41 + off, 2);
  base.text("VUELVE PRONTO ♥", TX, AY + 50 + off, 5);

  const rnd = rng(777 + name.length);
  const frames = [], delays = [];
  for (let f = 0; f < FR; f++) {
    const s = base.clone();
    // "DESCONECTANDO..." con puntos que van y vienen; al final "SEÑAL PERDIDA" parpadeando
    if (f < 26) s.text(`DESCONECTANDO${".".repeat(1 + (Math.floor(f / 3) % 3))}`, TX, AY + 28 + off, 6);
    else if (f % 4 < 2) s.text("SEÑAL PERDIDA", TX, AY + 28 + off, 5);
    // El avatar se va "rompiendo"
    if (f >= 18) {
      const lines = Math.min(AV, (f - 17) * 4);
      for (let k = 0; k < lines; k += 2) {
        const y = AY + Math.floor(rnd() * AV);
        const shift = Math.floor(rnd() * 7) - 3;
        const rowStart = y * W + AX;
        const row = s.px.slice(rowStart, rowStart + AV);
        for (let x = 0; x < AV; x++) s.px[rowStart + x] = row[Math.min(AV - 1, Math.max(0, x - shift))];
      }
      if (f >= 28) s.rect(AX, AY + Math.floor(rnd() * AV), AV, 2, 3);
    }
    s.scan(f, FR);
    if (f % 9 === 4 || f > 30) s.glitch(rnd, f > 30 ? 7 : 3, 14);
    frames.push(s);
    delays.push(f === FR - 1 ? 1100 : 100);
  }
  return encode(frames, LILAC, 3, delays, o.previewFrame);
}

// ═══════════════════════════════════════════════════════════════════
// Subida de nivel: "LEVEL UP!" que parpadea, barra que se llena y destellos
// ═══════════════════════════════════════════════════════════════════
/** @param {{ name: string, username: string, avatarUrl: string, level: number, into: number, need: number, tier?: string|null, previewFrame?: number }} o */
export async function levelUpGif(o) {
  const W = 240, H = 84, FR = 26;
  const base = new Scene(W, H);
  base.dither(await load(BANNER_IN), 0, 0, W, H, [0, 0, 7, 1, 2]); // banner más oscuro de fondo
  const WX = 8, WY = 18, WW = W - 16, WH = H - 26;
  base.window(WX, WY, WW, WH, o.tier ? "¡NUEVO RANGO!" : "LEVEL UP");
  const AV = 40, AX = WX + 8, AY = WY + 9;
  base.avatar(await load(o.avatarUrl), AX, AY, AV);
  const TX = AX + AV + 10, maxChars = Math.floor((WX + WW - 8 - TX) / 6);
  base.text(cutTo(displayName(o), maxChars), TX, AY + 17, 3);
  base.text(cutTo(o.tier ? `RANGO ${pixelText(o.tier)}` : `NIVEL ${o.level - 1} > ${o.level}`, maxChars), TX, AY + 27, 6);
  const BX = TX, BY = AY + 37, BWID = WX + WW - 10 - TX;
  base.rect(BX - 1, BY - 1, BWID + 2, 6, 3);
  base.rect(BX, BY, BWID, 4, 0);

  const rnd = rng(o.level * 31);
  const sparkles = Array.from({ length: 6 }, () => [Math.floor(rnd() * W), 2 + Math.floor(rnd() * 14), Math.floor(rnd() * FR)]);
  const cycle = [3, 2, 6, 5];
  const pct = o.need ? Math.max(0.03, Math.min(1, o.into / o.need)) : 0.03;
  const frames = [], delays = [];
  for (let f = 0; f < FR; f++) {
    const s = base.clone();
    s.text(`LEVEL UP! ${o.level}`, TX, AY - 1, cycle[Math.floor(f / 2) % cycle.length], 2);
    const fill = Math.round(BWID * pct * Math.min(1, f / 14));
    s.rect(BX, BY, fill, 4, 5);
    if (fill > 1) s.rect(BX, BY, fill, 1, 2);
    for (const [x, y, ph] of sparkles) {
      const t = (f + ph) % FR;
      if (t < 4) s.sparkle(x, y, t);
    }
    if (f === 3 || f === 17) s.glitch(rnd, 2, 6);
    frames.push(s);
    delays.push(f === FR - 1 ? 1200 : 90);
  }
  return encode(frames, PINK, 3, delays, o.previewFrame);
}

// ═══════════════════════════════════════════════════════════════════
// Cabecera de panel (reglas, roles, niveles, tickets)
// ═══════════════════════════════════════════════════════════════════
/** @param {{ title: string, subtitle?: string, tab?: string, palette?: "pink"|"lilac", previewFrame?: number }} o */
export async function headerGif(o) {
  const W = 366, H = 84, FR = 30;
  const lilac = o.palette === "lilac";
  const base = new Scene(W, H);
  base.dither(await load(lilac ? BANNER_OUT : BANNER_IN), 0, 0, W, H, [0, 0, 7, 1, 2]);
  const title = pixelText(o.title);
  const scale = textW(title, 4) <= W - 60 ? 4 : 3;
  const tw = textW(title, scale);
  const WX = 12, WY = 24, WW = Math.min(W - 24, tw + 40), WH = 7 * scale + 26;
  base.window(WX, WY, WW, WH, o.tab ? pixelText(o.tab) : "PAN CON MANTEQUILLA");
  base.text(title, WX + 14, WY + 9, 3, scale);
  if (o.subtitle) base.text(pixelText(o.subtitle), WX + 14, WY + 13 + 7 * scale, 2);

  const rnd = rng(title.length * 97);
  const sparkles = Array.from({ length: 6 }, () => [WX + WW + 10 + Math.floor(rnd() * Math.max(10, W - WX - WW - 20)), 6 + Math.floor(rnd() * (H - 12)), Math.floor(rnd() * FR)]);
  const frames = [], delays = [];
  for (let f = 0; f < FR; f++) {
    const s = base.clone();
    const curX = WX + 14 + tw + scale * 2;
    if (f % 8 < 4 && curX + 3 * scale < WX + WW) s.rect(curX, WY + 9, 3 * scale, 7 * scale, 2);
    for (const [x, y, ph] of sparkles) {
      const t = (f + ph) % FR;
      if (t < 4) s.sparkle(x, y, t);
    }
    s.scan(f, FR);
    if (f === 20) s.glitch(rnd, 3, 8);
    frames.push(s);
    delays.push(110);
  }
  return encode(frames, lilac ? LILAC : PINK, 3, delays, o.previewFrame);
}
