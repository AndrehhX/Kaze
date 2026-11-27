"use client";

import type { Wrapped, WrappedTop } from "@/lib/wrapped";
import { genreLabel } from "@/lib/anilist/browse-params";

const W = 1080;
const H = 1920;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // las portadas de AniList permiten CORS; si no, se omiten
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    setTimeout(() => resolve(null), 6000);
  });
}

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Reduce el tamaño de letra hasta que el texto quepa (mínimo `min` px); si no, lo recorta. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: number, size: number, min: number, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > min && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return fitText(ctx, text, maxWidth);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Dibuja la tarjeta del Wrapped con los colores del tema activo. */
export async function drawWrappedCard({ w, top, name, edition }: { w: Wrapped; top: WrappedTop[]; name: string; edition?: "tormenta" | null }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // Temas claros (Sakura, Zen): la tarjeta va siempre en oscuro para que el texto blanco se lea.
  const themeBg = cssVar("--k-bg", "#080810");
  const hex = /^#([0-9a-f]{6})$/i.exec(themeBg)?.[1];
  const lum = hex ? (0.299 * parseInt(hex.slice(0, 2), 16) + 0.587 * parseInt(hex.slice(2, 4), 16) + 0.114 * parseInt(hex.slice(4, 6), 16)) / 255 : 0;
  const bg = lum > 0.5 ? "#0d0b14" : themeBg;
  const primary = cssVar("--k-primary", "#a855f7");
  const accent = cssVar("--k-accent", "#ff4fd8");
  const text = "#f7f5ff";
  const muted = "rgba(247,245,255,0.7)";
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  // Fondo
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const g1 = ctx.createRadialGradient(200, 250, 0, 200, 250, 900);
  g1.addColorStop(0, `${primary}aa`);
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(950, 1750, 0, 950, 1750, 900);
  g2.addColorStop(0, `${accent}88`);
  g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Edición Tormenta (Apoya KAZE): marco dorado y sello arriba a la derecha.
  if (edition === "tormenta") {
    const gold = ctx.createLinearGradient(0, 0, W, H);
    gold.addColorStop(0, "#fbbf24");
    gold.addColorStop(0.5, "#a855f7");
    gold.addColorStop(1, "#fbbf24");
    ctx.strokeStyle = gold;
    ctx.lineWidth = 18;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.font = `800 30px ${font}`;
    const label = "⚡ EDICIÓN TORMENTA";
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(251,191,36,0.16)";
    ctx.fillRect(W - 90 - lw - 32, 112, lw + 32, 52);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(label, W - 90 - lw - 16, 149);
  }

  // Cabecera
  ctx.fillStyle = text;
  ctx.font = `800 52px ${font}`;
  ctx.fillText("KAZE", 90, 150);
  ctx.font = `600 34px ${font}`;
  ctx.fillStyle = muted;
  ctx.fillText(`Wrapped ${w.year}`, 90, 205);

  ctx.fillStyle = text;
  ctx.font = `800 84px ${font}`;
  ctx.fillText(fitText(ctx, name, W - 180), 90, 330);
  ctx.font = `500 40px ${font}`;
  ctx.fillStyle = muted;
  ctx.fillText("Mi año en anime", 90, 390);

  // Cifras grandes
  const stats: [string, string][] = [
    [String(Math.floor(w.minutes / 60)), "horas"],
    [String(w.episodes), "episodios"],
    [String(w.series), "series"],
  ];
  stats.forEach(([v, l], n) => {
    const x = 90 + n * 320;
    roundRect(ctx, x, 460, 290, 220, 36);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.fillStyle = text;
    ctx.font = `800 96px ${font}`;
    ctx.fillText(fitText(ctx, v, 250), x + 28, 590);
    ctx.font = `500 34px ${font}`;
    ctx.fillStyle = muted;
    ctx.fillText(l, x + 30, 645);
  });

  // Top 3 con portadas
  ctx.fillStyle = text;
  ctx.font = `700 44px ${font}`;
  ctx.fillText("Mis animes del año", 90, 790);
  const covers = await Promise.all(top.slice(0, 3).map((t) => (t.cover ? loadImage(t.cover) : Promise.resolve(null))));
  top.slice(0, 3).forEach((t, n) => {
    const y = 840 + n * 230;
    roundRect(ctx, 90, y, 900, 200, 28);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    const img = covers[n];
    if (img) {
      ctx.save();
      roundRect(ctx, 110, y + 20, 115, 160, 16);
      ctx.clip();
      ctx.drawImage(img, 110, y + 20, 115, 160);
      ctx.restore();
    }
    ctx.fillStyle = accent;
    ctx.font = `800 56px ${font}`;
    ctx.fillText(`${n + 1}`, 260, y + 118);
    ctx.fillStyle = text;
    ctx.font = `700 42px ${font}`;
    ctx.fillText(fitText(ctx, t.title, 640), 320, y + 95);
    ctx.font = `500 32px ${font}`;
    ctx.fillStyle = muted;
    ctx.fillText(`${t.episodes} episodios`, 320, y + 145);
  });

  // Género y personalidad
  const py = 1560;
  if (w.topGenres[0]) {
    ctx.fillStyle = muted;
    ctx.font = `500 34px ${font}`;
    ctx.fillText("Género favorito", 90, py);
    ctx.fillStyle = text;
    ctx.fillText(fitFont(ctx, genreLabel(w.topGenres[0].name), 420, 800, 52, 34, font), 90, py + 65);
  }
  ctx.fillStyle = muted;
  ctx.font = `500 34px ${font}`;
  ctx.fillText("Personalidad", 560, py);
  ctx.fillStyle = text;
  ctx.fillText(fitFont(ctx, w.personality.name, 430, 800, 52, 32, font), 560, py + 65);

  // Pie
  const grad = ctx.createLinearGradient(90, 0, 990, 0);
  grad.addColorStop(0, primary);
  grad.addColorStop(1, accent);
  roundRect(ctx, 90, 1730, 900, 110, 55);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 42px ${font}`;
  const cta = "Haz el tuyo en www.orunei.sbs/wrapped";
  ctx.fillText(cta, 540 - ctx.measureText(cta).width / 2, 1800);

  return canvas;
}
