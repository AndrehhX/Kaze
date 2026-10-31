/**
 * Playback domain. Metadata (AniList), availability, assets, entitlements and
 * sessions are separate concepts: AniList listing a title never implies KAZE
 * may stream it.
 */

export type TimingMarker = { kind: "intro" | "outro" | "recap"; start: number; end: number };

export type SubtitleTrackAsset = { label: string; lang: string; src: string; default?: boolean };

export type MediaAsset = {
  id: string;
  kind: "hls" | "mp4";
  src: string;
  /** Sidecar WebVTT files. HLS manifests may also carry in-band subtitle renditions. */
  subtitles: SubtitleTrackAsset[];
  markers: TimingMarker[];
  /** Approximate runtime in seconds, used before metadata loads. */
  duration: number;
};

export type CatalogEpisode = {
  id: string;
  number: number;
  title: string;
  synopsis: string;
  thumbnail: string | null;
  asset: MediaAsset;
};

export type CatalogSeries = {
  id: string;
  title: string;
  titleRomaji?: string;
  titleJp: string;
  description: string;
  banner: string | null;
  cover: string | null;
  color: string;
  provider: string;
  license: { name: string; url: string; attribution: string };
  /** Present when the series corresponds to an AniList entry with confirmed rights. */
  anilistId: number | null;
  episodes: CatalogEpisode[];
  demo: boolean;
};

export type Entitlement =
  | { allowed: true; reason: "demo-open-license" | "licensed" }
  | { allowed: false; reason: "not-licensed" | "region" | "auth-required" | "unknown-episode" };

export type ServerOption = {
  id: "fast" | "clean";
  name: string;
  badge: string;
  description: string;
};

export type PlaybackGrant = {
  sessionId: string;
  series: Pick<CatalogSeries, "id" | "title" | "titleJp" | "license" | "demo" | "color" | "anilistId" | "banner" | "cover">;
  episode: Omit<CatalogEpisode, "asset">;
  asset: MediaAsset;
  next: { id: string; number: number; title: string } | null;
  prev: { id: string; number: number; title: string } | null;
  episodes: { id: string; number: number; title: string; thumbnail: string | null; duration: number }[];
  expiresAt: number;
  audioLanguage?: "es-419" | "es-ES" | "ja";
  serverName?: string;
  isDubbedAvailable?: boolean;
  availableServers?: ServerOption[];
  currentServer?: "fast" | "clean";
};

/** Replaceable provider contract; a licensed CDN/DRM provider implements the same interface. */
export interface MediaProvider {
  readonly id: string;
  listSeries(): Promise<CatalogSeries[]>;
  getSeries(seriesId: string): Promise<CatalogSeries | null>;
  /** Series that are playable for a given AniList id (licensed catalog lookups). */
  findByAniListId(anilistId: number): Promise<CatalogSeries | null>;
  checkEntitlement(input: { seriesId: string; episodeId: string; userId: string | null }): Promise<Entitlement>;
}
