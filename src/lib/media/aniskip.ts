import type { TimingMarker } from './types';

const skipCache = new Map<string, TimingMarker[]>();

export async function fetchAniSkipMarkers(
  malId: number | string,
  episodeNumber: number | string,
  episodeLength = 0
): Promise<TimingMarker[]> {
  if (!malId || !episodeNumber) return [];

  const cacheKey = `${malId}:${episodeNumber}`;
  if (skipCache.has(cacheKey)) {
    return skipCache.get(cacheKey)!;
  }

  try {
    const lengthVal = Math.round(Number(episodeLength) > 0 ? Number(episodeLength) : 0);
    const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&types[]=recap&episodeLength=${lengthVal}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KAZE/1.0; +https://kaze.moe)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 86400 },
    } as RequestInit & { next: { revalidate: number } });

    if (!res.ok) {
      if (res.status === 404) {
        skipCache.set(cacheKey, []);
      }
      return [];
    }

    const data = await res.json();
    if (!data.found || !Array.isArray(data.results)) {
      skipCache.set(cacheKey, []);
      return [];
    }

    type AniSkipEntry = { skipType?: string; interval?: { startTime?: unknown; endTime?: unknown } };
    const markers: TimingMarker[] = (data.results as AniSkipEntry[])
      .filter(
        (r): r is AniSkipEntry & { interval: { startTime: number; endTime: number } } =>
          Boolean(r.interval && typeof r.interval.startTime === 'number' && typeof r.interval.endTime === 'number')
      )
      .map((r) => ({
        kind: r.skipType === 'op' || r.skipType === 'mixed-op' ? 'intro' : r.skipType === 'ed' || r.skipType === 'mixed-ed' ? 'outro' : 'recap',
        start: Number(r.interval.startTime.toFixed(2)),
        end: Number(r.interval.endTime.toFixed(2)),
      }));

    skipCache.set(cacheKey, markers);
    return markers;
  } catch {
    return [];
  }
}
