import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { siteUrl } from "@/lib/env";
import { browseMedia } from "@/lib/anilist/service";

/** Cuántos animes populares se publican en el sitemap (páginas de 50 en AniList). */
const POPULAR_PAGES = 20; // 20 × 50 = 1000 animes

async function getSitemapDate() {
  "use cache";
  cacheLife("days");
  return new Date().toISOString();
}

/**
 * Animes más populares de AniList para que Google indexe sus fichas (/anime/[id]).
 * Las peticiones son secuenciales para no disparar el rate limit de AniList y cada
 * página queda en caché 1 día (browseMedia → cacheLife("days")). Si AniList falla,
 * el sitemap sale igual con lo que se haya podido obtener.
 */
async function getPopularAnimeIds(): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; page <= POPULAR_PAGES; page++) {
    try {
      const { media, pageInfo } = await browseMedia({ sort: "POPULARITY_DESC", page, perPage: 50 });
      for (const m of media) if (!m.isAdult) ids.push(m.id);
      if (!pageInfo.hasNextPage) break;
    } catch {
      break;
    }
  }
  return [...new Set(ids)];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = await getSitemapDate();
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/discover`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/seasonal`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/calendario`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/wrapped`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/discover/moods`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/discover/roulette`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/community`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/library`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/apoyar`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${siteUrl}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const ids = await getPopularAnimeIds();
  const animePages: MetadataRoute.Sitemap = ids.map((id, i) => ({
    url: `${siteUrl}/anime/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    // Los más populares primero: prioridad 0.8 → 0.5.
    priority: Math.max(0.5, +(0.8 - (i / ids.length) * 0.3).toFixed(2)),
  }));

  return [...staticPages, ...animePages];
}
