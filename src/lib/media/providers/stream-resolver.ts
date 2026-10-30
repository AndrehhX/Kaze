import { isMalIdDubbedInSpanish, resolveMalId, VERIFIED_LATINO_DUB_MAP } from '../dub-catalog';
import { isProviderAvailable, recordProviderOutcome } from '../circuit-breaker';
import { fetchAniSkipMarkers } from '../aniskip';
import type { MediaAsset, TimingMarker } from '../types';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const PROXY_BASE = '/api/stream/proxy';

/**
 * Genera la URL relativa para que el cliente acceda a través del proxy seguro de Next.js.
 */
function toClientProxyUrl(targetUrl: string, referer = '', origin = ''): string {
  const p = new URLSearchParams({ url: targetUrl });
  if (referer) p.set('referer', referer);
  if (origin) p.set('origin', origin);
  return `${PROXY_BASE}?${p.toString()}`;
}

export interface StreamResolutionOptions {
  anilistId: number;
  malId?: number | null;
  title: string;
  episodeNumber: number;
  preferredAudio?: 'latino' | 'castellano' | 'sub';
}

export interface ResolvedStream {
  asset: MediaAsset;
  serverName: string;
  audioLanguage: 'es-419' | 'es-ES' | 'ja';
  quality: string;
}

/**
 * Normaliza títulos de anime para búsqueda en proveedores de streaming.
 */
function cleanSearchTitle(title: string): string {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/season\s+\d+/gi, '')
    .replace(/s\d+/gi, '')
    .replace(/part\s+\d+/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Slugs pre-verificados para Latanime (0ms overhead).
 */
const VERIFIED_LATANIME_SLUGS: Record<string, string> = {
  '44511:latino': 'chainsaw-man-latino',
  '44511:castellano': 'chainsaw-man-castellano',
  '40748:latino': 'jujutsu-kaisen-latino',
  '51009:latino': 'jujutsu-kaisen-s2-latino',
  '51009:castellano': 'jujutsu-kaisen-s2-castellano',
  '52299:latino': 'solo-leveling-latino',
  '52299:castellano': 'solo-leveling-castellano',
  '52991:latino': 'frieren-mas-alla-del-final-del-viaje-latino',
  '52991:castellano': 'frieren-tras-finalizar-el-viaje-castellano',
  '1535:latino': 'death-note-latino',
  '1535:castellano': 'death-note-castellano',
  '21:latino': 'one-piece-latino',
  '31964:latino': 'boku-no-hero-academia-latino',
  '31964:castellano': 'boku-no-hero-academia-castellano',
  '38000:latino': 'kimetsu-no-yaiba-latino',
  '20:latino': 'naruto-latino',
  '269:latino': 'bleach-latino',
  '30694:latino': 'dragon-ball-super-latino',
  '50273:latino': 'spy-x-family-latino',
  '34572:latino': 'black-clover-latino',
  '54595:latino': 'dandadan-latino',
};

const slugCache = new Map<string, string>();

/**
 * Resuelve el slug de Latanime buscando dinámicamente si no está en caché.
 */
async function resolveLatanimeSlug(
  malId: string | number | null,
  animeTitle: string,
  dialect: 'latino' | 'castellano'
): Promise<string | null> {
  const normDialect = dialect === 'castellano' ? 'castellano' : 'latino';
  const malKey = malId ? `${malId}:${normDialect}` : '';
  if (malKey && VERIFIED_LATANIME_SLUGS[malKey]) {
    return VERIFIED_LATANIME_SLUGS[malKey];
  }

  const cacheKey = `latanime:${malId || ''}:${animeTitle}:${normDialect}`;
  if (slugCache.has(cacheKey)) {
    return slugCache.get(cacheKey)!;
  }

  const query = animeTitle.split(':')[0].trim();
  if (!query) return null;

  try {
    const searchUrl = `https://latanime.org/buscar?q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const cardRegex = /<a\s+href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g;
    let match: RegExpExecArray | null;
    const candidates: { slug: string; title: string }[] = [];

    while ((match = cardRegex.exec(html)) !== null) {
      const href = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim().toLowerCase();
      if (href && href.includes('/anime/')) {
        const slug = href.split('/anime/')[1].replace(/\/+$/, '');
        candidates.push({ slug, title });
      }
    }

    if (candidates.length === 0) return null;

    const targetDialect = normDialect === 'castellano' ? 'castellano' : 'latino';
    const dialectMatches = candidates.filter(
      (c) => c.slug.includes(targetDialect) || c.title.includes(targetDialect)
    );
    const chosen = dialectMatches[0] || candidates[0];
    if (chosen?.slug) {
      slugCache.set(cacheKey, chosen.slug);
      return chosen.slug;
    }
  } catch {
    // ignore
  }

  // Fallback slug directo
  const directSlug = `${cleanSearchTitle(animeTitle).replace(/\s+/g, '-')}-${normDialect}`;
  return directSlug;
}

/**
 * Extractor para YourUpload MP4 directo.
 */
async function extractYourUpload(embedUrl: string): Promise<string | null> {
  try {
    const res = await fetch(embedUrl, {
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.yourupload.com/' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/property="og:video(?::secure_url)?"\s*content="([^"]+)"/i) ||
      html.match(/content="([^"]+)"\s*property="og:video"/i) ||
      html.match(/(?:file|source\s+src):\s*["'](https?:\/\/[^"']+(?:yourupload\.com|\.mp4)[^"']*)["']/i);
    const videoUrl = match?.[1];
    if (videoUrl && !videoUrl.includes('novideo.mp4')) {
      return videoUrl;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Extractor para MP4Upload directo.
 */
async function extractMP4Upload(embedUrl: string): Promise<string | null> {
  try {
    const res = await fetch(embedUrl, {
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://latanime.org/' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/src:\s*"([^"]+\.mp4)"/i) || html.match(/"([^"]+\.mp4)"/i);
    if (match?.[1]) return match[1];
  } catch {
    // ignore
  }
  return null;
}

/**
 * Proveedor 1: Latanime (Doblaje Latino y Castellano).
 */
async function resolveFromLatanime(
  malId: string | number | null,
  animeTitle: string,
  episode: number,
  dialect: 'latino' | 'castellano' = 'latino'
): Promise<ResolvedStream | null> {
  if (!isProviderAvailable('latanime')) return null;

  const slug = await resolveLatanimeSlug(malId, animeTitle, dialect);
  if (!slug) return null;

  const epUrl = `https://latanime.org/ver/${slug}-episodio-${episode}`;

  try {
    const res = await fetch(epUrl, {
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://latanime.org/' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      recordProviderOutcome('latanime', 'empty');
      return null;
    }

    const html = await res.text();
    const playerRegex = /data-player="([^"]+)">([^<]+)<\/a>/g;
    let match: RegExpExecArray | null;
    const rawServers: { name: string; url: string }[] = [];

    while ((match = playerRegex.exec(html)) !== null) {
      try {
        const b64 = match[1];
        const srvName = match[2].trim().toLowerCase();
        const decodedUrl = Buffer.from(b64, 'base64').toString('utf8');
        if (decodedUrl && decodedUrl.startsWith('http')) {
          rawServers.push({ name: srvName, url: decodedUrl });
        }
      } catch {
        // ignore decode errors
      }
    }

    for (const server of rawServers) {
      if (server.name.includes('mp4upload') || server.url.includes('mp4upload')) {
        const direct = await extractMP4Upload(server.url);
        if (direct) {
          recordProviderOutcome('latanime', 'found');
          return {
            serverName: `MP4Upload (${dialect === 'castellano' ? 'Castellano' : 'Latino'})`,
            audioLanguage: dialect === 'castellano' ? 'es-ES' : 'es-419',
            quality: '1080p',
            asset: {
              id: `latanime-mp4-${episode}`,
              kind: 'mp4',
              src: toClientProxyUrl(direct, 'https://www.mp4upload.com/'),
              subtitles: [],
              markers: [],
              duration: 1440,
            },
          };
        }
      } else if (server.name.includes('yourupload') || server.url.includes('yourupload')) {
        const direct = await extractYourUpload(server.url);
        if (direct) {
          recordProviderOutcome('latanime', 'found');
          return {
            serverName: `YourUpload (${dialect === 'castellano' ? 'Castellano' : 'Latino'})`,
            audioLanguage: dialect === 'castellano' ? 'es-ES' : 'es-419',
            quality: '1080p',
            asset: {
              id: `latanime-yu-${episode}`,
              kind: 'mp4',
              src: toClientProxyUrl(direct, 'https://www.yourupload.com/'),
              subtitles: [],
              markers: [],
              duration: 1440,
            },
          };
        }
      }
    }

    recordProviderOutcome('latanime', 'empty');
  } catch {
    recordProviderOutcome('latanime', 'failed');
  }
  return null;
}

/**
 * Proveedor 2: JKanime (HLS VOD de alta velocidad en Japonés Subtitulado).
 */
async function resolveFromJKanime(
  malId: string | number | null,
  animeTitle: string,
  episode: number
): Promise<ResolvedStream | null> {
  const malKey = malId ? String(malId) : '';
  const verified = malKey ? VERIFIED_LATINO_DUB_MAP[malKey]?.slug : null;
  const clean = cleanSearchTitle(animeTitle).replace(/\s+/g, '-');
  const slugsToTry = Array.from(new Set([
    verified ? `${verified}-tv` : null,
    verified,
    `${clean}-tv`,
    clean,
    clean.replace(/-tv$/, ''),
  ])).filter(Boolean) as string[];

  for (const slug of slugsToTry) {
    const epUrl = `https://jkanime.net/${slug}/${episode}/`;
    try {
      const res = await fetch(epUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const iframeMatch =
        html.match(/src="(https:\/\/jkanime\.net\/jkplayer\/um\?e=[^"]+)"/i) ||
        html.match(/src="(https:\/\/jkanime\.net\/jkplayer\/umv\?e=[^"]+)"/i);
      if (!iframeMatch) continue;

      const embedRes = await fetch(iframeMatch[1], {
        headers: { 'User-Agent': USER_AGENT, Referer: epUrl },
        signal: AbortSignal.timeout(3500),
      });
      if (!embedRes.ok) continue;

      const embedHtml = await embedRes.text();
      const m3u8Match = embedHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
      if (m3u8Match?.[1]) {
        return {
          serverName: 'Stream Ultra HD (Sub Español)',
          audioLanguage: 'ja',
          quality: '1080p',
          asset: {
            id: `jk-hls-${episode}`,
            kind: 'hls',
            src: toClientProxyUrl(m3u8Match[1], 'https://jkanime.net/'),
            subtitles: [],
            markers: [],
            duration: 1440,
          },
        };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Proveedor 3: TioAnime (Sub Español HD / Japonés con subtítulos).
 */
async function resolveFromTioAnime(
  malId: string | number | null,
  animeTitle: string,
  episode: number
): Promise<ResolvedStream | null> {
  const malKey = malId ? String(malId) : '';
  const verified = malKey ? VERIFIED_LATINO_DUB_MAP[malKey]?.slug : null;
  const clean = cleanSearchTitle(animeTitle).replace(/\s+/g, '-');
  const slugsToTry = Array.from(new Set([
    verified ? `${verified}-tv` : null,
    verified,
    `${clean}-tv`,
    clean,
    clean.replace(/-tv$/, ''),
  ])).filter(Boolean) as string[];

  for (const slug of slugsToTry) {
    const epUrl = `https://tioanime.com/ver/${slug}-${episode}`;
    try {
      const res = await fetch(epUrl, {
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://tioanime.com/' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const videoMatch = html.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/);
      if (!videoMatch) continue;

      const list: [string, string, number, number][] = JSON.parse(videoMatch[1]);
      for (const item of list) {
        const serverName = (item[0] || '').toLowerCase();
        let embed = item[1] || '';

        if (serverName.includes('yourupload')) {
          const direct = await extractYourUpload(embed);
          if (direct) {
            return {
              serverName: 'YourUpload (Sub Español)',
              audioLanguage: 'ja',
              quality: '1080p',
              asset: {
                id: `tio-yu-${episode}`,
                kind: 'mp4',
                src: toClientProxyUrl(direct, 'https://www.yourupload.com/'),
                subtitles: [],
                markers: [],
                duration: 1440,
              },
            };
          }
        } else if (serverName.includes('mp4upload')) {
          const direct = await extractMP4Upload(embed);
          if (direct) {
            return {
              serverName: 'MP4Upload (Sub Español)',
              audioLanguage: 'ja',
              quality: '1080p',
              asset: {
                id: `tio-mp4-${episode}`,
                kind: 'mp4',
                src: toClientProxyUrl(direct, 'https://www.mp4upload.com/'),
                subtitles: [],
                markers: [],
                duration: 1440,
              },
            };
          }
        }
      }
    } catch {
      // ignore and continue
    }
  }
  return null;
}

/**
 * Proveedor 3: AnimeFLV (Sub Español HD).
 */
async function resolveFromAnimeFLV(
  animeTitle: string,
  episode: number,
  malId?: string | number | null
): Promise<ResolvedStream | null> {
  if (!isProviderAvailable('animeflv')) return null;

  const malKey = malId ? String(malId) : '';
  const verified = malKey ? VERIFIED_LATINO_DUB_MAP[malKey]?.slug : null;
  const clean = cleanSearchTitle(animeTitle).replace(/\s+/g, '-');
  const slugsToTry = Array.from(new Set([
    verified ? `${verified}-tv` : null,
    verified,
    `${clean}-tv`,
    clean,
  ])).filter(Boolean) as string[];

  for (const slug of slugsToTry) {
    const epUrl = `https://www3.animeflv.net/ver/${slug}-${episode}`;

    try {
      const res = await fetch(epUrl, {
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://www3.animeflv.net/' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const videoMatch = html.match(/var\s+videos\s*=\s*(\{[\s\S]*?\});/);
      if (!videoMatch) continue;

      const data = JSON.parse(videoMatch[1]);
      const subList = Array.isArray(data?.SUB) ? data.SUB : Array.isArray(data?.sub) ? data.sub : [];

      for (const item of subList) {
        const server = (item.server || '').toLowerCase();
        let code = item.code || '';
        if (code.startsWith('//')) code = 'https:' + code;

        if (server.includes('yourupload')) {
          const direct = await extractYourUpload(code);
          if (direct) {
            recordProviderOutcome('animeflv', 'found');
            return {
              serverName: 'YourUpload (Sub Español)',
              audioLanguage: 'ja',
              quality: '1080p',
              asset: {
                id: `flv-yu-${episode}`,
                kind: 'mp4',
                src: toClientProxyUrl(direct, 'https://www.yourupload.com/'),
                subtitles: [],
                markers: [],
                duration: 1440,
              },
            };
          }
        } else if (server.includes('mp4upload')) {
          const direct = await extractMP4Upload(code);
          if (direct) {
            recordProviderOutcome('animeflv', 'found');
            return {
              serverName: 'MP4Upload (Sub Español)',
              audioLanguage: 'ja',
              quality: '1080p',
              asset: {
                id: `flv-mp4-${episode}`,
                kind: 'mp4',
                src: toClientProxyUrl(direct, 'https://www.mp4upload.com/'),
                subtitles: [],
                markers: [],
                duration: 1440,
              },
            };
          }
        }
      }
    } catch {
      // continue next slug
    }
  }
  recordProviderOutcome('animeflv', 'empty');
  return null;
}

/**
 * Resuelve y extrae el mejor stream para un episodio determinado.
 */
export async function resolvePlayableStream(
  opts: StreamResolutionOptions
): Promise<ResolvedStream | null> {
  const malId = opts.malId ? String(opts.malId) : resolveMalId(opts.anilistId);
  const isDubbed = malId ? isMalIdDubbedInSpanish(malId) : false;

  // 1. Obtener timing markers de AniSkip en paralelo
  const malIdNum = Number(malId) || 0;
  const markersPromise = malIdNum
    ? fetchAniSkipMarkers(malIdNum, opts.episodeNumber)
    : Promise.resolve<TimingMarker[]>([]);

  let streamResult: ResolvedStream | null = null;

  // 2. Si se solicitó explícitamente SUB (Japonés subtitulado):
  if (opts.preferredAudio === 'sub') {
    streamResult = await resolveFromJKanime(malId, opts.title, opts.episodeNumber);
    if (!streamResult) {
      streamResult = await resolveFromTioAnime(malId, opts.title, opts.episodeNumber);
    }
    if (!streamResult) {
      streamResult = await resolveFromAnimeFLV(opts.title, opts.episodeNumber, malId);
    }
    // REGLA ESTRICTA: Si el usuario solicitó SUB, NUNCA caer a doblaje en español.
    if (streamResult) {
      const markers = await markersPromise;
      streamResult.asset.markers = markers;
    }
    return streamResult;
  }

  // 3. Si se prefiere o permite DUB Latino:
  if (!streamResult && isDubbed) {
    streamResult = await resolveFromLatanime(malId, opts.title, opts.episodeNumber, 'latino');
  }

  // 4. Si aún no hay stream, fallback a Sub Español (JKanime -> TioAnime -> AnimeFLV)
  if (!streamResult) {
    streamResult = await resolveFromJKanime(malId, opts.title, opts.episodeNumber);
  }
  if (!streamResult) {
    streamResult = await resolveFromTioAnime(malId, opts.title, opts.episodeNumber);
  }
  if (!streamResult) {
    streamResult = await resolveFromAnimeFLV(opts.title, opts.episodeNumber, malId);
  }

  // 5. Fallback final a DUB si no se encontró SUB (solo para preferencias latino/no especificadas)
  if (!streamResult && isDubbed) {
    streamResult = await resolveFromLatanime(malId, opts.title, opts.episodeNumber, 'latino');
  }

  // 6. Inyectar marcas AniSkip al asset resultante
  if (streamResult) {
    const markers = await markersPromise;
    streamResult.asset.markers = markers;
  }

  return streamResult;
}
