import "server-only";
import { getMangaDetail } from "@/lib/anilist/manga-service";
import { demoBySlug } from "@/lib/manga/demo/series";

/** A manga route segment is either a KAZE Originals slug or a positive AniList id. */
export async function resolveManga(param: string) {
  const demo = demoBySlug(param);
  if (demo) return { kind: "demo" as const, demo };
  const id = Number.parseInt(param, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== param) return null;
  const media = await getMangaDetail(id);
  if (!media || media.isAdult) return null;
  return { kind: "anilist" as const, media };
}

export const STATIC_MANGA_PARAMS = [{ id: "viento-de-papel" }, { id: "senal-nocturna" }];
