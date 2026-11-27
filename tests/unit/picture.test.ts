import { describe, expect, it } from "vitest";
import { DEFAULT_PICTURE, PICTURE_PRESETS, pictureFilter, pictureValues } from "@/lib/player/picture";

describe("Imagen del reproductor", () => {
  it("normal no aplica filtro", () => {
    expect(pictureFilter(DEFAULT_PICTURE)).toBeUndefined();
    expect(pictureFilter(undefined)).toBeUndefined();
  });

  it("un perfil usa sus valores aunque lo guardado diga otra cosa", () => {
    const v = pictureValues({ preset: "vivido", brightness: 50, contrast: 50, saturation: 50 });
    expect(v.saturation).toBe(PICTURE_PRESETS.vivido.saturation);
    expect(pictureFilter({ ...DEFAULT_PICTURE, preset: "vivido" })).toContain("saturate(128%)");
  });

  it("personalizado respeta los límites", () => {
    const v = pictureValues({ preset: "custom", brightness: 999, contrast: -5, saturation: Number.NaN });
    expect(v).toEqual({ brightness: 150, contrast: 60, saturation: 100 });
  });
});
