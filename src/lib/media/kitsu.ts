import "server-only";

export interface KitsuEpisodeInfo {
  number: number;
  title: string;
  thumbnail: string | null;
}

const kitsuCache = new Map<string, Map<number, KitsuEpisodeInfo> | null>();

/**
 * Fetches verified season-specific episode titles and thumbnails from Kitsu.
 * Used when AniList streamingEpisodes are contaminated by Crunchyroll's Season 1 bundle.
 */
export async function getKitsuSeasonEpisodes(
  title: string,
  romajiTitle = ""
): Promise<Map<number, KitsuEpisodeInfo> | null> {
  const cacheKey = `${title}:::${romajiTitle}`;
  if (kitsuCache.has(cacheKey)) {
    return kitsuCache.get(cacheKey)!;
  }

  const queries = Array.from(
    new Set([
      title,
      romajiTitle,
      title.replace(/[:\-]/g, " ").replace(/\s+/g, " ").trim(),
      romajiTitle.replace(/[:\-]/g, " ").replace(/\s+/g, " ").trim(),
    ])
  ).filter((q) => Boolean(q) && q.length > 2);

  for (const q of queries) {
    try {
      const searchUrl = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=1`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Kaze/2.0" },
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) continue;

      const json = await res.json();
      const anime = json.data?.[0];
      if (!anime?.id) continue;

      const epUrl = `https://kitsu.io/api/edge/episodes?filter[mediaId]=${anime.id}&filter[mediaType]=Anime&page[limit]=100&sort=number`;
      const epRes = await fetch(epUrl, {
        headers: { "User-Agent": "Kaze/2.0" },
        signal: AbortSignal.timeout(4000),
      });
      if (!epRes.ok) continue;

      const epJson = await epRes.json();
      if (!epJson.data || epJson.data.length === 0) continue;

      const map = new Map<number, KitsuEpisodeInfo>();
      for (const item of epJson.data) {
        const num = item.attributes?.number;
        const epTitle =
          item.attributes?.canonicalTitle ||
          item.attributes?.titles?.en ||
          item.attributes?.titles?.en_us ||
          item.attributes?.titles?.en_jp;
        const thumb =
          item.attributes?.thumbnail?.original ||
          item.attributes?.thumbnail?.large ||
          item.attributes?.thumbnail?.medium ||
          null;

        if (num != null && epTitle && typeof epTitle === "string" && epTitle !== "undefined") {
          map.set(Number(num), {
            number: Number(num),
            title: epTitle.trim(),
            thumbnail: thumb,
          });
        }
      }

      if (map.size > 0) {
        kitsuCache.set(cacheKey, map);
        return map;
      }
    } catch {
      // try next query
    }
  }

  kitsuCache.set(cacheKey, null);
  return null;
}
