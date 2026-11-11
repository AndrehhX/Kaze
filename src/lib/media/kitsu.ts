import "server-only";
import { cacheLife, cacheTag } from "next/cache";

export interface KitsuEpisodeInfo {
  number: number;
  title: string;
  thumbnail: string | null;
}

async function fetchKitsuEntries(
  title: string,
  romajiTitle: string,
): Promise<[number, KitsuEpisodeInfo][] | null> {
  "use cache";
  cacheLife("days");
  cacheTag("kitsu:episodes");

  const queries = Array.from(
    new Set([
      title,
      romajiTitle,
      title.replace(/[:\-]/g, " ").replace(/\s+/g, " ").trim(),
      romajiTitle.replace(/[:\-]/g, " ").replace(/\s+/g, " ").trim(),
    ]),
  ).filter((q) => Boolean(q) && q.length > 2);

  for (const q of queries) {
    try {
      const searchUrl = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=1`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Kaze/2.0" },
        signal: AbortSignal.timeout(2500),
        next: { revalidate: 86400 },
      });
      if (!res.ok) continue;

      const json = await res.json();
      const anime = json.data?.[0];
      if (!anime?.id) continue;

      const epUrl = `https://kitsu.io/api/edge/episodes?filter[mediaId]=${anime.id}&filter[mediaType]=Anime&page[limit]=100&sort=number`;
      const epRes = await fetch(epUrl, {
        headers: { "User-Agent": "Kaze/2.0" },
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 86400 },
      });
      if (!epRes.ok) continue;

      const epJson = await epRes.json();
      if (!epJson.data || epJson.data.length === 0) continue;

      const entries: [number, KitsuEpisodeInfo][] = [];
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
          const epNum = Number(num);
          entries.push([
            epNum,
            {
              number: epNum,
              title: epTitle.trim(),
              thumbnail: thumb,
            },
          ]);
        }
      }

      if (entries.length > 0) {
        return entries;
      }
    } catch {
      // try next query
    }
  }

  return null;
}

/**
 * Fetches verified season-specific episode titles and thumbnails from Kitsu.
 * Used when AniList streamingEpisodes are contaminated by Crunchyroll's Season 1 bundle.
 */
export async function getKitsuSeasonEpisodes(
  title: string,
  romajiTitle = "",
): Promise<Map<number, KitsuEpisodeInfo> | null> {
  const entries = await fetchKitsuEntries(title, romajiTitle);
  return entries ? new Map<number, KitsuEpisodeInfo>(entries) : null;
}
