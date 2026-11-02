import "server-only";
import { getMediaDetail } from "../anilist/service";
import { parseEpisodeNumber, parseEpisodeTitle } from "../episodes";
import { getKitsuSeasonEpisodes } from "./kitsu";
import { parseSeasonInfo } from "./providers/stream-resolver";
import type { CatalogEpisode, CatalogSeries, Entitlement, MediaProvider } from "./types";

export class AnimeStreamingProvider implements MediaProvider {
  readonly id = "anime-streaming";

  async listSeries(): Promise<CatalogSeries[]> {
    return [];
  }

  async getSeries(seriesId: string): Promise<CatalogSeries | null> {
    const id = Number.parseInt(seriesId, 10);
    if (!Number.isInteger(id) || id <= 0) return null;

    try {
      const media = await getMediaDetail(id);
      if (!media || media.isAdult) return null;

      const totalEps = media.episodes || (media.nextAiringEpisode ? media.nextAiringEpisode.episode - 1 : 12) || 12;
      const title = media.title.english || media.title.romaji || "Anime";
      const titleRomaji = media.title.romaji || "";

      // Check if this anime is a sequel / Season 2+
      const sInfo = parseSeasonInfo(title, titleRomaji);
      const hasPrequel = media.relations?.edges?.some((e) => e.relationType === "PREQUEL" && e.node?.type === "ANIME");
      const isSequel = sInfo.season > 1 || Boolean(hasPrequel);

      const streamMap = new Map<number, { title: string | null; thumbnail: string | null }>();

      if (isSequel) {
        // Fetch accurate season-specific episode titles and thumbnails from Kitsu
        const kitsuMap = await getKitsuSeasonEpisodes(title, titleRomaji);
        if (kitsuMap && kitsuMap.size > 0) {
          for (const [n, info] of kitsuMap.entries()) {
            streamMap.set(n, { title: info.title, thumbnail: info.thumbnail });
          }
        }
      }

      const firstTitle = (media.streamingEpisodes?.[0]?.title || "").toLowerCase();
      const isContaminated = isSequel && (
        firstTitle.includes("ryomen sukuna") ||
        firstTitle.includes("cruelty") ||
        firstTitle.includes("to you, 2,000 years") ||
        firstTitle.includes("operation strix") ||
        firstTitle.includes("i will make you invite") ||
        firstTitle.includes("battle without a quirk") ||
        firstTitle.includes("the result of the battle") ||
        (parseEpisodeNumber(media.streamingEpisodes?.[0]?.title) ?? 1) > 50
      );

      // Only use AniList streamingEpisodes if it's Season 1 or NOT contaminated
      if (!isContaminated && streamMap.size === 0) {
        for (const s of media.streamingEpisodes ?? []) {
          const num = parseEpisodeNumber(s.title, s.url);
          if (num != null) {
            streamMap.set(num, {
              title: parseEpisodeTitle(s.title) || `Episodio ${num}`,
              thumbnail: s.thumbnail || null,
            });
          }
        }
      }
      const fallbackThumb = media.bannerImage || media.coverImage.extraLarge || media.coverImage.large || null;

      const episodes: CatalogEpisode[] = Array.from({ length: totalEps }, (_, i) => {
        const num = i + 1;
        const streamed = streamMap.get(num);
        return {
          id: String(num),
          number: num,
          title: streamed?.title || `Episodio ${num}`,
          synopsis: `Episodio ${num} de ${title}`,
          thumbnail: streamed?.thumbnail || fallbackThumb,
          asset: {
            id: `stream-${media.id}-${num}`,
            kind: "hls",
            src: "",
            subtitles: [],
            markers: [],
            duration: (media.duration || 24) * 60,
          },
        };
      });

      const sequelEdge = media.relations?.edges?.find(
        (e) => e.relationType === "SEQUEL" && e.node?.type === "ANIME"
      );
      const nextSeason = sequelEdge?.node
        ? {
            id: String(sequelEdge.node.id),
            title:
              sequelEdge.node.title?.english ||
              sequelEdge.node.title?.romaji ||
              sequelEdge.node.title?.userPreferred ||
              "Siguiente Temporada",
            cover:
              sequelEdge.node.coverImage?.large ||
              sequelEdge.node.coverImage?.extraLarge ||
              null,
          }
        : null;

      return {
        id: String(media.id),
        title,
        titleRomaji: media.title.romaji || "",
        titleJp: media.title.native || "",
        description: media.description || "",
        banner: media.bannerImage || null,
        cover: media.coverImage.extraLarge || media.coverImage.large || null,
        color: media.coverImage.color || "#a597ff",
        provider: this.id,
        license: {
          name: "Streaming Comunitario",
          url: "",
          attribution: "Fuentes comunitarias de transmisión",
        },
        anilistId: media.id,
        episodes,
        demo: false,
        nextSeason,
      };
    } catch (err) {
      console.warn("[AnimeStreamingProvider] Error fetching series:", err);
      return null;
    }
  }

  async findByAniListId(anilistId: number): Promise<CatalogSeries | null> {
    return this.getSeries(String(anilistId));
  }

  async checkEntitlement(_input: { seriesId: string; episodeId: string; userId: string | null }): Promise<Entitlement> {
    return { allowed: true, reason: "licensed" };
  }
}

export const animeStreamingProvider = new AnimeStreamingProvider();
