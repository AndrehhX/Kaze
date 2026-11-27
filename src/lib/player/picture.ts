/**
 * Imagen del reproductor: modo de "Mejorar imagen" (Anime4K) y ajustes de color.
 * Va aparte de los componentes para que los ajustes (stores/settings) puedan usar los tipos.
 */

/** off = apagado · max = Anime4K Mode A · light = red pequeña para gráficas modestas. */
export type EnhanceMode = "off" | "max" | "light";

// ── Ajustes de color (filtros CSS: los aplica la tarjeta gráfica, casi no gastan) ──

export type PicturePreset = "normal" | "vivido" | "cine" | "noche" | "custom";
export type PicturePrefs = { preset: PicturePreset; brightness: number; contrast: number; saturation: number };

export const PICTURE_PRESETS: Record<Exclude<PicturePreset, "custom">, { label: string; hint: string; brightness: number; contrast: number; saturation: number }> = {
  normal: { label: "Normal", hint: "Como viene", brightness: 100, contrast: 100, saturation: 100 },
  vivido: { label: "Vívido", hint: "Colores más vivos", brightness: 102, contrast: 106, saturation: 128 },
  cine: { label: "Cine", hint: "Más contraste", brightness: 97, contrast: 114, saturation: 108 },
  noche: { label: "Noche", hint: "Aclara escenas oscuras", brightness: 116, contrast: 94, saturation: 104 },
};

export const DEFAULT_PICTURE: PicturePrefs = { preset: "normal", brightness: 100, contrast: 100, saturation: 100 };

/** Valores efectivos (si es un perfil, los del perfil). */
export function pictureValues(p: PicturePrefs | undefined) {
  const v = !p || p.preset === "custom" ? p ?? DEFAULT_PICTURE : PICTURE_PRESETS[p.preset] ?? PICTURE_PRESETS.normal;
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 100));
  return { brightness: clamp(v.brightness, 60, 150), contrast: clamp(v.contrast, 60, 150), saturation: clamp(v.saturation, 0, 200) };
}

/** Filtro CSS para el video (o el canvas mejorado). undefined si todo está al 100 %. */
export function pictureFilter(p: PicturePrefs | undefined) {
  const v = pictureValues(p);
  if (v.brightness === 100 && v.contrast === 100 && v.saturation === 100) return undefined;
  return `brightness(${v.brightness}%) contrast(${v.contrast}%) saturate(${v.saturation}%)`;
}
