import type { TimingMarker } from './types';

const skipCache = new Map<string, TimingMarker[]>();

export async function fetchAniSkipMarkers(
  malId: number | string,
  episodeNumber: number | string,
  episodeLength = 1440
): Promise<TimingMarker[]> {
  if (!malId || !episodeNumber) return [];

  const cacheKey = `${malId}:${episodeNumber}`;
  if (skipCache.has(cacheKey)) {
    return skipCache.get(cacheKey)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const lengthVal = Math.round(Number(episodeLength) > 0 ? Number(episodeLength) : 1440);
    const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types[]=op&types[]=ed&types[]=recap&episodeLength=${lengthVal}`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      skipCache.set(cacheKey, []);
      return [];
    }

    const data = await res.json();
    if (!data.found || !Array.isArray(data.results)) {
      skipCache.set(cacheKey, []);
      return [];
    }

    const markers: TimingMarker[] = data.results
      .filter((r: any) => r.interval && typeof r.interval.startTime === 'number' && typeof r.interval.endTime === 'number')
      .map((r: any) => ({
        kind: r.skipType === 'op' ? 'intro' : r.skipType === 'ed' ? 'outro' : 'recap',
        start: r.interval.startTime,
        end: r.interval.endTime,
      }));

    skipCache.set(cacheKey, markers);
    return markers;
  } catch {
    return [];
  }
}
