import "server-only";
import { getMediaDetail } from "../anilist/service";
import { parseEpisodeNumber, parseEpisodeTitle } from "../episodes";
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

      const streamMap = new Map<number, { title: string | null; thumbnail: string | null }>();
      for (const s of media.streamingEpisodes ?? []) {
        const num = parseEpisodeNumber(s.title, s.url);
        if (num != null) {
          streamMap.set(num, {
            title: parseEpisodeTitle(s.title) || `Episodio ${num}`,
            thumbnail: s.thumbnail || null,
          });
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

      return {
        id: String(media.id),
        title,
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
