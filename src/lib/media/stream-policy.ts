export const ALLOWED_CDN_DOMAINS: string[] = [
  'keeply.top',
  'ultracloud.cc',
  'megaplay.buzz',
  'miruro.tv',
  'bunnycdn.com',
  'rabbitstream.net',
  'dokicloud.one',
  'mcloud.to',
  'vizcloud.online',
  'rapid-cloud.co',
  'animeav1.com',
  'yourupload.com',
  'vidcache.net',
  'mp4upload.com',
  'streamtape.com',
  'voe.sx',
  'tioanime.com',
  'vgfplay.com',
  'mixdrop.bz',
  'mixdroop.bz',
  'derricknationtop.com',
  'latanime.org',
  'monoschinos2.com',
  'monoschinos2.net',
  'monoschinos.st',
  'streamwish.to',
  'streamwish.com',
  'filemoon.sx',
  'filemoon.to',
  'filemoon.in',
  'luluvdo.com',
  'doodstream.com',
  'streamhide.to',
  'broforgotsave.online',
  'nexabloom.top',
  'shiora.top',
  'wintergrove.space',
  'uwucdn.top',
  'kwik.cx',
  'echovideo',
  'roburnt10.store',
  'zilla-networks.com',
  'uns.bio',
  'animeflv.net',
  'www3.animeflv.net',
  'jkanime.net',
  'playmudos.com',
  'ducvomes.com',
  'jkdesa.com',
  'mega.nz',
  'ok.ru',
  'odnoklassniki.ru',
  'wyzie.io',
  'sub.wyzie.io',
  'subdl.com',
  'api.subdl.com',
  'dl.subdl.com',
  'anixo.buzz',
  'megavid.buzz',
  'cp.megavid.buzz',
  'cdn.megavid.buzz',
  'megavid.se',
  'analytics.anixo.buzz',
  'strem.io',
  'subs5.strem.io',
  'opensubtitles-v3.strem.io',
  'v3-cinemeta.strem.io',
  'commondatastorage.googleapis.com',
  'test-streams.mux.dev',
];

/**
 * Valida que el URL solicitado pertenezca a los CDNs autorizados y protege contra SSRF.
 */
export function isAuthorizedCdnUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

    const hostname = parsed.hostname.toLowerCase();
    // Bloquear explícitamente localhost, rangos privados y cloud metadata (SSRF)
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }

    return ALLOWED_CDN_DOMAINS.some((allowed) => hostname === allowed || hostname.endsWith('.' + allowed));
  } catch {
    return false;
  }
}

/**
 * Reescribe un manifiesto HLS (.m3u8) para canalizar sub-playlists y segmentos por el proxy.
 */
export function rewriteM3U8(
  content: string,
  baseUrl: string,
  referer = '',
  origin = '',
  proxyBase = '/api/stream/proxy'
): string {
  const lines = String(content || '').split('\n');
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      if (trimmed.includes('URI=')) {
        return trimmed.replace(/URI="?([^",\s]+)"?/g, (match, uri) => {
          try {
            const absolute = new URL(uri, baseUrl).href;
            const proxied = `${proxyBase}?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
            return `URI="${proxied}"`;
          } catch {
            return match;
          }
        });
      }
      return line;
    }

    try {
      const absolute = new URL(trimmed, baseUrl).href;
      return `${proxyBase}?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
    } catch {
      return line;
    }
  });

  return rewritten.join('\n');
}

/**
 * Convierte un timestamp de formato ASS/SSA (H:MM:SS.cs) al formato WebVTT (HH:MM:SS.mmm).
 */
export function assTimestampToVtt(value: string): string {
  const match = String(value || '').trim().match(/^(\d+):(\d{2}):(\d{2})[.:](\d{2,3})$/);
  if (!match) return String(value || '').trim();
  const hours = match[1].padStart(2, '0');
  const msRaw = match[4].padEnd(3, '0').slice(0, 3);
  return `${hours}:${match[2]}:${match[3]}.${msRaw}`;
}

/**
 * Normaliza cualquier formato de subtítulos (.srt, .ass, .ssa, .vtt) a estándar WebVTT (.vtt).
 */
export function normalizeSubtitleToVtt(text: string, sourceUrl = ''): string {
  const source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (/^WEBVTT(?:\s|$)/i.test(source)) {
    return source.endsWith('\n') ? source : `${source}\n`;
  }

  // Conversión ASS / SSA
  if (/^\s*\[Script Info\]/im.test(source) || /^\s*Dialogue:/im.test(source) || /\.(ass|ssa)(?:$|\?)/i.test(sourceUrl)) {
    const cues = source
      .split('\n')
      .filter((line) => /^Dialogue:/i.test(line))
      .map((line) => {
        const fields = line.replace(/^Dialogue:\s*/i, '').split(',');
        if (fields.length < 10) return null;
        const start = assTimestampToVtt(fields[1]);
        const end = assTimestampToVtt(fields[2]);
        const cueText = fields
          .slice(9)
          .join(',')
          .replace(/\{[^}]*\}/g, '')
          .replace(/\\N/gi, '\n')
          .replace(/\\h/gi, ' ')
          .trim();
        if (!start || !end || !cueText) return null;
        return `${start} --> ${end}\n${cueText}`;
      })
      .filter(Boolean);
    return `WEBVTT\n\n${cues.join('\n\n')}\n`;
  }

  // Conversión SRT estándar (00:01:23,456 --> 00:01:25,789)
  const srt = source.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${srt}\n`;
}
