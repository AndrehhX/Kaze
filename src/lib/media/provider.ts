import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { demoProvider } from "./demo-catalog";
import { animeStreamingProvider } from "./anime-provider";
import { resolvePlayableStream, type ResolvedStream } from "./providers/stream-resolver";
import { isMalIdDubbedInSpanish, resolveMalId } from "./dub-catalog";
import type { CatalogSeries, Entitlement, PlaybackGrant, ServerOption } from "./types";

/**
 * Server-cached wrapper for anime series metadata so watch/[animeId]/[episodeId]
 * upgrades to static/ISR without triggering uncached fetches on every request.
 */
export async function getCachedAnimeSeries(seriesId: string): Promise<CatalogSeries | null> {
  "use cache";
  cacheLife("days");
  cacheTag(`series:${seriesId}`);
  return animeStreamingProvider.getSeries(seriesId);
}

const RESOLVER_ENDPOINT =
  process.env.STREAM_RESOLVER_URL || "https://resolver.orunei.sbs/api/stream/resolve";

/**
 * Consulta el microservicio resolver en la VPS (alta velocidad en RAM vía Redis).
 * Si la VPS no responde o da timeout, retorna null para activar el fallback local transparente.
 */
async function fetchFromVpsResolver(input: {
  anilistId: number;
  malId: number | null;
  title: string;
  titleRomaji: string;
  episodeNumber: number;
  preferredAudio: "latino" | "castellano" | "sub" | undefined;
  preferredServer: "fast" | "clean" | undefined;
  codecPreference: "av1" | "h264" | undefined;
}): Promise<ResolvedStream | null> {
  try {
    const params = new URLSearchParams({
      anilistId: String(input.anilistId || 0),
      episodeNumber: String(input.episodeNumber || 1),
      title: input.title || "",
      romaji: input.titleRomaji || "",
      audio: input.preferredAudio || "sub",
      server: input.preferredServer || "fast",
      codec: input.codecPreference || "av1",
    });
    if (input.malId) params.set("malId", String(input.malId));

    const res = await fetch(`${RESOLVER_ENDPOINT}?${params.toString()}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.asset && data.asset.src) {
        return data as ResolvedStream;
      }
    }
  } catch (err) {
    console.warn("[Hybrid Resolver] Fallback to local resolver due to VPS error/timeout:", err);
  }
  return null;
}

async function resolveCachedStreamOrThrow(input: {
  anilistId: number;
  malId: number | null;
  title: string;
  titleRomaji: string;
  episodeNumber: number;
  preferredAudio: "latino" | "castellano" | "sub" | undefined;
  preferredServer: "fast" | "clean" | undefined;
  codecPreference: "av1" | "h264" | undefined;
}): Promise<ResolvedStream> {
  "use cache";
  cacheLife("hours");
  cacheTag(`stream:${input.anilistId}:${input.episodeNumber}`);

  // 1. Intento primario: Resolver en la VPS (Redis en RAM < 3ms)
  const vpsStream = await fetchFromVpsResolver(input);
  if (vpsStream) return vpsStream;

  // 2. Fallback de emergencia en Vercel
  const res = await resolvePlayableStream(input);
  if (!res) throw new Error("STREAM_MISS");
  return res;
}

/**
 * Server-cached stream resolution wrapper so repeat playback grants reuse
 * extracted HLS/MP4 URLs across invocations without caching transient misses for hours.
 */
async function resolveCachedStream(input: {
  anilistId: number;
  malId: number | null;
  title: string;
  titleRomaji: string;
  episodeNumber: number;
  preferredAudio: "latino" | "castellano" | "sub" | undefined;
  preferredServer: "fast" | "clean" | undefined;
  codecPreference: "av1" | "h264" | undefined;
}): Promise<ResolvedStream | null> {
  try {
    return await resolveCachedStreamOrThrow(input);
  } catch (err) {
    if (err instanceof Error && err.message === "STREAM_MISS") return null;
    const vpsStream = await fetchFromVpsResolver(input);
    if (vpsStream) return vpsStream;
    return resolvePlayableStream(input);
  }
}

export async function resolveSeries(seriesId: string) {
  const demo = await demoProvider.getSeries(seriesId);
  if (demo) return { provider: demoProvider, series: demo };
  const anime = await getCachedAnimeSeries(seriesId);
  if (anime) return { provider: animeStreamingProvider, series: anime };
  return null;
}

export async function findPlayableForAniList(anilistId: number) {
  const demo = await demoProvider.findByAniListId(anilistId);
  if (demo) return demo;
  return getCachedAnimeSeries(String(anilistId));
}

export async function listPlayableSeries() {
  return demoProvider.listSeries();
}

export type GrantResult = { ok: true; grant: PlaybackGrant } | { ok: false; entitlement: Entitlement; status: number };

export async function createPlaybackGrant(
  seriesId: string,
  episodeId: string,
  userId: string | null,
  preferredAudio?: "latino" | "castellano" | "sub",
  preferredServer?: "fast" | "clean",
  codecPreference?: "av1" | "h264",
): Promise<GrantResult> {
  const found = await resolveSeries(seriesId);
  if (!found) return { ok: false, entitlement: { allowed: false, reason: "not-licensed" }, status: 404 };
  const { provider, series } = found;
  const entitlement = await provider.checkEntitlement({ seriesId, episodeId, userId });
  if (!entitlement.allowed) return { ok: false, entitlement, status: entitlement.reason === "auth-required" ? 401 : 403 };

  const idx = series.episodes.findIndex((e) => e.id === episodeId);
  const ep = series.episodes[idx];
  const { asset, ...episode } = ep;

  let playAsset = asset;
  let audioLanguage: "es-419" | "es-ES" | "ja" | undefined;
  let serverName: string | undefined;
  let isDubbedAvailable: boolean | undefined;
  let availableServers: ServerOption[] | undefined;
  let currentServer: "fast" | "clean" | undefined;

  if (series.anilistId) {
    const malId = series.malId ? String(series.malId) : resolveMalId(series.anilistId);
    isDubbedAvailable = malId ? isMalIdDubbedInSpanish(malId) : false;

    // Si se solicitó DUB pero el catálogo confirma que el anime NO tiene doblaje en español,
    // ir directamente a "sub" (Japonés) para resolver instantáneamente (<1s) sin timeouts
    const targetAudio =
      (preferredAudio === "latino" || preferredAudio === "castellano") && !isDubbedAvailable
        ? "sub"
        : preferredAudio;

    let resolved = await resolveCachedStream({
      anilistId: series.anilistId,
      malId: malId ? Number(malId) : null,
      title: series.title,
      titleRomaji: series.titleRomaji || "",
      episodeNumber: Number(episodeId) || 1,
      preferredAudio: targetAudio,
      preferredServer,
      codecPreference,
    });

    // Si se solicitó DUB pero este anime o episodio no tiene doblaje disponible:
    if (!resolved && (preferredAudio === "latino" || preferredAudio === "castellano")) {
      const subResolved = await resolveCachedStream({
        anilistId: series.anilistId,
        malId: malId ? Number(malId) : null,
        title: series.title,
        titleRomaji: series.titleRomaji || "",
        episodeNumber: Number(episodeId) || 1,
        preferredAudio: "sub",
        preferredServer,
        codecPreference,
      });
      if (subResolved) {
        resolved = {
          ...subResolved,
          audioLanguage: "ja",
          serverName: `${subResolved.serverName} (Doblaje no disponible)`,
        };
      }
    }

    if (resolved) {
      playAsset = resolved.asset;
      audioLanguage = resolved.audioLanguage;
      serverName = resolved.serverName;
      availableServers = resolved.availableServers;
      currentServer = resolved.serverType;
    }
  }

  if (!playAsset.src) {
    return {
      ok: false,
      entitlement: { allowed: false, reason: "not-licensed" },
      status: 404,
    };
  }

  const brief = (i: number) => {
    const e = series.episodes[i];
    return e ? { id: e.id, number: e.number, title: e.title } : null;
  };
  return {
    ok: true,
    grant: {
      sessionId: `${series.id}-${ep.id}`,
      series: {
        id: series.id,
        title: series.title,
        titleJp: series.titleJp,
        license: series.license,
        demo: series.demo,
        color: series.color,
        anilistId: series.anilistId,
        banner: series.banner,
        cover: series.cover,
      },
      episode,
      asset: playAsset,
      next: brief(idx + 1),
      prev: brief(idx - 1),
      episodes: series.episodes.map((e) => ({ id: e.id, number: e.number, title: e.title, thumbnail: e.thumbnail, duration: e.asset.duration })),
      expiresAt: Date.now() + 6 * 3600_000,
      audioLanguage,
      serverName,
      isDubbedAvailable,
      availableServers,
      currentServer,
      nextSeason: series.nextSeason || null,
    },
  };
}
