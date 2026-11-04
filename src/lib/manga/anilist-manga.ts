import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { anilistRequest } from "@/lib/anilist/client";
import { MANGA_HOME_QUERY, MANGA_DETAILS_QUERY } from "@/lib/anilist/queries";
import type { MangaCard } from "@/lib/anilist/types";

export interface MangaHomeData {
  trending: (MangaCard & { description?: string | null })[];
  popular: (MangaCard & { description?: string | null })[];
  manhwa: (MangaCard & { description?: string | null })[];
  topRated: MangaCard[];
}

export async function getMangaHomeData(): Promise<MangaHomeData> {
  "use cache";
  cacheLife("hours");
  cacheTag("anilist:manga-home");

  type R = {
    trending: { media: (MangaCard & { description?: string | null })[] };
    popular: { media: (MangaCard & { description?: string | null })[] };
    manhwa: { media: (MangaCard & { description?: string | null })[] };
    topRated: { media: MangaCard[] };
  };

  const d = await anilistRequest<R>(MANGA_HOME_QUERY);
  return {
    trending: d.trending.media,
    popular: d.popular.media,
    manhwa: d.manhwa.media,
    topRated: d.topRated.media,
  };
}

export async function getMangaDetails(id: number) {
  "use cache";
  cacheLife("hours");
  cacheTag(`anilist:manga:${id}`);

  type R = {
    Media: any;
  };

  try {
    const d = await anilistRequest<R>(MANGA_DETAILS_QUERY, { id });
    return d.Media;
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return null;
    throw err;
  }
}
