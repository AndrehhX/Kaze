import type { MangaChapter, MangaPage } from "@/lib/anilist/types";

const MANGADEX_API_BASE = "https://api.mangadex.org";
const USER_AGENT = "KazeManga/1.0 (https://www.orunei.sbs)";

interface MangaDexMangaItem {
  id: string;
  type: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Record<string, string>[];
    status?: string;
  };
}

interface MangaDexChapterItem {
  id: string;
  type: string;
  attributes: {
    volume: string | null;
    chapter: string | null;
    title: string | null;
    translatedLanguage: string;
    publishAt: string;
    pages: number;
  };
  relationships?: {
    id: string;
    type: string;
    attributes?: {
      name?: string;
    };
  }[];
}

/**
 * Searches MangaDex for a manga/manhwa by title.
 * Tries multiple titles (romaji, english, synonyms) if provided.
 */
export async function searchMangaDex(
  titles: string[]
): Promise<{ id: string; title: string } | null> {
  for (const rawTitle of titles) {
    if (!rawTitle || rawTitle.trim().length === 0) continue;
    const cleanTitle = rawTitle.trim();

    try {
      const url = new URL(`${MANGADEX_API_BASE}/manga`);
      url.searchParams.set("title", cleanTitle);
      url.searchParams.set("limit", "5");
      url.searchParams.append("contentRating[]", "safe");
      url.searchParams.append("contentRating[]", "suggestive");
      url.searchParams.append("contentRating[]", "erotica");

      const res = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT },
        next: { revalidate: 86400 }, // Cache search for 24h
      });

      if (!res.ok) continue;

      const data = (await res.json()) as { data: MangaDexMangaItem[] };
      if (data.data && data.data.length > 0) {
        const first = data.data[0];
        const displayTitle =
          first.attributes.title.en ||
          first.attributes.title["ja-ro"] ||
          Object.values(first.attributes.title)[0] ||
          cleanTitle;

        return { id: first.id, title: displayTitle };
      }
    } catch (err) {
      console.warn(`[MangaDex] Error searching for "${cleanTitle}":`, err);
    }
  }

  return null;
}

/**
 * Fetches all Spanish chapters (es-la and es) for a given MangaDex ID.
 * Deduplicates multiple scanlation groups by chapter number, selecting the most complete.
 */
export async function getMangaDexChapters(
  mangaDexId: string
): Promise<MangaChapter[]> {
  try {
    const url = new URL(`${MANGADEX_API_BASE}/manga/${mangaDexId}/feed`);
    url.searchParams.append("translatedLanguage[]", "es-la");
    url.searchParams.append("translatedLanguage[]", "es");
    url.searchParams.set("order[chapter]", "asc");
    url.searchParams.set("limit", "500");
    url.searchParams.append("contentRating[]", "safe");
    url.searchParams.append("contentRating[]", "suggestive");
    url.searchParams.append("contentRating[]", "erotica");
    url.searchParams.append("includes[]", "scanlation_group");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 3600 }, // Cache chapters for 1 hour
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { data: MangaDexChapterItem[] };
    if (!data.data || data.data.length === 0) {
      // Fallback: If no spanish chapters, try English chapters so user can still read
      return getMangaDexChaptersFallbackEn(mangaDexId);
    }

    // Map and deduplicate chapters by chapter number
    const chapterMap = new Map<string, MangaChapter>();

    for (const item of data.data) {
      const chNum = item.attributes.chapter ?? "0";
      const scanGroup = item.relationships?.find(
        (r) => r.type === "scanlation_group"
      )?.attributes?.name;

      const chapterObj: MangaChapter = {
        id: item.id,
        chapter: chNum,
        volume: item.attributes.volume,
        title: item.attributes.title,
        language: item.attributes.translatedLanguage,
        scanlationGroup: scanGroup || undefined,
        publishedAt: item.attributes.publishAt,
        pagesCount: item.attributes.pages,
      };

      // Keep the one with highest page count if duplicate
      const existing = chapterMap.get(chNum);
      if (!existing || (item.attributes.pages && item.attributes.pages > (existing.pagesCount || 0))) {
        chapterMap.set(chNum, chapterObj);
      }
    }

    // Sort chapters numerically (e.g. 1, 2, 2.5, 10)
    return Array.from(chapterMap.values()).sort((a, b) => {
      const numA = parseFloat(a.chapter) || 0;
      const numB = parseFloat(b.chapter) || 0;
      return numA - numB;
    });
  } catch (err) {
    console.error(`[MangaDex] Error fetching chapters for ${mangaDexId}:`, err);
    return [];
  }
}

/** Fallback to English if no Spanish translation exists */
async function getMangaDexChaptersFallbackEn(mangaDexId: string): Promise<MangaChapter[]> {
  try {
    const url = new URL(`${MANGADEX_API_BASE}/manga/${mangaDexId}/feed`);
    url.searchParams.append("translatedLanguage[]", "en");
    url.searchParams.set("order[chapter]", "asc");
    url.searchParams.set("limit", "500");
    url.searchParams.append("includes[]", "scanlation_group");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];
    const data = (await res.json()) as { data: MangaDexChapterItem[] };
    if (!data.data) return [];

    const chapterMap = new Map<string, MangaChapter>();
    for (const item of data.data) {
      const chNum = item.attributes.chapter ?? "0";
      const scanGroup = item.relationships?.find(
        (r) => r.type === "scanlation_group"
      )?.attributes?.name;

      const chapterObj: MangaChapter = {
        id: item.id,
        chapter: chNum,
        volume: item.attributes.volume,
        title: item.attributes.title,
        language: item.attributes.translatedLanguage,
        scanlationGroup: scanGroup || undefined,
        publishedAt: item.attributes.publishAt,
        pagesCount: item.attributes.pages,
      };

      const existing = chapterMap.get(chNum);
      if (!existing || (item.attributes.pages && item.attributes.pages > (existing.pagesCount || 0))) {
        chapterMap.set(chNum, chapterObj);
      }
    }

    return Array.from(chapterMap.values()).sort((a, b) => {
      const numA = parseFloat(a.chapter) || 0;
      const numB = parseFloat(b.chapter) || 0;
      return numA - numB;
    });
  } catch {
    return [];
  }
}

/**
 * Retrieves the direct high-res page image URLs for a chapter via MangaDex@Home.
 * The images are hosted on MangaDex's global CDN network (0 bandwidth on Vercel).
 */
export async function getMangaDexPages(chapterId: string): Promise<MangaPage[]> {
  try {
    const res = await fetch(`${MANGADEX_API_BASE}/at-home/server/${chapterId}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 7200 }, // Cache chapter pages for 2 hours
    });

    if (!res.ok) return [];

    const data = await res.json();
    const baseUrl = data.baseUrl;
    const hash = data.chapter?.hash;
    const pageFiles: string[] = data.chapter?.data || [];

    if (!baseUrl || !hash || pageFiles.length === 0) return [];

    return pageFiles.map((filename, idx) => ({
      pageNumber: idx + 1,
      url: `${baseUrl}/data/${hash}/${filename}`,
    }));
  } catch (err) {
    console.error(`[MangaDex] Error fetching pages for chapter ${chapterId}:`, err);
    return [];
  }
}
