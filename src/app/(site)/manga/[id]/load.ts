import "server-only";
import { getMangaDetail } from "@/lib/anilist/manga-service";

/** A manga route segment is a positive AniList id. */
export async function resolveManga(param: string) {
  const id = Number.parseInt(param, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== param) return null;
  const media = await getMangaDetail(id);
  if (!media || media.isAdult) return null;
  return { kind: "anilist" as const, media };
}
