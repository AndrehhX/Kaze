import { isMalIdDubbedInSpanish, resolveMalId, VERIFIED_LATINO_DUB_MAP } from '../dub-catalog';
import { isProviderAvailable, recordProviderOutcome } from '../circuit-breaker';
import { fetchAniSkipMarkers } from '../aniskip';
import type { MediaAsset, ServerOption, TimingMarker } from '../types';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const PROXY_BASE = process.env.NEXT_PUBLIC_STREAM_PROXY_URL || 'https://orunei-stream.thealex230820.workers.dev/api/stream/proxy';

/**
 * Genera la URL relativa para que el cliente acceda a través del proxy seguro de Next.js.
 */
function toClientProxyUrl(targetUrl: string, referer = '', origin = ''): string {
  const p = new URLSearchParams({ url: targetUrl });
  if (referer) p.set('referer', referer);
  if (origin) p.set('origin', origin);
  const basePath = targetUrl.includes('.m3u8') ? `${PROXY_BASE}/stream.m3u8` : PROXY_BASE;
  return `${basePath}?${p.toString()}`;
}

export interface StreamResolutionOptions {
  anilistId: number;
  malId?: number | null;
  title: string;
  titleRomaji?: string;
  episodeNumber: number;
  preferredAudio?: 'latino' | 'castellano' | 'sub';
  preferredServer?: 'fast' | 'clean';
  codecPreference?: 'av1' | 'h264';
}

export interface ResolvedStream {
  asset: MediaAsset;
  serverName: string;
  audioLanguage: 'es-419' | 'es-ES' | 'ja';
  quality: string;
  serverType?: 'fast' | 'clean';
  availableServers?: ServerOption[];
}

export interface SeasonInfo {
  season: number;
  part: number;
  isMovieOrOva: boolean;
}

/**
 * Detecta la temporada y parte a partir del título en inglés o romaji.
 */
export function parseSeasonInfo(title = ''): SeasonInfo {
  const norm = title.toLowerCase();

  let season = 1;
  let part = 1;
  const isMovieOrOva = /movie|pelicula|ova|special|gekijouban/i.test(norm);

  const partMatch = norm.match(/part(?:e)?\s*(\d+)/i) || norm.match(/cour\s*(\d+)/i);
  if (partMatch) {
    part = Number.parseInt(partMatch[1], 10) || 1;
  }

  const seasonMatch =
    norm.match(/season\s*(\d+)/i) ||
    norm.match(/temporada\s*(\d+)/i) ||
    norm.match(/(\d+)(?:st|nd|rd|th)\s*season/i) ||
    norm.match(/\bs(\d+)\b/i);

  if (seasonMatch) {
    season = Number.parseInt(seasonMatch[1], 10) || 1;
  } else if (/\b(final\s+season|the\s+final\s+season)\b/i.test(norm)) {
    season = 4;
  } else if (/\biv\b/i.test(norm)) {
    season = 4;
  } else if (/\biii\b/i.test(norm)) {
    season = 3;
  } else if (/\bii\b/i.test(norm)) {
    season = 2;
  }

  return { season, part, isMovieOrOva };
}

/**
 * Normaliza títulos de anime para búsqueda en proveedores de streaming manteniendo temporadas.
 */
function cleanSearchTitle(title: string): string {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreSlug(slug: string, queryTokens: string[], seasonInfo: SeasonInfo): number {
  let score = 0;
  const slugLower = slug.toLowerCase();

  if (!seasonInfo.isMovieOrOva) {
    if (/(?:break-time|petit|chibi|spin-off|mini|ova|special|movie|gekijouban|lost-girls|kuinaki-sentaku|hyouketsu-no-kizuna|memory-snow)/i.test(slugLower)) {
      score -= 100;
    }
  }

  for (const token of queryTokens) {
    if (token.length > 2 && slugLower.includes(token)) {
      score += 15;
    }
  }

  const { season, part } = seasonInfo;

  if (season === 1) {
    if (/(?:2nd|3rd|4th|5th|6th)-season|season-[2-9]|-s[2-9]\b|\bii\b|\biii\b|\biv\b|final-season/i.test(slugLower)) {
      score -= 80;
    } else {
      score += 40;
    }
  } else {
    const seasonRegexMap: Record<number, RegExp> = {
      2: /(?:2nd-season|season-2\b|-s2\b|-ii\b)/i,
      3: /(?:3rd-season|season-3\b|-s3\b|-iii\b)/i,
      4: /(?:4th-season|season-4\b|-s4\b|-iv\b|the-final-season|final-season)/i,
      5: /(?:5th-season|season-5\b|-s5\b|-v\b)/i,
    };

    const targetRegex = seasonRegexMap[season];
    if (targetRegex && targetRegex.test(slugLower)) {
      score += 60;
    } else {
      score -= 50;
    }

    if (part > 1) {
      if (new RegExp(`part-${part}`, 'i').test(slugLower)) {
        score += 30;
      }
    } else {
      if (/part-[2-9]/i.test(slugLower)) {
        score -= 40;
      }
    }
  }

  return score;
}

export function matchBestSlug(candidates: string[], title: string, romajiTitle = ''): string | null {
  if (!candidates || candidates.length === 0) return null;

  const targetTitle = romajiTitle || title || '';
  const seasonInfo = parseSeasonInfo(targetTitle);

  const tokens = Array.from(new Set(
    `${title} ${romajiTitle}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !['season', 'the', 'part', 'and', 'for', 'with', 'from', 'world', 'life'].includes(t))
  ));

  const scored = candidates.map((slug) => ({
    slug,
    score: scoreSlug(slug, tokens, seasonInfo),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.slug || candidates[0];
}

function generateProviderSlugs(
  malId: string | number | null,
  animeTitle: string,
  romajiTitle = ''
): string[] {
  const malKey = malId ? String(malId) : '';
  const verified = malKey ? VERIFIED_LATINO_DUB_MAP[malKey]?.slug : null;

  const targetTitle = romajiTitle || animeTitle || '';
  const seasonInfo = parseSeasonInfo(targetTitle);
  const cleanRomaji = romajiTitle ? cleanSearchTitle(romajiTitle).replace(/\s+/g, '-') : '';
  const cleanTitle = cleanSearchTitle(animeTitle).replace(/\s+/g, '-');
  const baseRomaji = cleanRomaji
    .replace(/(?:-2nd-season|-3rd-season|-4th-season|-5th-season|-season-\d+|-s\d+|-part-\d+)/gi, '')
    .trim();
  const baseTitle = cleanTitle
    .replace(/(?:-2nd-season|-3rd-season|-4th-season|-5th-season|-season-\d+|-s\d+|-part-\d+)/gi, '')
    .trim();

  const rawList: (string | null | undefined)[] = [verified ? `${verified}-tv` : null, verified];

  if (seasonInfo.season > 1) {
    const s = seasonInfo.season;
    const ord = s === 2 ? '2nd' : s === 3 ? '3rd' : `${s}th`;
    if (baseRomaji) {
      if (seasonInfo.part > 1) {
        rawList.push(`${baseRomaji}-${ord}-season-part-${seasonInfo.part}`);
        rawList.push(`${baseRomaji}-season-${s}-part-${seasonInfo.part}`);
      }
      rawList.push(`${baseRomaji}-${ord}-season`);
      rawList.push(`${baseRomaji}-season-${s}`);
      rawList.push(`${baseRomaji}-${s}`);
      rawList.push(cleanRomaji);
    }
    if (baseTitle) {
      if (seasonInfo.part > 1) {
        rawList.push(`${baseTitle}-season-${s}-part-${seasonInfo.part}`);
      }
      rawList.push(`${baseTitle}-season-${s}`);
      rawList.push(`${baseTitle}-${ord}-season`);
      rawList.push(cleanTitle);
    }
  } else {
    // Season 1
    if (cleanRomaji) {
      rawList.push(`${cleanRomaji}-tv`);
      rawList.push(cleanRomaji);
      rawList.push(baseRomaji);
    }
    if (cleanTitle) {
      rawList.push(`${cleanTitle}-tv`);
      rawList.push(cleanTitle);
      rawList.push(baseTitle);
    }
  }

  const result: string[] = [];
  for (const item of rawList) {
    if (!item) continue;
    result.push(item);
    if (item.includes('re-zero')) {
      result.push(item.replace(/re-zero/g, 'rezero'));
    }
  }

  return Array.from(new Set(result));
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

const VERIFIED_ANIMEAV1_SLUGS: Record<string, string> = {
  'chainsaw man': 'chainsaw-man',
  'jujutsu kaisen': 'jujutsu-kaisen',
  'solo leveling': 'ore-dake-level-up-na-ken',
  'dandadan': 'dandadan',
  'frieren': 'sousou-no-frieren',
  'kimetsu no yaiba': 'kimetsu-no-yaiba',
  'demon slayer': 'kimetsu-no-yaiba',
  'shingeki no kyojin': 'shingeki-no-kyojin',
  'attack on titan': 'shingeki-no-kyojin',
  'one piece': 'one-piece',
  'boku no hero academia': 'boku-no-hero-academia',
  'my hero academia': 'boku-no-hero-academia',
  'oshi no ko': 'oshi-no-ko',
  'death note': 'death-note',
  'naruto': 'naruto',
  'bleach': 'bleach',
  'dragon ball super': 'dragon-ball-super',
  'spy x family': 'spy-x-family',
  'black clover': 'black-clover',
  'mashle': 'mashle',
  'overlord': 'overlord',
  'horimiya': 'horimiya',
  'dr stone': 'dr-stone',
  'vinland saga': 'vinland-saga',
  'kaiju no 8': 'kaijuu-8-gou',
};

const av1SlugCache = new Map<string, string>();

async function resolveAnimeAV1Slug(animeTitle: string, romajiTitle = ''): Promise<string | null> {
  const cacheKey = `${animeTitle}:${romajiTitle || ''}`;
  if (av1SlugCache.has(cacheKey)) return av1SlugCache.get(cacheKey)!;

  const targetTitle = romajiTitle || animeTitle || '';
  const seasonInfo = parseSeasonInfo(targetTitle);

  // Si es temporada 1, verificar lista fija
  if (seasonInfo.season === 1) {
    const clean = cleanSearchTitle(animeTitle);
    for (const [key, slug] of Object.entries(VERIFIED_ANIMEAV1_SLUGS)) {
      if (clean === key) {
        av1SlugCache.set(cacheKey, slug);
        return slug;
      }
    }
  }

  const queries = Array.from(new Set([
    romajiTitle ? cleanSearchTitle(romajiTitle) : null,
    cleanSearchTitle(animeTitle),
  ])).filter(Boolean) as string[];

  for (const q of queries) {
    try {
      const res = await fetch(`https://animeav1.com/catalogo?search=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const html = await res.text();
        const allMatches = Array.from(html.matchAll(/\/media\/([a-zA-Z0-9_\-]+)/g)).map((m) => m[1]);
        const unique = Array.from(new Set(allMatches));
        if (unique.length > 0) {
          const best = matchBestSlug(unique, animeTitle, romajiTitle);
          if (best) {
            av1SlugCache.set(cacheKey, best);
            return best;
          }
        }
      }
    } catch {
      // try next query
    }
  }

  const fallbackSlug = (romajiTitle ? cleanSearchTitle(romajiTitle) : cleanSearchTitle(animeTitle)).replace(/\s+/g, '-');
  av1SlugCache.set(cacheKey, fallbackSlug);
  return fallbackSlug;
}

/**
 * Proveedor 0: AnimeAV1 (HLS Multi-Audio 1080p Ultra HD en Sub Español y Audio Latino).
 */
async function resolveFromAnimeAV1(
  animeTitle: string,
  episode: number,
  preferredAudio: 'sub' | 'latino' | 'castellano' = 'sub',
  romajiTitle = ''
): Promise<ResolvedStream | null> {
  const slug = await resolveAnimeAV1Slug(animeTitle, romajiTitle);
  if (!slug) return null;

  const epUrl = `https://animeav1.com/media/${slug}/${episode}`;
  try {
    const res = await fetch(epUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const isDub = preferredAudio === 'latino' || preferredAudio === 'castellano';

    const dubBlock = html.match(/DUB:\s*(\[[^\]]*\])/)?.[1] || '';
    const subBlock = html.match(/SUB:\s*(\[[^\]]*\])/)?.[1] || '';

    const primaryBlock = isDub ? dubBlock : subBlock;
    const fallbackBlock = isDub ? subBlock : dubBlock;

    const targetBlocks = [
      { block: primaryBlock, isDubAudio: isDub },
      ...(isDub ? [{ block: fallbackBlock, isDubAudio: false }] : []),
    ];

    for (const { block, isDubAudio } of targetBlocks) {
      if (!block) continue;

      // 1. Servidor HLS (Zilla-networks) - Máxima calidad y fluidez
      const zillaMatch = block.match(/player\.zilla-networks\.com\/play\/([a-zA-Z0-9]+)/);
      if (zillaMatch?.[1]) {
        const zillaId = zillaMatch[1];
        const m3u8Url = `https://player.zilla-networks.com/m3u8/${zillaId}`;
        const playReferer = `https://player.zilla-networks.com/play/${zillaId}`;
        const playOrigin = 'https://player.zilla-networks.com';
        return {
          serverName: `1080p Ultra Rápido (${isDubAudio ? 'Audio Latino' : 'Sub Español'})`,
          serverType: 'fast',
          audioLanguage: isDubAudio ? 'es-419' : 'ja',
          quality: '1080p',
          asset: {
            id: `av1-hls-${episode}-${isDubAudio ? 'dub' : 'sub'}`,
            kind: 'hls',
            src: toClientProxyUrl(m3u8Url, playReferer, playOrigin),
            subtitles: [],
            markers: [],
            duration: 1440,
          },
        };
      }

      // 2. YourUpload directo
      const yourUploadMatch = block.match(/yourupload\.com\/embed\/([a-zA-Z0-9]+)/);
      if (yourUploadMatch?.[1]) {
        const direct = await extractYourUpload(`https://www.yourupload.com/embed/${yourUploadMatch[1]}`);
        if (direct) {
          return {
            serverName: `YourUpload (${isDubAudio ? 'Audio Latino' : 'Sub Español'})`,
            audioLanguage: isDubAudio ? 'es-419' : 'ja',
            quality: '1080p',
            asset: {
              id: `av1-yu-${episode}`,
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
  } catch {
    // ignore
  }
  return null;
}

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
 * Extractor para Ok.ru / Odnoklassniki (MP4 1080p y HLS de alta velocidad sin bloqueos).
 */
async function extractOkRu(embedUrl: string): Promise<string | null> {
  try {
    const res = await fetch(embedUrl, {
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://ok.ru/' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const dataOptions = html.match(/data-options="([^"]+)"/);
    if (!dataOptions) return null;
    const raw = dataOptions[1].replace(/&quot;/g, '"');
    const json = JSON.parse(raw);
    const meta =
      typeof json?.flashvars?.metadata === 'string'
        ? JSON.parse(json.flashvars.metadata)
        : json?.flashvars?.metadata;
    if (meta?.videos && Array.isArray(meta.videos) && meta.videos.length > 0) {
      const best =
        meta.videos.find((v: { name?: string; url?: string }) => v.name === 'full' || v.name === '1080') ||
        meta.videos[meta.videos.length - 1];
      if (best?.url) return best.url;
    }
    if (meta?.ondemandHls) return meta.ondemandHls;
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
      if (server.name.includes('ok') || server.url.includes('ok.ru')) {
        const direct = await extractOkRu(server.url);
        if (direct) {
          recordProviderOutcome('latanime', 'found');
          return {
            serverName: `1080p HD Limpio (${dialect === 'castellano' ? 'Castellano' : 'Latino'})`,
            serverType: 'clean',
            audioLanguage: dialect === 'castellano' ? 'es-ES' : 'es-419',
            quality: '1080p',
            asset: {
              id: `latanime-ok-${episode}`,
              kind: direct.includes('.m3u8') ? 'hls' : 'mp4',
              src: toClientProxyUrl(direct, 'https://ok.ru/'),
              subtitles: [],
              markers: [],
              duration: 1440,
            },
          };
        }
      } else if (server.name.includes('mp4upload') || server.url.includes('mp4upload')) {
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

const jkSlugCache = new Map<string, string>();

async function searchJKanimeSlugs(title: string, romaji = ''): Promise<string[]> {
  const queries = Array.from(
    new Set([
      romaji ? cleanSearchTitle(romaji) : null,
      cleanSearchTitle(title),
    ])
  ).filter(Boolean) as string[];

  const candidates = new Set<string>();
  for (const q of queries) {
    if (!q) continue;
    try {
      const url = `https://jkanime.net/buscar/${encodeURIComponent(q)}/`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const regex = /href="https:\/\/jkanime\.net\/([a-zA-Z0-9_-]+)\/"/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(html)) !== null) {
        const slug = m[1];
        if (!['buscar', 'horario', 'top', 'programacion', 'emision', 'directorio', 'pedidos'].includes(slug)) {
          candidates.add(slug);
        }
      }
    } catch {
      // ignore
    }
  }
  return Array.from(candidates);
}

/**
 * Proveedor 2: JKanime (HLS VOD de alta velocidad en Japonés Subtitulado - 100% Sin Marcas).
 */
async function resolveFromJKanime(
  malId: string | number | null,
  animeTitle: string,
  episode: number,
  romajiTitle = ''
): Promise<ResolvedStream | null> {
  const cacheKey = `${malId || ''}:${animeTitle}:${romajiTitle || ''}`;
  const directSlugs = generateProviderSlugs(malId, animeTitle, romajiTitle);
  const cached = jkSlugCache.get(cacheKey);
  const slugsToTry = cached ? [cached, ...directSlugs.filter((s) => s !== cached)] : [...directSlugs];

  const trySlug = async (slug: string): Promise<ResolvedStream | null> => {
    const epUrl = `https://jkanime.net/${slug}/${episode}/`;
    try {
      const res = await fetch(epUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) return null;

      const html = await res.text();
      const iframeMatch =
        html.match(/https:\/\/jkanime\.net\/jkplayer\/(?:um|umv)\?e=[^"'\s]+/i) ||
        html.match(/src="(https:\/\/jkanime\.net\/jkplayer\/[a-zA-Z0-9_\-?=&]+)"/i);
      if (!iframeMatch) return null;

      const embedUrl = iframeMatch[1] || iframeMatch[0];
      const embedRes = await fetch(embedUrl, {
        headers: { 'User-Agent': USER_AGENT, Referer: epUrl },
        signal: AbortSignal.timeout(3500),
      });
      if (!embedRes.ok) return null;

      const embedHtml = await embedRes.text();
      let m3u8Url: string | null = null;
      const directMatch = embedHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
      if (directMatch?.[1]) {
        m3u8Url = directMatch[1];
      } else {
        const atobMatch = embedHtml.match(/atob\(["']([A-Za-z0-9+/=]+)["']\)/);
        if (atobMatch?.[1]) {
          try {
            const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf8');
            if (decoded.includes('.m3u8')) {
              m3u8Url = decoded;
            }
          } catch {
            // ignore
          }
        }
      }

      if (m3u8Url) {
        jkSlugCache.set(cacheKey, slug);
        return {
          serverName: 'Stream Ultra HD (Sub Español)',
          audioLanguage: 'ja',
          quality: '1080p',
          serverType: 'fast',
          asset: {
            id: `jk-hls-${episode}`,
            kind: 'hls',
            src: toClientProxyUrl(m3u8Url, 'https://jkanime.net/'),
            subtitles: [],
            markers: [],
            duration: 1440,
          },
        };
      }
    } catch {
      // ignore
    }
    return null;
  };

  for (const slug of slugsToTry) {
    const stream = await trySlug(slug);
    if (stream) return stream;
  }

  // Búsqueda dinámica en JKanime si fallaron los slugs directos
  const candidates = await searchJKanimeSlugs(animeTitle, romajiTitle);
  if (candidates.length > 0) {
    const bestSlug = matchBestSlug(candidates, animeTitle, romajiTitle);
    if (bestSlug && !slugsToTry.includes(bestSlug)) {
      const stream = await trySlug(bestSlug);
      if (stream) return stream;
    }
    for (const cand of candidates) {
      if (cand !== bestSlug && !slugsToTry.includes(cand)) {
        const stream = await trySlug(cand);
        if (stream) return stream;
      }
    }
  }

  return null;
}

const mcSlugCache = new Map<string, string>();

async function searchMonosChinosSlugs(title: string, romaji = ''): Promise<string[]> {
  const queries = Array.from(
    new Set([
      romaji ? cleanSearchTitle(romaji) : null,
      cleanSearchTitle(title),
    ])
  ).filter(Boolean) as string[];

  const candidates = new Set<string>();
  for (const q of queries) {
    if (!q) continue;
    try {
      const url = `https://monoschinos.st/buscar?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const matches = Array.from(html.matchAll(/href="https:\/\/monoschinos\.st\/anime\/([^"]+)"/g)).map((m) => m[1]);
      for (const m of matches) {
        candidates.add(m.replace(/-sub-espanol$/, ''));
      }
    } catch {
      // ignore
    }
  }
  return Array.from(candidates);
}

/**
 * Proveedor 3: MonosChinos (H.264 MP4 Directo Ultra HD en Japonés Subtitulado - 100% Sin Marcas).
 */
async function resolveFromMonosChinos(
  malId: string | number | null,
  animeTitle: string,
  episode: number,
  romajiTitle = ''
): Promise<ResolvedStream | null> {
  const cacheKey = `${malId || ''}:${animeTitle}:${romajiTitle || ''}`;
  const directSlugs = generateProviderSlugs(malId, animeTitle, romajiTitle);
  const cached = mcSlugCache.get(cacheKey);
  const slugsToTry = cached ? [cached, ...directSlugs.filter((s) => s !== cached)] : [...directSlugs];

  const trySlug = async (slug: string): Promise<ResolvedStream | null> => {
    const cleanSlug = slug.replace(/-sub-espanol$/, '');
    const epUrl = `https://monoschinos.st/ver/${cleanSlug}-episodio-${episode}`;
    try {
      const res = await fetch(epUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) return null;

      const html = await res.text();
      const playerMatches = Array.from(html.matchAll(/data-player="([^"]+)"/g)).map((m) => m[1]);
      const rawServers: string[] = [];
      for (const b64 of playerMatches) {
        try {
          const decoded = Buffer.from(b64, 'base64').toString('utf8');
          if (decoded && decoded.startsWith('http')) rawServers.push(decoded);
        } catch {
          // ignore decode errors
        }
      }

      // 1. Prioridad YourUpload (Verificado 100% limpio sin marcas de agua)
      const yu = rawServers.find((s) => s.includes('yourupload'));
      if (yu) {
        const direct = await extractYourUpload(yu);
        if (direct) {
          mcSlugCache.set(cacheKey, cleanSlug);
          return {
            serverName: '1080p HD Limpio (Sub Español)',
            serverType: 'clean',
            audioLanguage: 'ja',
            quality: '1080p',
            asset: {
              id: `monos-yu-${episode}`,
              kind: 'mp4',
              src: toClientProxyUrl(direct, 'https://www.yourupload.com/'),
              subtitles: [],
              markers: [],
              duration: 1440,
            },
          };
        }
      }

      // 2. MP4Upload (Verificado limpio H.264)
      const mp4u = rawServers.find((s) => s.includes('mp4upload'));
      if (mp4u) {
        const direct = await extractMP4Upload(mp4u);
        if (direct) {
          mcSlugCache.set(cacheKey, cleanSlug);
          return {
            serverName: 'MP4Upload (Sub Español)',
            serverType: 'clean',
            audioLanguage: 'ja',
            quality: '1080p',
            asset: {
              id: `monos-mp4-${episode}`,
              kind: 'mp4',
              src: toClientProxyUrl(direct, 'https://www.mp4upload.com/'),
              subtitles: [],
              markers: [],
              duration: 1440,
            },
          };
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  for (const slug of slugsToTry) {
    const stream = await trySlug(slug);
    if (stream) return stream;
  }

  // Búsqueda dinámica en MonosChinos si fallaron los slugs directos
  const candidates = await searchMonosChinosSlugs(animeTitle, romajiTitle);
  if (candidates.length > 0) {
    const bestSlug = matchBestSlug(candidates, animeTitle, romajiTitle);
    if (bestSlug && !slugsToTry.includes(bestSlug)) {
      const stream = await trySlug(bestSlug);
      if (stream) return stream;
    }
    for (const cand of candidates) {
      if (cand !== bestSlug && !slugsToTry.includes(cand)) {
        const stream = await trySlug(cand);
        if (stream) return stream;
      }
    }
  }

  return null;
}

/**
 * Proveedor 4: AnimeFLV (Sub Español HD).
 */
async function resolveFromAnimeFLV(
  animeTitle: string,
  episode: number,
  malId?: string | number | null,
  romajiTitle = ''
): Promise<ResolvedStream | null> {
  if (!isProviderAvailable('animeflv')) return null;

  const slugsToTry = generateProviderSlugs(malId ?? null, animeTitle, romajiTitle);

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
  const wantClean = opts.preferredServer === 'clean';
  const forceH264 = opts.codecPreference === 'h264';

  // Si se solicita específicamente H.264 (adaptación para iPadOS / Apple sin AV1):
  // REGLA ABSOLUTA: Solo fuentes H.264 limpias sin marcas (MonosChinos / JKanime).
  // MonosChinos (YourUpload / MP4Upload) se consulta PRIMERO por su respuesta en ~200ms sin bloqueos de Cloudflare en Vercel.
  if (forceH264) {
    streamResult = await resolveFromMonosChinos(malId, opts.title, opts.episodeNumber, opts.titleRomaji);
    if (!streamResult) {
      streamResult = await resolveFromJKanime(malId, opts.title, opts.episodeNumber, opts.titleRomaji);
    }
    if (!streamResult && isDubbed && opts.preferredAudio !== 'sub') {
      streamResult = await resolveFromLatanime(malId, opts.title, opts.episodeNumber, opts.preferredAudio === 'castellano' ? 'castellano' : 'latino');
    }
    if (!streamResult) {
      streamResult = await resolveFromAnimeFLV(opts.title, opts.episodeNumber, malId, opts.titleRomaji);
    }
  }

  // Si se pide servidor limpio y es audio con doblaje, priorizar OkRu de Latanime (sin marcas)
  if (!streamResult && wantClean && isDubbed && (opts.preferredAudio === 'latino' || opts.preferredAudio === 'castellano')) {
    streamResult = await resolveFromLatanime(malId, opts.title, opts.episodeNumber, opts.preferredAudio === 'castellano' ? 'castellano' : 'latino');
  }

  // Prioridad habitual incondicional: AnimeAV1 HLS Ultra HD (Sub Español y Audio Latino nativos)
  if (!streamResult && !forceH264) {
    streamResult = await resolveFromAnimeAV1(opts.title, opts.episodeNumber, opts.preferredAudio, opts.titleRomaji);
  }

  // 3. Si se solicitó explícitamente SUB y no se encontró en AnimeAV1:
  if (!streamResult && opts.preferredAudio === 'sub') {
    streamResult = await resolveFromMonosChinos(malId, opts.title, opts.episodeNumber, opts.titleRomaji);
    if (!streamResult) {
      streamResult = await resolveFromJKanime(malId, opts.title, opts.episodeNumber, opts.titleRomaji);
    }
    if (!streamResult) {
      streamResult = await resolveFromAnimeFLV(opts.title, opts.episodeNumber, malId, opts.titleRomaji);
    }
    // REGLA ESTRICTA: Si el usuario solicitó SUB, NUNCA caer a doblaje en español.
    if (streamResult) {
      const markers = await markersPromise;
      streamResult.asset.markers = markers;
      streamResult.availableServers = [
        { id: 'fast', name: '⚡ 1080p Ultra Rápido', badge: 'HLS', description: 'Carga instantánea en 0.5s' },
        { id: 'clean', name: '✨ 1080p HD Limpio', badge: 'Directo', description: 'Sin marcas de agua' },
      ];
      streamResult.serverType = streamResult.serverType ?? 'fast';
    }
    return streamResult;
  }

  // 4. Si se prefiere o permite DUB Latino y no se encontró en AnimeAV1:
  if (!streamResult && isDubbed && (opts.preferredAudio === 'latino' || opts.preferredAudio === 'castellano' || !opts.preferredAudio)) {
    streamResult = await resolveFromLatanime(malId, opts.title, opts.episodeNumber, opts.preferredAudio === 'castellano' ? 'castellano' : 'latino');
  }

  // 5. Fallback a Sub Español (MonosChinos -> JKanime -> AnimeFLV) - CERO MARCAS
  if (!streamResult) {
    streamResult = await resolveFromMonosChinos(malId, opts.title, opts.episodeNumber, opts.titleRomaji);
    if (!streamResult) {
      streamResult = await resolveFromJKanime(malId, opts.title, opts.episodeNumber, opts.titleRomaji);
    }
  }
  if (!streamResult) {
    streamResult = await resolveFromMonosChinos(malId, opts.title, opts.episodeNumber, opts.titleRomaji);
  }
  if (!streamResult) {
    streamResult = await resolveFromAnimeFLV(opts.title, opts.episodeNumber, malId, opts.titleRomaji);
  }

  // 6. Fallback final a DUB si aún no hay stream y el anime cuenta con doblaje
  if (!streamResult && isDubbed && opts.preferredAudio !== 'sub') {
    streamResult = await resolveFromLatanime(malId, opts.title, opts.episodeNumber, 'latino');
  }

  // 7. Inyectar marcas AniSkip y lista de servidores disponibles
  if (streamResult) {
    const markers = await markersPromise;
    streamResult.asset.markers = markers;
    streamResult.availableServers = [
      { id: 'fast', name: '⚡ 1080p Ultra Rápido', badge: 'HLS', description: 'Carga instantánea en 0.5s' },
      { id: 'clean', name: '✨ 1080p HD Limpio', badge: 'Directo', description: 'Sin marcas de agua' },
    ];
    if (!streamResult.serverType) {
      streamResult.serverType = streamResult.serverName.includes('Limpio') || streamResult.serverName.includes('OkRu') ? 'clean' : 'fast';
    }
  }

  return streamResult;
}
