// Mini motor de texto → trazos SVG con las fuentes reales de KAZE.
import opentype from "opentype.js";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fs_ = (pkg) => join(here, "node_modules", "@fontsource", pkg, "files");
const load = (p) => {
  const b = readFileSync(p);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

/** Familias: archivo latino fijo o lista de subconjuntos (japonés). */
const FAMILIES = {
  display: { files: [join(fs_("space-grotesk"), "space-grotesk-latin-700-normal.woff"), join(fs_("space-grotesk"), "space-grotesk-latin-ext-700-normal.woff")] },
  displayMid: { files: [join(fs_("space-grotesk"), "space-grotesk-latin-500-normal.woff"), join(fs_("space-grotesk"), "space-grotesk-latin-ext-500-normal.woff")] },
  label: { files: [join(fs_("geist-sans"), "geist-sans-latin-600-normal.woff")] },
  body: { files: [join(fs_("geist-sans"), "geist-sans-latin-400-normal.woff")] },
  bodyMid: { files: [join(fs_("geist-sans"), "geist-sans-latin-500-normal.woff")] },
  mono: { files: [join(fs_("geist-mono"), "geist-mono-latin-500-normal.woff")] },
  mincho: { dir: fs_("shippori-mincho"), match: /-800-normal\.woff$/ },
  jp: { dir: fs_("noto-sans-jp"), match: /-400-normal\.woff$/ },
  jpBold: { dir: fs_("noto-sans-jp"), match: /-700-normal\.woff$/ },
};
const parsed = new Map();
const fontAt = (p) => (parsed.has(p) ? parsed.get(p) : (parsed.set(p, load(p)), parsed.get(p)));
const filesOf = (fam) => {
  const f = FAMILIES[fam];
  if (f.files) return f.files;
  f.files = readdirSync(f.dir).filter((n) => f.match.test(n)).map((n) => join(f.dir, n));
  return f.files;
};
const charCache = new Map();
/** Fuente que contiene ese carácter dentro de la familia (los subconjuntos japoneses van por rangos). */
function fontFor(fam, ch) {
  const k = fam + ch;
  if (charCache.has(k)) return charCache.get(k);
  let hit = null;
  for (const p of filesOf(fam)) {
    const font = fontAt(p);
    if (font.charToGlyphIndex(ch) > 0) {
      hit = font;
      break;
    }
  }
  if (!hit && ch !== " ") throw new Error(`Sin glifo "${ch}" en ${fam}`);
  charCache.set(k, hit ?? fontAt(filesOf(fam)[0]));
  return charCache.get(k);
}

/** Documento SVG: guarda los glifos usados en <defs> y los reutiliza con <use>. */
export class Doc {
  constructor(w, h, label) {
    this.w = w;
    this.h = h;
    this.label = label;
    this.glyphs = new Map();
    this.defs = [];
    this.body = [];
  }
  glyphId(fam, ch) {
    const id = `${fam[0]}${fam.length}${ch.codePointAt(0).toString(36)}`;
    if (!this.glyphs.has(id)) {
      const font = fontFor(fam, ch);
      const d = font.charToGlyph(ch).getPath(0, 0, 100).toPathData(1);
      this.glyphs.set(id, d);
    }
    return id;
  }
  /** Mide el ancho de un texto. */
  measure(str, { f = "body", size = 16, ls = 0 } = {}) {
    let w = 0;
    const chars = [...str];
    chars.forEach((ch, i) => {
      const font = fontFor(f, ch);
      const g = font.charToGlyph(ch);
      w += (g.advanceWidth * size) / font.unitsPerEm;
      const next = chars[i + 1];
      if (next) {
        const nf = fontFor(f, next);
        if (nf === font) w += (font.getKerningValue(g, font.charToGlyph(next)) * size) / font.unitsPerEm;
        w += ls * size;
      }
    });
    return w;
  }
  /** Texto con color sólido (glifos reutilizables). */
  text(str, { x = 0, y = 0, f = "body", size = 16, ls = 0, fill = "#fff", anchor = "start", opacity, extra = "" } = {}) {
    const width = this.measure(str, { f, size, ls });
    let cx = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
    const s = size / 100;
    const parts = [];
    const chars = [...str];
    chars.forEach((ch, i) => {
      const font = fontFor(f, ch);
      const g = font.charToGlyph(ch);
      if (ch !== " ") parts.push(`<use href="#${this.glyphId(f, ch)}" transform="translate(${r(cx)} ${r(y)}) scale(${r(s, 4)})"/>`);
      cx += (g.advanceWidth * size) / font.unitsPerEm;
      const next = chars[i + 1];
      if (next) {
        const nf = fontFor(f, next);
        if (nf === font) cx += (font.getKerningValue(g, font.charToGlyph(next)) * size) / font.unitsPerEm;
        cx += ls * size;
      }
    });
    this.body.push(`<g fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ""}${extra}>${parts.join("")}</g>`);
    return width;
  }
  /** Texto como un único trazo absoluto (sirve para degradados y contornos). */
  textPath(str, { x = 0, y = 0, f = "display", size = 100, ls = 0, anchor = "start", attrs = "" } = {}) {
    const width = this.measure(str, { f, size, ls });
    let cx = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
    let d = "";
    const chars = [...str];
    chars.forEach((ch, i) => {
      const font = fontFor(f, ch);
      const g = font.charToGlyph(ch);
      if (ch !== " ") d += g.getPath(cx, y, size).toPathData(1);
      cx += (g.advanceWidth * size) / font.unitsPerEm;
      const next = chars[i + 1];
      if (next) {
        const nf = fontFor(f, next);
        if (nf === font) cx += (font.getKerningValue(g, font.charToGlyph(next)) * size) / font.unitsPerEm;
        cx += ls * size;
      }
    });
    this.body.push(`<path d="${d}" ${attrs}/>`);
    return width;
  }
  add(...s) {
    this.body.push(...s);
  }
  def(...s) {
    this.defs.push(...s);
  }
  toString() {
    const glyphs = [...this.glyphs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" role="img" aria-label="${esc(this.label)}"><title>${esc(this.label)}</title><defs>${glyphs}${this.defs.join("")}</defs>${this.body.join("")}</svg>\n`;
  }
}

export const r = (n, p = 1) => {
  const m = 10 ** p;
  return Math.round(n * m) / m;
};
export const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Paleta del tema Midnight de la web (src/app/globals.css). */
export const C = {
  bg: "#080810",
  surface: "#12121f",
  elevated: "#1b1b2c",
  text: "#f7f5ff",
  muted: "#a9a6c4",
  dim: "#6f6b8f",
  primary: "#a855f7",
  ink: "#c89bff",
  indigo: "#6d5ef8",
  pink: "#ff4fd8",
  cyan: "#39c6ff",
  gold: "#ffd166",
  line: "rgba(168,85,247,0.22)",
  lineSoft: "rgba(168,85,247,0.12)",
};

/** Iconos de Lucide (licencia ISC), dibujados en una caja de 24×24. */
export const ICONS = {
  globe: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>`,
  book: `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
  tv: `<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  phone: `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>`,
  play: `<polygon points="6 3 20 12 6 21 6 3"/>`,
  arrow: `<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`,
};
export const icon = (name, x, y, size, color, sw = 2) =>
  `<g transform="translate(${x} ${y}) scale(${r(size / 24, 4)})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;
