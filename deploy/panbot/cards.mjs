// Tarjetas PNG de PanBot (bienvenida y nivel) con @napi-rs/canvas.
// Fuentes de la web de KAZE (Space Grotesk + Geist, licencia OFL) en ./fonts; DejaVu como respaldo en la VPS.
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

const DIR = path.dirname(fileURLToPath(import.meta.url));
GlobalFonts.registerFromPath(path.join(DIR, "fonts", "SpaceGrotesk-Bold.woff2"), "Space Grotesk");
GlobalFonts.registerFromPath(path.join(DIR, "fonts", "Geist-Regular.woff2"), "Geist");
GlobalFonts.registerFromPath(path.join(DIR, "fonts", "Geist-SemiBold.woff2"), "Geist");

// Shippori Mincho (la de la web) solo con los trozos que contienen los kanji/kana que usamos.
GlobalFonts.registerFromPath(path.join(DIR, "fonts", "jp", "shippori-mincho-117-800-normal.woff2"), "SM117");
GlobalFonts.registerFromPath(path.join(DIR, "fonts", "jp", "shippori-mincho-119-800-normal.woff2"), "SM119");
const JP_FONT = { よ: "SM119", う: "SM119", こ: "SM119", そ: "SM119", り: "SM119", 新: "SM117", 入: "SM117" };
const JP = (ch) => `"${JP_FONT[ch] ?? "SM119"}", serif`;

const DISPLAY = `"Space Grotesk", "DejaVu Sans", sans-serif`;
const BODY = `"Geist", "DejaVu Sans", sans-serif`;
export const BUTTER = "#fde047";
export const PURPLE = "#a855f7";
const INK = "#f7f5ff";
const MUTED = "#c9c5e4";

const fmt = (n) => String(Math.round(n)).replace(/B(?=(d{3})+(?!d))/g, ".");
/** Deja solo lo que las fuentes pueden dibujar: letras "decoradas" (𝗕𝗼𝗹𝗱, ｆｕｌｌ) → normales; fuera emojis, japonés, etc. */
const plain = (t) =>
  String(t || "")
    .normalize("NFKC")
    .replace(/[^ -ɏ‘-‟…]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const WELCOME_BG = path.join(DIR, "bienvenida_banner.jpg");

async function safeImage(src) {
  try {
    return await loadImage(src);
  } catch {
    return null;
  }
}

/** Dibuja una imagen cubriendo el rectángulo (como object-fit: cover). */
function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Avatar redondo con anillo de color y brillo. */
function avatar(ctx, img, cx, cy, r, ring = BUTTER) {
  ctx.save();
  ctx.shadowColor = PURPLE;
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  else {
    ctx.fillStyle = "#2a2440";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

/** Recorta el texto con "…" para que quepa en maxW. */
function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

/** Ajusta el tamaño de fuente hasta que el texto quepa (entre max y min). */
function sizeToFit(ctx, text, family, weight, max, min, maxW) {
  let s = max;
  for (; s > min; s -= 2) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.font = `${weight} ${s}px ${family}`;
  return s;
}

function spaced(ctx, text, x, y, tracking) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

function spacedCenter(ctx, text, cx, y, tracking) {
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  const w = [...text].reduce((n, ch) => n + ctx.measureText(ch).width + tracking, -tracking);
  spaced(ctx, text, cx - w / 2, y, tracking);
  ctx.textAlign = prev;
}

/**
 * Tarjeta de bienvenida 1100×440 con la estética de la web de KAZE (tema Midnight):
 * el banner del servidor de fondo, velo oscuro, luces morada/rosa/cian, Space Grotesk,
 * etiquetas en mayúsculas espaciadas, ようこそ en Shippori Mincho y chips de cristal.
 * @param {{ name: string, username: string, avatarUrl: string, memberNumber: number }} o
 */
export async function welcomeCard(o) {
  const W = 1100, H = 440;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  const BG = "#080810", INKP = "#c89bff", PINK = "#ff4fd8", CYAN = "#39c6ff", INDIGO = "#6d5ef8";
  const num = String(o.memberNumber).padStart(3, "0");

  roundRect(ctx, 0, 0, W, H, 32);
  ctx.save();
  ctx.clip();

  // Fondo: el banner del servidor + velo Midnight
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const bg = await safeImage(WELCOME_BG);
  if (bg) cover(ctx, bg, 0, 0, W, H);
  const veil = ctx.createLinearGradient(0, 0, W, 0);
  veil.addColorStop(0, "rgba(8,8,16,0.96)");
  veil.addColorStop(0.5, "rgba(8,8,16,0.82)");
  veil.addColorStop(1, "rgba(8,8,16,0.30)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  // Auroras de la web
  const aurora = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace("A", a));
    g.addColorStop(1, color.replace("A", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  aurora(200, 230, 330, "rgba(168,85,247,A)", "0.42");
  aurora(40, 430, 260, "rgba(255,79,216,A)", "0.22");
  aurora(620, -40, 300, "rgba(57,198,255,A)", "0.16");

  // ようこそ vertical gigante, como marca de agua (derecha)
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(247,245,255,0.10)";
  let vy = 92;
  for (const ch of "ようこそ") {
    ctx.font = `800 96px ${JP(ch)}`;
    ctx.fillText(ch, W - 92, vy);
    vy += 100;
  }
  ctx.restore();

  // Borde de cristal
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, W - 2, H - 2, 31);
  ctx.stroke();

  // ── Avatar con anillo degradado (rosa → morado → cian) ──
  const AX = 205, AY = 220, AR = 122;
  ctx.save();
  ctx.shadowColor = "rgba(168,85,247,0.9)";
  ctx.shadowBlur = 50;
  const ring = ctx.createLinearGradient(AX - AR, AY - AR, AX + AR, AY + AR);
  ring.addColorStop(0, PINK);
  ring.addColorStop(0.5, PURPLE);
  ring.addColorStop(1, CYAN);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(AX, AY, AR + 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(AX, AY, AR + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(AX, AY, AR, 0, Math.PI * 2);
  ctx.clip();
  const av = await safeImage(o.avatarUrl);
  if (av) ctx.drawImage(av, AX - AR, AY - AR, AR * 2, AR * 2);
  ctx.restore();

  // ── Texto ──
  const x = 388, maxW = W - x - 170;
  ctx.textAlign = "left";
  ctx.fillStyle = INKP;
  ctx.font = `600 18px ${BODY}`;
  spaced(ctx, "WELCOME", x, 118, 4);
  const wW = [..."WELCOME"].reduce((n, ch) => n + ctx.measureText(ch).width + 4, 0);
  ctx.fillStyle = "rgba(200,155,255,0.55)";
  ctx.fillText("·", x + wW + 6, 118);
  ctx.font = `800 20px ${JP("よ")}`;
  ctx.fillStyle = INKP;
  let jx = x + wW + 24;
  for (const ch of "ようこそ") {
    ctx.font = `800 20px ${JP(ch)}`;
    ctx.fillText(ch, jx, 119);
    jx += ctx.measureText(ch).width + 2;
  }

  const clean = plain(o.name);
  const name = clean.replace(/[^A-Za-z0-9]/g, "").length >= 2 ? clean : o.username;
  sizeToFit(ctx, name, DISPLAY, 700, 76, 40, maxW);
  const nameGrad = ctx.createLinearGradient(x, 140, x + Math.min(maxW, ctx.measureText(name).width), 220);
  nameGrad.addColorStop(0, "#f7f5ff");
  nameGrad.addColorStop(1, INKP);
  ctx.fillStyle = nameGrad;
  ctx.fillText(fit(ctx, name, maxW), x, 196);

  ctx.fillStyle = "#a9a6c4";
  ctx.font = `400 26px ${BODY}`;
  ctx.fillText(fit(ctx, `@${o.username}`, maxW), x, 238);

  // Línea degradada de la web
  const line = ctx.createLinearGradient(x, 0, x + 300, 0);
  line.addColorStop(0, PINK);
  line.addColorStop(0.5, PURPLE);
  line.addColorStop(1, CYAN);
  ctx.fillStyle = line;
  roundRect(ctx, x, 268, 300, 4, 2);
  ctx.fill();

  // Chips de cristal
  const chip = (label, cx, color) => {
    ctx.font = `600 17px ${BODY}`;
    const w = [...label].reduce((n, ch) => n + ctx.measureText(ch).width + 1.5, 0) + 36;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    roundRect(ctx, cx, 300, w, 42, 21);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = color;
    spaced(ctx, label, cx + 18, 327, 1.5);
    return cx + w + 12;
  };
  let cx = chip(`MIEMBRO #${num}`, x, "#f7f5ff");
  cx = chip("PAN CON MANTEQUILLA", cx, BUTTER);
  chip("× KAZE", cx, INKP);

  ctx.fillStyle = "rgba(169,166,196,0.8)";
  ctx.font = `400 19px ${BODY}`;
  ctx.fillText("Siéntete como en casa, panita.", x, 384);

  return c.encode("png");
}

/**
 * Tarjeta de nivel 1000×300.
 * @param {{ name: string, avatarUrl: string, level: number, rank: number|null, into: number, need: number, totalXp: number, tier: string|null }} o
 */
export async function rankCard(o) {
  const W = 1000, H = 300;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");

  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  const bgImg = await safeImage(WELCOME_BG);
  if (bgImg) {
    cover(ctx, bgImg, 0, 0, W, H);
    ctx.fillStyle = "rgba(8,8,16,0.86)";
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = "#0d0b18";
    ctx.fillRect(0, 0, W, H);
  }
  const glow = ctx.createRadialGradient(150, H / 2, 10, 150, H / 2, 260);
  glow.addColorStop(0, "rgba(168,85,247,0.35)");
  glow.addColorStop(1, "rgba(168,85,247,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  avatar(ctx, await safeImage(o.avatarUrl), 150, H / 2, 92, PURPLE);

  const x = 290, right = W - 50;
  // Rango y nivel a la derecha
  ctx.textAlign = "right";
  ctx.fillStyle = "#c89bff";
  ctx.font = `700 64px ${DISPLAY}`;
  ctx.fillText(String(o.level), right, 100);
  const lvlW = ctx.measureText(String(o.level)).width;
  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${BODY}`;
  ctx.fillText("NIVEL", right - lvlW - 14, 100);
  if (o.rank) {
    const nivelW = ctx.measureText("NIVEL").width;
    ctx.fillStyle = INK;
    ctx.font = `700 40px ${DISPLAY}`;
    ctx.fillText(`#${o.rank}`, right - lvlW - nivelW - 40, 100);
  }
  ctx.textAlign = "left";

  // Nombre
  ctx.fillStyle = INK;
  const name = plain(o.name) || "Usuario";
  sizeToFit(ctx, name, DISPLAY, 700, 46, 28, 380);
  ctx.fillText(fit(ctx, name, 380), x, 100);
  if (o.tier) {
    ctx.fillStyle = BUTTER;
    ctx.font = `600 22px ${BODY}`;
    ctx.fillText(plain(o.tier), x, 138);
  }

  // Barra de progreso
  const by = 190, bw = right - x, bh = 30;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  roundRect(ctx, x, by, bw, bh, bh / 2);
  ctx.fill();
  const pct = Math.max(0.02, Math.min(1, o.need ? o.into / o.need : 0));
  const grad = ctx.createLinearGradient(x, 0, x + bw, 0);
  grad.addColorStop(0, "#ff4fd8");
  grad.addColorStop(0.5, PURPLE);
  grad.addColorStop(1, "#39c6ff");
  ctx.fillStyle = grad;
  roundRect(ctx, x, by, bw * pct, bh, bh / 2);
  ctx.fill();

  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${BODY}`;
  ctx.fillText(`${fmt(o.into)} / ${fmt(o.need)} XP`, x, by + bh + 36);
  ctx.textAlign = "right";
  ctx.fillText(`${fmt(o.totalXp)} XP en total`, right, by + bh + 36);
  ctx.textAlign = "left";

  return c.encode("png");
}
