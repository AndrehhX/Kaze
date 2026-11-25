// Genera public/og.png (1200×630): la imagen que se ve al compartir la web en Discord, WhatsApp, X…
// Estética Midnight de la web: fondo oscuro, auroras, KAZE en Space Grotesk y 風 en Shippori Mincho.
// Uso: cd scripts/readme-assets && npm install && node og.mjs
// (usa @napi-rs/canvas de deploy/panbot/node_modules: ejecuta antes `npm ci` en deploy/panbot)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(DIR, "../../deploy/panbot/package.json"));
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const F = path.join(DIR, "node_modules/@fontsource");
GlobalFonts.registerFromPath(`${F}/space-grotesk/files/space-grotesk-latin-700-normal.woff2`, "SG");
GlobalFonts.registerFromPath(`${F}/geist-sans/files/geist-sans-latin-400-normal.woff2`, "Geist");
GlobalFonts.registerFromPath(`${F}/geist-sans/files/geist-sans-latin-600-normal.woff2`, "Geist");
GlobalFonts.registerFromPath(`${F}/shippori-mincho/files/shippori-mincho-111-800-normal.woff2`, "SM111");
GlobalFonts.registerFromPath(`${F}/shippori-mincho/files/shippori-mincho-119-800-normal.woff2`, "SM119");

const W = 1200, H = 630;
const c = createCanvas(W, H);
const x = c.getContext("2d");
x.fillStyle = "#080810";
x.fillRect(0, 0, W, H);
const glow = (cx, cy, r, color) => {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
};
glow(900, 170, 520, "rgba(168,85,247,0.45)");
glow(120, 620, 420, "rgba(255,79,216,0.22)");
glow(1150, 600, 380, "rgba(57,198,255,0.16)");
// Rejilla de puntos
x.fillStyle = "rgba(255,255,255,0.05)";
for (let yy = 30; yy < H; yy += 30) for (let xx = 30; xx < W; xx += 30) x.fillRect(xx, yy, 2, 2);

// 風 gigante con contorno
x.save();
x.font = `800 520px "SM111"`;
x.textAlign = "center";
x.textBaseline = "middle";
x.lineWidth = 4;
const kg = x.createLinearGradient(700, 80, 1150, 560);
kg.addColorStop(0, "rgba(200,155,255,0.85)");
kg.addColorStop(1, "rgba(255,79,216,0.55)");
x.strokeStyle = kg;
x.shadowColor = "rgba(168,85,247,0.8)";
x.shadowBlur = 30;
x.strokeText("風", 930, 330);
x.restore();

// Texto
const L = 80;
x.fillStyle = "#c89bff";
x.font = `600 24px "Geist"`;
let cx = L;
for (const ch of "ANIME Y MANGA EN ESPAÑOL") {
  x.fillText(ch, cx, 196);
  cx += x.measureText(ch).width + 4;
}
x.font = `800 24px "SM119"`;
x.fillText("アニメ", cx + 16, 197);

const tg = x.createLinearGradient(L, 220, L, 360);
tg.addColorStop(0, "#ffffff");
tg.addColorStop(1, "#c89bff");
x.fillStyle = tg;
x.font = `700 190px "SG"`;
x.fillText("KAZE", L - 8, 370);

x.fillStyle = "#a9a6c4";
x.font = `400 34px "Geist"`;
x.fillText("Catálogo, reproductor, manga y comunidad.", L, 434);

// Chips
let px = L;
for (const [t, col] of [["orunei.sbs", "#f7f5ff"], ["Web + Android", "#c89bff"], ["Salas de cine", "#ff8be6"]]) {
  x.font = `600 24px "Geist"`;
  const w = x.measureText(t).width + 44;
  x.fillStyle = "rgba(255,255,255,0.07)";
  x.strokeStyle = "rgba(255,255,255,0.16)";
  x.lineWidth = 2;
  x.beginPath();
  x.roundRect(px, 482, w, 52, 26);
  x.fill();
  x.stroke();
  x.fillStyle = col;
  x.fillText(t, px + 22, 517);
  px += w + 14;
}
// Línea degradada inferior
const lg = x.createLinearGradient(0, 0, W, 0);
lg.addColorStop(0, "#ff4fd8");
lg.addColorStop(0.5, "#a855f7");
lg.addColorStop(1, "#39c6ff");
x.fillStyle = lg;
x.fillRect(0, H - 6, W, 6);

const out = path.join(DIR, "../../public/og.png");
fs.writeFileSync(out, c.toBuffer("image/png"));
console.log("escrito", out, Math.round(fs.statSync(out).size / 1024), "KB");
