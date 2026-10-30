import "server-only";
import { randomUUID } from "node:crypto";
import { demoProvider } from "./demo-catalog";
import type { Entitlement, MediaProvider, PlaybackGrant } from "./types";

/**
 * Provider registry. To add a licensed source, implement MediaProvider and
 * register it here; routes and the player depend only on the interface.
 */
const providers: MediaProvider[] = [demoProvider];

export async function resolveSeries(seriesId: string) {
  for (const p of providers) {
    const s = await p.getSeries(seriesId);
    if (s) return { provider: p, series: s };
  }
  return null;
}

export async function findPlayableForAniList(anilistId: number) {
  for (const p of providers) {
    const s = await p.findByAniListId(anilistId);
    if (s) return s;
  }
  return null;
}

export async function listPlayableSeries() {
  const all = await Promise.all(providers.map((p) => p.listSeries()));
  return all.flat();
}

export type GrantResult = { ok: true; grant: PlaybackGrant } | { ok: false; entitlement: Entitlement; status: number };

export async function createPlaybackGrant(seriesId: string, episodeId: string, userId: string | null): Promise<GrantResult> {
  const found = await resolveSeries(seriesId);
  if (!found) return { ok: false, entitlement: { allowed: false, reason: "not-licensed" }, status: 404 };
  const { provider, series } = found;
  const entitlement = await provider.checkEntitlement({ seriesId, episodeId, userId });
  if (!entitlement.allowed) return { ok: false, entitlement, status: entitlement.reason === "auth-required" ? 401 : 403 };

  const idx = series.episodes.findIndex((e) => e.id === episodeId);
  const ep = series.episodes[idx];
  const { asset, ...episode } = ep;
  const brief = (i: number) => {
    const e = series.episodes[i];
    return e ? { id: e.id, number: e.number, title: e.title } : null;
  };
  return {
    ok: true,
    grant: {
      sessionId: randomUUID(),
      series: { id: series.id, title: series.title, titleJp: series.titleJp, license: series.license, demo: series.demo, color: series.color, anilistId: series.anilistId },
      episode,
      asset,
      next: brief(idx + 1),
      prev: brief(idx - 1),
      episodes: series.episodes.map((e) => ({ id: e.id, number: e.number, title: e.title, thumbnail: e.thumbnail, duration: e.asset.duration })),
      expiresAt: Date.now() + 6 * 3600_000,
    },
  };
}
