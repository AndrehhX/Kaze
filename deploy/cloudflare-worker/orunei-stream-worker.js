/**
 * Orunei Streaming Engine — Cloudflare Worker
 * Microservicio Edge 24/7 de alta velocidad y multi-servidor para Orunei
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MIRURO_BASE = 'https://barelystarted.miruro.tv';

const BROWSER_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range, Origin, Accept',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

const ALLOWED_CDN_DOMAINS = [
  'keeply.top',
  'ultracloud.cc',
  'megaplay.buzz',
  'miruro.tv',
  'miruro.to',
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
  'okcdn.ru',
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

function isAuthorizedCdnUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

    const hostname = parsed.hostname.toLowerCase();
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

// ── Reparto de segmentos con la VPS ──────────────────────────────────────────
// El plan gratis de Workers tiene 100.000 peticiones/día y cada episodio son ~300-400 segmentos.
// Para no agotarlo, la mitad de los segmentos de cada playlist se sirven desde la VPS
// (resolver.orunei.sbs/api/stream/seg) con un enlace firmado. Solo se activa si existen los
// secretos SEGMENT_SIGNING_KEY y VPS_SEGMENT_BASE y la VPS responde; si no, todo sigue por aquí.
const SPLIT_SIGNATURE_TTL = 6 * 3600;
let vpsHealth = { ok: false, checkedAt: 0 };

async function vpsIsHealthy(env) {
  if (Date.now() - vpsHealth.checkedAt < 60_000) return vpsHealth.ok;
  let ok = false;
  try {
    const healthUrl = new URL(env.VPS_SEGMENT_BASE);
    healthUrl.pathname = '/health';
    const r = await fetch(healthUrl.href, { signal: AbortSignal.timeout(1500) });
    ok = r.ok;
  } catch {
    ok = false;
  }
  vpsHealth = { ok, checkedAt: Date.now() };
  return ok;
}

function toBase64Url(buf) {
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Firma "<host>|<exp>" con HMAC-SHA256 (la VPS la comprueba con la misma clave). */
async function signSegmentHost(secret, host, exp) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${host}|${exp}`));
  return toBase64Url(sig).slice(0, 32);
}

const SUBTITLE_EXT = /\.(vtt|webvtt|srt|ass|ssa)(?:$|\?)/i;

/** Prepara el reparto para una playlist de medios: firma cada host de segmentos una sola vez. */
async function buildSegmentSplit(env, content, baseUrl) {
  if (!env || !env.SEGMENT_SIGNING_KEY || !env.VPS_SEGMENT_BASE) return null;
  const hosts = new Set();
  for (const line of String(content || '').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    try {
      const abs = new URL(t, baseUrl);
      if (abs.href.includes('.m3u8') || abs.href.includes('/m3u8/') || SUBTITLE_EXT.test(abs.pathname)) continue;
      hosts.add(abs.host);
    } catch {}
  }
  if (!hosts.size || !(await vpsIsHealthy(env))) return null;
  const exp = Math.floor(Date.now() / 1000) + SPLIT_SIGNATURE_TTL;
  const sigs = new Map();
  for (const host of hosts) sigs.set(host, await signSegmentHost(env.SEGMENT_SIGNING_KEY, host, exp));
  return { base: env.VPS_SEGMENT_BASE, exp, sigs };
}

function rewriteM3U8(content, baseUrl, referer = '', origin = '', proxyBase = '/api/stream/proxy', split = null) {
  if (typeof referer === 'object' && referer !== null) {
    const opts = referer;
    proxyBase = opts.proxyBase || proxyBase;
    origin = opts.origin || origin;
    referer = opts.referer || '';
  }

  const cleanBase = String(proxyBase || '/api/stream/proxy').replace(/\/stream\.m3u8$/, '').replace(/\/+$/, '');
  const lines = String(content || '').split('\n');
  let segmentIndex = 0;
  const rewritten = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      if (trimmed.includes('URI=')) {
        return trimmed.replace(/URI="?([^",\s]+)"?/g, (match, uri) => {
          try {
            const absolute = new URL(uri, baseUrl).href;
            const isSubM3u8 = absolute.includes('.m3u8') || absolute.includes('/m3u8/');
            const targetBase = isSubM3u8 ? `${cleanBase}/stream.m3u8` : cleanBase;
            const proxied = `${targetBase}?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
            return `URI="${proxied}"`;
          } catch {
            return match;
          }
        });
      }
      return line;
    }

    try {
      const absoluteUrl = new URL(trimmed, baseUrl);
      const absolute = absoluteUrl.href;
      const isSubM3u8 = absolute.includes('.m3u8') || absolute.includes('/m3u8/');
      // Segmentos de video alternos (1 de cada 2) van a la VPS con su firma.
      if (split && !isSubM3u8 && !SUBTITLE_EXT.test(absoluteUrl.pathname)) {
        const sig = split.sigs.get(absoluteUrl.host);
        if (sig && segmentIndex++ % 2 === 1) {
          return `${split.base}?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}&exp=${split.exp}&sig=${sig}`;
        }
      }
      const targetBase = isSubM3u8 ? `${cleanBase}/stream.m3u8` : cleanBase;
      return `${targetBase}?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
    } catch {
      return line;
    }
  });

  return rewritten.join('\n');
}

async function resolveMiruroId(anilistId, animeTitle) {
  if (!animeTitle && !anilistId) return null;
  try {
    const query = animeTitle || '';
    const searchUrl = `${MIRURO_BASE}/search?q=${encodeURIComponent(query)}`;
    const resp = await fetch(searchUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${MIRURO_BASE}/`
      }
    });

    if (!resp.ok) return null;
    const html = await resp.text();
    const alIdStr = String(anilistId);

    const pattern1 = /id:"([a-zA-Z0-9_\-]{20,40})"[^\{]*external_ids:\{[^\}]*anilist:\["(\d+)"\]/g;
    let match;
    while ((match = pattern1.exec(html)) !== null) {
      if (match[2] === alIdStr) return match[1];
    }

    const pattern2 = /id:"([a-zA-Z0-9_\-]{20,40})"[^\{]*externalIds:\{[^\}]*anilist:\["(\d+)"\]/g;
    while ((match = pattern2.exec(html)) !== null) {
      if (match[2] === alIdStr) return match[1];
    }

    const fallbackMatch = /id:"([a-zA-Z0-9_\-]{20,40})",external_ids/g.exec(html);
    if (fallbackMatch) return fallbackMatch[1];
  } catch (err) {
    console.error('Error resolving Miruro ID:', err);
  }
  return null;
}

function categorizeSubtitles(subtitlesList, defaultHeaders = {}) {
  const spanish = [];
  const english = [];
  const other = [];

  const ref = defaultHeaders.Referer || defaultHeaders.referer || '';
  const orig = defaultHeaders.Origin || defaultHeaders.origin || '';

  for (const sub of subtitlesList) {
    const rawLang = (sub.language || sub.lang || sub.label || '').toLowerCase();
    const rawLabel = (sub.label || sub.name || '').toLowerCase();
    const file = sub.file || sub.url;
    if (!file) continue;

    const entry = {
      file,
      referer: ref,
      origin: orig,
      format: sub.format || 'vtt',
      rawLanguage: sub.language || 'unknown',
      label: sub.label || sub.language || 'Subtítulo',
      default: Boolean(sub.default)
    };

    if (rawLang === 'sp' || rawLang === 'es' || rawLang === 'spa' || rawLabel.includes('spanish') || rawLabel.includes('español')) {
      let dialect = 'Español';
      let langCode = 'es';
      if (rawLabel.includes('latin') || rawLabel.includes('latam') || rawLang === 'es-419') {
        dialect = 'Español (Latinoamérica)';
        langCode = 'es-419';
      } else if (rawLabel.includes('spain') || rawLabel.includes('españa') || rawLang === 'es-es') {
        dialect = 'Español (España)';
        langCode = 'es-ES';
      }
      spanish.push({ ...entry, dialect, langCode, cleanLabel: dialect });
    } else if (rawLang === 'en' || rawLang === 'eng' || rawLabel.includes('english') || rawLabel.includes('inglés')) {
      english.push({ ...entry, dialect: 'Inglés', langCode: 'en', cleanLabel: 'Inglés' });
    } else {
      other.push({ ...entry, dialect: sub.label || 'Otro', langCode: rawLang || 'und', cleanLabel: sub.label || 'Otro' });
    }
  }

  spanish.sort((a, b) => {
    const weight = (code) => code === 'es-419' ? 1 : code === 'es-ES' ? 2 : 3;
    return weight(a.langCode) - weight(b.langCode);
  });

  return { spanish, english, other, total: subtitlesList.length };
}

async function probeStreamCandidate(server) {
  const target = String(server?.rawStreamUrl || '').trim();
  if (!/^https?:\/\//i.test(target)) return false;

  const headers = { ...BROWSER_HEADERS, Range: 'bytes=0-1' };
  if (server.referer) headers.Referer = server.referer;
  if (server.origin) headers.Origin = server.origin;

  try {
    const response = await fetch(target, { method: 'HEAD', headers });
    if (response.ok) return true;
    if (![403, 405, 416].includes(response.status)) return false;
  } catch {
    return false;
  }

  try {
    const response = await fetch(target, { headers });
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
}

async function resolveEpisode(miruroId, episodeNum = 1, workerOrigin = 'https://orunei-stream.thealex230820.workers.dev', options = {}) {
  const proxyBase = workerOrigin ? `${workerOrigin.replace(/\/+$/, '')}/api/stream/proxy` : '/api/stream/proxy';
  const endpoint = `${MIRURO_BASE}/api/sources?id=${encodeURIComponent(miruroId)}&n=${encodeURIComponent(episodeNum)}`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${MIRURO_BASE}/`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    throw new Error(`Error en API Miruro: ${err.message}`);
  }

  if (!response || !response.ok) {
    throw new Error(`API Miruro respondió con status ${response ? response.status : 'desconocido'}`);
  }

  const data = await response.json();
  const tracks = data.tracks || [];
  const primaryTrack = tracks.find(t => t.track === 'ssub') || tracks.find(t => t.track === 'sub') || tracks[0];

  if (!primaryTrack) {
    throw new Error(`No se encontraron pistas de reproducción para el episodio ${episodeNum}`);
  }

  const providerOrder = data.providerOrder || ['sun', 'bee', 'hop', 'ally', 'kiwi', 'moo', 'knob', 'nun', 'bun', 'cog', 'telli'];

  let selectedSubs = { spanish: [], english: [], other: [], total: 0 };
  for (const track of tracks) {
    for (const prov of track.providers || []) {
      const pHeaders = prov.servers?.[0]?.headers || {};
      const subs = categorizeSubtitles(prov.subtitles || [], pHeaders);
      if (subs.spanish.length > selectedSubs.spanish.length) {
        selectedSubs = subs;
      } else if (selectedSubs.spanish.length === 0 && subs.english.length > selectedSubs.english.length) {
        selectedSubs = subs;
      }
    }
  }

  const availableServers = [];
  const seenUrls = new Set();

  function registerServer(provName, srv, trackType) {
    const streams = (srv.streams || []).filter(s => s.url);
    if (streams.length === 0) return;
    const stream = streams[0];
    if (seenUrls.has(stream.url)) return;
    seenUrls.add(stream.url);

    const sHeaders = srv.headers || {};
    const ref = sHeaders.Referer || sHeaders.referer || '';
    const orig = sHeaders.Origin || sHeaders.origin || '';
    const proxied = `${proxyBase}?url=${encodeURIComponent(stream.url)}&referer=${encodeURIComponent(ref)}&origin=${encodeURIComponent(orig)}`;

    const serverIndex = availableServers.length + 1;
    let label = `Servidor ${serverIndex}`;
    if (provName === 'sun') label += ' (Ultra HD)';
    else if (provName === 'bee') label += ' (Vidstream)';
    else if (provName === 'hop') label += ' (Rápido)';
    else if (provName === 'knob') label += ' (MyCloud)';
    else if (provName === 'kiwi') label += ' (AnimePahe)';
    else label += ` (${provName.toUpperCase()})`;

    availableServers.push({
      id: `srv-${serverIndex}`,
      name: label,
      provider: provName,
      serverName: srv.server || 'default',
      rawStreamUrl: stream.url,
      proxiedStreamUrl: proxied
    });
  }

  for (const provName of providerOrder) {
    const prov = (primaryTrack.providers || []).find(p => p.provider === provName);
    if (!prov) continue;
    for (const srv of prov.servers || []) {
      registerServer(provName, srv, primaryTrack.track);
    }
  }

  for (const track of tracks) {
    if (track === primaryTrack) continue;
    for (const provName of providerOrder) {
      const prov = (track.providers || []).find(p => p.provider === provName);
      if (!prov) continue;
      for (const srv of prov.servers || []) {
        registerServer(provName, srv, track.track);
      }
    }
  }

  if (availableServers.length === 0) {
    throw new Error(`Ningún proveedor devolvió transmisiones disponibles para el episodio ${episodeNum}`);
  }

  const primaryServer = availableServers[0];

  const buildProxiedTrack = (sub, idx, isDefault = false) => {
    let src = `${proxyBase}?url=${encodeURIComponent(sub.file)}`;
    if (sub.referer) src += `&referer=${encodeURIComponent(sub.referer)}`;
    if (sub.origin) src += `&origin=${encodeURIComponent(sub.origin)}`;
    return {
      id: `sub-${sub.langCode}-${idx}`,
      label: sub.cleanLabel,
      lang: sub.langCode,
      src,
      default: isDefault
    };
  };

  const formattedTracks = [];
  selectedSubs.spanish.forEach((sub, idx) => {
    formattedTracks.push(buildProxiedTrack(sub, idx, idx === 0));
  });
  if (selectedSubs.english.length > 0) {
    formattedTracks.push(buildProxiedTrack(selectedSubs.english[0], formattedTracks.length, formattedTracks.length === 0));
  }

  return {
    miruroId,
    episodeNum,
    provider: primaryServer.provider,
    server: primaryServer.serverName,
    rawStreamUrl: primaryServer.rawStreamUrl,
    proxiedStreamUrl: primaryServer.proxiedStreamUrl,
    servers: availableServers,
    hasSpanishSubtitles: selectedSubs.spanish.length > 0,
    subtitles: {
      hasSpanish: selectedSubs.spanish.length > 0,
      tracks: formattedTracks,
      totalAvailable: selectedSubs.total
    }
  };
}

function assTimestampToVtt(value) {
  const match = String(value || '').trim().match(/^(\d+):(\d{2}):(\d{2})[.:](\d{2})$/);
  if (!match) return String(value || '').trim();
  const hours = match[1].padStart(2, '0');
  const milliseconds = String(Math.round(Number(`0.${match[4]}`) * 1000)).padStart(3, '0');
  return `${hours}:${match[2]}:${match[3]}.${milliseconds}`;
}

function normalizeSubtitleToVtt(text, sourceUrl = '') {
  const source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (/^WEBVTT(?:\s|$)/i.test(source)) return source.endsWith('\n') ? source : `${source}\n`;

  if (/^\s*\[Script Info\]/im.test(source) || /^\s*Dialogue:/im.test(source) || /\.(ass|ssa)(?:$|\?)/i.test(sourceUrl)) {
    const cues = source.split('\n')
      .filter((line) => /^Dialogue:/i.test(line))
      .map((line) => {
        const fields = line.replace(/^Dialogue:\s*/i, '').split(',');
        if (fields.length < 10) return null;
        const start = assTimestampToVtt(fields[1]);
        const end = assTimestampToVtt(fields[2]);
        const cueText = fields.slice(9).join(',')
          .replace(/\{[^}]*\}/g, '')
          .replace(/\\N/g, '\n')
          .replace(/\\n/g, '\n')
          .replace(/\\h/g, ' ')
          .trim();
        if (!start || !end || !cueText) return null;
        return `${start} --> ${end}\n${cueText}`;
      })
      .filter(Boolean);
    return `WEBVTT\n\n${cues.join('\n\n')}\n`;
  }

  const srt = source.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${srt}\n`;
}

async function handleProxy(url, referer, origin, clientRequest, env) {
  if (!url) return jsonResponse({ error: 'Falta parametro url' }, 400);
  if (!isAuthorizedCdnUrl(url)) {
    return jsonResponse({ error: 'Destino no autorizado por política SSRF' }, 403);
  }

  let effectiveReferer = referer || '';
  let effectiveOrigin = origin || '';

  if (!effectiveReferer) {
    if (url.includes('anixo.buzz')) {
      effectiveReferer = 'https://www.miruro.to/';
      if (!effectiveOrigin) effectiveOrigin = 'https://www.miruro.to';
    } else if (url.includes('keeply.top') || url.includes('ultracloud.cc')) {
      effectiveReferer = 'https://ultracloud.cc/';
      if (!effectiveOrigin) effectiveOrigin = 'https://ultracloud.cc';
    } else if (url.includes('broforgotsave.online') || url.includes('nexabloom.top') || url.includes('shiora.top') || url.includes('wintergrove.space') || url.includes('megaplay.buzz')) {
      effectiveReferer = 'https://megaplay.buzz/';
    } else if (url.includes('uwucdn.top') || url.includes('kwik.cx')) {
      effectiveReferer = 'https://kwik.cx/';
    } else if (url.includes('echovideo') || url.includes('roburnt10.store')) {
      effectiveReferer = 'https://play.echovideo.ru/';
    } else if (url.includes('zilla-networks.com')) {
      const match = url.match(/\/(?:m3u8|segs)\/([a-zA-Z0-9]+)/);
      effectiveReferer = match ? `https://player.zilla-networks.com/play/${match[1]}` : 'https://player.zilla-networks.com/';
      if (!effectiveOrigin) effectiveOrigin = 'https://player.zilla-networks.com';
    } else if (url.includes('ok.ru') || url.includes('okcdn.ru') || url.includes('odnoklassniki.ru')) {
      effectiveReferer = 'https://ok.ru/';
      if (!effectiveOrigin) effectiveOrigin = 'https://ok.ru';
    }
  }

  const isZilla = url.includes('zilla-networks.com');
  const upstreamHeaders = {
    'User-Agent': isZilla ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0' : USER_AGENT
  };
  if (effectiveReferer) upstreamHeaders['Referer'] = effectiveReferer;
  if (effectiveOrigin) upstreamHeaders['Origin'] = effectiveOrigin;
  if (isZilla) {
    upstreamHeaders['Sec-Fetch-Dest'] = 'empty';
    upstreamHeaders['Sec-Fetch-Mode'] = 'cors';
    upstreamHeaders['Sec-Fetch-Site'] = 'same-origin';
  }

  const range = clientRequest.headers.get('range');
  if (range) upstreamHeaders['Range'] = range;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000);

  let upstreamResp;
  try {
    upstreamResp = await fetch(url, {
      method: clientRequest.method,
      headers: upstreamHeaders,
      signal: controller.signal
    });
  } catch (err) {
    return jsonResponse({ error: `CDN timeout o error de conexión: ${err.message}` }, 504);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstreamResp.ok && upstreamResp.status !== 206) {
    return jsonResponse({ error: `CDN error: HTTP ${upstreamResp.status}` }, upstreamResp.status);
  }

  const contentType = upstreamResp.headers.get('content-type') || '';
  const isM3U8 = (contentType.includes('mpegurl') || contentType.includes('x-mpegURL') || url.includes('.m3u8')) &&
    !contentType.includes('mp2t') &&
    !contentType.includes('video/');
  let isVTT = url.includes('.vtt') || contentType.includes('vtt') || contentType.includes('text/plain');

  const headers = new Headers(corsHeaders());
  headers.set('Accept-Ranges', 'bytes');

  if (upstreamResp.status === 206) {
    const cr = upstreamResp.headers.get('content-range');
    if (cr) headers.set('Content-Range', cr);
  }

  if (isM3U8) {
    headers.set('Cache-Control', 'no-cache');
    const rawText = await upstreamResp.text();
    const workerOrigin = clientRequest ? new URL(clientRequest.url).origin : 'https://orunei-stream.thealex230820.workers.dev';
    let split = null;
    try {
      split = await buildSegmentSplit(env, rawText, url);
    } catch {
      split = null; // ante cualquier fallo, todo sigue por el Worker
    }
    const rewritten = rewriteM3U8(rawText, url, referer, origin, `${workerOrigin}/api/stream/proxy`, split);
    headers.set('Content-Type', 'application/vnd.apple.mpegurl');
    return new Response(rewritten, { status: upstreamResp.status, headers });
  }

  const isExternalSubtitle = /\.(srt|vtt|ass|ssa)(?:$|\?)/i.test(url) || contentType.includes('subtitle');
  if (isExternalSubtitle) {
    const rawSubtitle = await upstreamResp.text();
    const normalizedSubtitle = normalizeSubtitleToVtt(rawSubtitle, url);
    headers.set('Content-Type', 'text/vtt; charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
    return new Response(normalizedSubtitle, { status: upstreamResp.status, headers });
  }

  // Detección precisa de subtítulos WebVTT vs fragmentos de video disfrazados de imágenes
  if (!isVTT && url.includes('/a/') && (url.endsWith('.jpeg') || url.endsWith('.jpg') || url.endsWith('.png'))) {
    const buf = await upstreamResp.arrayBuffer();
    const head = new Uint8Array(buf.slice(0, 10));
    const isActuallyVtt = head.length >= 6 && head[0] === 0x57 && head[1] === 0x45 && head[2] === 0x42; // "WEB"
    if (isActuallyVtt) {
      headers.set('Content-Type', 'text/vtt; charset=utf-8');
      headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
      return new Response(buf, { status: upstreamResp.status, headers });
    }
    // Es un fragmento de video TS binario
    headers.set('Content-Type', 'video/mp2t');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
    return new Response(buf, { status: upstreamResp.status, headers });
  }

  if (isVTT) {
    headers.set('Content-Type', 'text/vtt; charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
    const vttText = await upstreamResp.text();
    return new Response(vttText, { status: upstreamResp.status, headers });
  }

  const isVideoChunk = url.includes('.ts') || url.includes('.m4s') || url.includes('.mp4') || url.includes('.png') || url.includes('.jpg') || url.includes('/segs/') || url.includes('.html');
  const finalType = isVideoChunk ? (url.includes('.mp4') || url.includes('/segs/') || url.includes('.html') ? 'video/mp4' : 'video/mp2t') : (contentType || 'application/octet-stream');
  headers.set('Content-Type', finalType);

  if (upstreamResp.status === 206 || url.includes(':183') || url.includes(':282')) {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (isVideoChunk) {
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
  } else {
    headers.set('Cache-Control', 'no-cache');
  }

  const cl = upstreamResp.headers.get('content-length');
  if (cl) headers.set('Content-Length', cl);

  return new Response(upstreamResp.body, { status: upstreamResp.status, headers });
}

const NEWS_FEEDS = [
  { name: 'Crunchyroll', url: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/es-ES/rss', grad: 'linear-gradient(135deg,#f08a3a,#3a2a22)' },
  { name: 'Crunchyroll News', url: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss', grad: 'linear-gradient(135deg,#f08a3a,#3a2a22)' },
  { name: 'Anime News Network', url: 'https://www.animenewsnetwork.com/all/rss.xml', grad: 'linear-gradient(135deg,#2a3a6a,#6d5cff)' },
  { name: 'MyAnimeList', url: 'https://myanimelist.net/rss/news.xml', grad: 'linear-gradient(135deg,#1b3a6a,#7fb6e6)' }
];

const NEWS_ENT = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&#039;': "'", '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&hellip;': '…' };
function cleanNewsStr(str = '') {
  return str.replace(/<[^>]*>/g, ' ').replace(/&[#\w]+;/g, (m) => NEWS_ENT[m] ?? ' ').replace(/\s+/g, ' ').trim();
}

function parseWorkerRss(xmlText, feedName, grad) {
  const items = [];
  const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i) || itemXml.match(/<guid[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/guid>/i);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/i) || itemXml.match(/<content:encoded>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/content:encoded>/i);
    const pubDateMatch = itemXml.match(/<pubDate>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/pubDate>/i);

    let img = '';
    const mediaThumb = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) || itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/i) || itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
    if (mediaThumb) {
      img = mediaThumb[1];
    } else {
      const thumbContent = itemXml.match(/<media:thumbnail>([^<]+)<\/media:thumbnail>/i);
      if (thumbContent && thumbContent[1].startsWith('http')) {
        img = thumbContent[1].trim();
      }
    }

    if (!img) {
      const imgInDesc = (descMatch ? (descMatch[1] || descMatch[2] || '') : '').match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgInDesc) img = imgInDesc[1];
    }

    const title = cleanNewsStr(titleMatch ? (titleMatch[1] || titleMatch[2] || '') : '');
    const link = (linkMatch ? (linkMatch[1] || linkMatch[2] || '') : '').trim();
    const desc = cleanNewsStr(descMatch ? (descMatch[1] || descMatch[2] || '') : '').slice(0, 180);
    const pubDate = pubDateMatch ? (pubDateMatch[1] || pubDateMatch[2] || '').trim() : '';
    const ts = pubDate ? new Date(pubDate).getTime() || Date.now() : Date.now();

    if (title && link) {
      items.push({
        id: link,
        t: title,
        d: desc,
        s: feedName,
        ts,
        img: img || `https://api.microlink.io/?url=${encodeURIComponent(link)}&screenshot=true&meta=false&embed=screenshot.url`,
        link,
        grad
      });
    }
  }

  return items;
}

async function fetchWorkerNews() {
  const feedPromises = NEWS_FEEDS.map(async (feed) => {
    try {
      const resp = await fetch(feed.url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
        }
      });
      if (!resp.ok) return [];
      const text = await resp.text();
      return parseWorkerRss(text, feed.name, feed.grad);
    } catch {
      return [];
    }
  });

  const results = await Promise.all(feedPromises);
  const seen = new Set();
  return results.flat().filter(n => n.t && !seen.has(n.id) && seen.add(n.id)).sort((a, b) => b.ts - a.ts);
}

async function handleAnime1v(request, env, action, params) {
  const configuredBase = String(env?.ANIME1V_API_URL || '').trim().replace(/\/+$/, '');
  if (!configuredBase) {
    return jsonResponse({ error: 'Anime1v experimental no configurado en el backend' }, 503);
  }

  if (!['search', 'episode'].includes(action)) {
    return jsonResponse({ error: 'Ruta Anime1v no permitida' }, 404);
  }

  const upstream = configuredBase.endsWith('/api/v1')
    ? new URL(`${configuredBase}/anime/${action}`)
    : new URL(`${configuredBase}/api/v1/anime/${action}`);
  for (const [key, value] of params.entries()) {
    upstream.searchParams.set(key, value);
  }

  const headers = {
    ...BROWSER_HEADERS,
    Accept: 'application/json',
    Referer: configuredBase
  };
  if (env?.ANIME1V_API_KEY) headers['X-API-Key'] = env.ANIME1V_API_KEY;

  try {
    const upstreamResponse = await fetch(upstream.href, { headers });
    const body = await upstreamResponse.arrayBuffer();
    const responseHeaders = new Headers(corsHeaders());
    responseHeaders.set('Content-Type', upstreamResponse.headers.get('content-type') || 'application/json');
    responseHeaders.set('Cache-Control', 'no-store');
    return new Response(body, { status: upstreamResponse.status, headers: responseHeaders });
  } catch (error) {
    return jsonResponse({ error: `Anime1v no disponible: ${error.message}` }, 502);
  }
}

const subtitleKitsuCache = new Map();

function normalizeLookupTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function resolveKitsuIdByTitle(title) {
  const normalizedTitle = normalizeLookupTitle(title);
  if (!normalizedTitle) return null;
  const cached = subtitleKitsuCache.get(normalizedTitle);
  if (cached && cached.expiresAt > Date.now()) return cached.id;

  try {
    const endpoint = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=5`;
    const response = await fetch(endpoint, { headers: { ...BROWSER_HEADERS, Accept: 'application/vnd.api+json' } });
    if (!response.ok) return null;
    const payload = await response.json();
    const candidates = Array.isArray(payload?.data) ? payload.data : [];
    const exact = candidates.find((candidate) => {
      const attrs = candidate?.attributes || {};
      return [attrs.canonicalTitle, attrs.titles?.en, attrs.titles?.en_jp, attrs.titles?.ja_jp]
        .map(normalizeLookupTitle)
        .includes(normalizedTitle);
    });
    const id = exact?.id || candidates[0]?.id || null;
    if (id) subtitleKitsuCache.set(normalizedTitle, { id, expiresAt: Date.now() + 30 * 60 * 1000 });
    return id;
  } catch {
    return null;
  }
}

async function handleLegacySubtitleSearch(request, env, params) {
  const configuredBase = String(env?.SUBTITLE_ALCHEMY_URL || '').trim().replace(/\/+$/, '');
  const configuredProfile = String(env?.SUBTITLE_ALCHEMY_CONFIG || '').trim();
  if (!configuredBase || !configuredProfile) {
    return jsonResponse({ error: 'Proveedor de subtítulos externos no configurado en el backend' }, 503);
  }

  const title = String(params.get('title') || '').trim();
  const kitsuId = String(params.get('kitsuId') || '').trim() || await resolveKitsuIdByTitle(title);
  const episode = Math.max(1, parseInt(params.get('episode') || '1', 10) || 1);
  const season = Math.max(1, parseInt(params.get('season') || '1', 10) || 1);
  if (!kitsuId) return jsonResponse({ error: 'No se pudo resolver el anime en Kitsu' }, 422);

  const encodedConfig = encodeURIComponent(configuredProfile);
  const encodedId = encodeURIComponent(`kitsu:${kitsuId}`);
  const upstream = `${configuredBase}/${encodedConfig}/subtitles/series/${encodedId}/${season}:${episode}.json`;

  try {
    const upstreamResponse = await fetch(upstream, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/json',
        Referer: configuredBase,
      },
    });
    const body = await upstreamResponse.text();
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      const responseHeaders = new Headers(corsHeaders());
      responseHeaders.set('Content-Type', upstreamResponse.headers.get('content-type') || 'application/json');
      responseHeaders.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      return new Response(body, { status: upstreamResponse.status, headers: responseHeaders });
    }

    const subtitles = normalizeProviderSubtitles(payload, 'subalchemy', request);
    if (subtitles.length === 0) {
      return jsonResponse({ error: 'SubAlchemy no tiene subtítulos en español para este episodio' }, 503);
    }

    return jsonResponse({ provider: 'subalchemy', subtitles, hasSpanish: true });
  } catch (error) {
    return jsonResponse({ error: `Proveedor de subtítulos no disponible: ${error.message}` }, 502);
  }
}

const WYZIE_SEARCH_URL = 'https://sub.wyzie.io/search';
const SUBDL_SEARCH_URL = 'https://api.subdl.com/api/v2/subtitles/search';
const CINEMETA_SERIES_SEARCH_URL = 'https://v3-cinemeta.strem.io/catalog/series/top/search=';
const wyzieMediaIdCache = new Map();

function readSubtitleEntries(payload) {
  const entries = [];
  const visit = (value, depth = 0) => {
    if (!value || depth > 4) return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;
    if (value.url || value.file || value.subtitleUrl || value.download_url || value.downloadUrl) entries.push(value);
    for (const key of ['subtitles', 'results', 'files', 'alternates', 'data']) {
      if (value[key]) visit(value[key], depth + 1);
    }
  };
  visit(payload);
  return entries;
}

function normalizeSubtitleLanguage(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'es' || raw === 'spa' || raw === 'sp' || raw === 'spanish' || raw.includes('espanol')) return 'es';
  if (raw === 'es-419' || raw.includes('latam') || raw.includes('latin')) return 'es-419';
  if (raw === 'es-es' || raw.includes('castellano') || raw.includes('spain')) return 'es-ES';
  return raw;
}

function normalizeSubtitleUrl(rawUrl, provider) {
  const value = String(rawUrl || '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (provider === 'subdl' && value.startsWith('/')) return `https://dl.subdl.com${value}`;
  return '';
}

function createSubtitleProxyUrl(request, sourceUrl) {
  const origin = new URL(request.url).origin;
  return `${origin}/api/stream/proxy?url=${encodeURIComponent(sourceUrl)}`;
}

function normalizeProviderSubtitles(payload, provider, request) {
  const tracks = [];
  const seen = new Set();
  for (const [index, entry] of readSubtitleEntries(payload).entries()) {
    const language = normalizeSubtitleLanguage(entry.lang || entry.language || entry.iso639 || entry.display || entry.label || entry.name);
    if (!language.startsWith('es')) continue;
    const sourceUrl = normalizeSubtitleUrl(entry.url || entry.file || entry.subtitleUrl || entry.download_url || entry.downloadUrl, provider);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    tracks.push({
      id: String(entry.id || entry.n_id || `${provider}-es-${index}`),
      url: createSubtitleProxyUrl(request, sourceUrl),
      lang: language,
      name: entry.name || entry.display || entry.release_name || (language === 'es-419' ? 'Espanol latino' : 'Espanol'),
      provider,
      format: entry.format || (sourceUrl.match(/\\.([a-z0-9]+)(?:\\?|$)/i)?.[1] || 'srt'),
      default: tracks.length === 0,
    });
  }
  return tracks;
}

async function fetchSubtitleProvider(url, options = {}) {
  const response = await fetch(url, {
    headers: { ...BROWSER_HEADERS, Accept: 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) return null;
  return response.json();
}

async function resolveWyzieMediaId(params) {
  const directId = String(params.get('tmdbId') || params.get('imdbId') || '').trim();
  if (directId) return directId;

  const title = String(params.get('title') || '').trim();
  const normalizedTitle = normalizeLookupTitle(title);
  if (!normalizedTitle) return '';

  const cached = wyzieMediaIdCache.get(normalizedTitle);
  if (cached && cached.expiresAt > Date.now()) return cached.id;

  try {
    const endpoint = `${CINEMETA_SERIES_SEARCH_URL}${encodeURIComponent(title)}.json`;
    const response = await fetch(endpoint, {
      headers: { ...BROWSER_HEADERS, Accept: 'application/json' },
    });
    if (!response.ok) return '';

    const payload = await response.json();
    const metas = Array.isArray(payload?.metas) ? payload.metas : [];
    const exact = metas.find((meta) => normalizeLookupTitle(meta?.name) === normalizedTitle);
    const candidate = exact || metas.find((meta) => meta?.imdb_id || /^tt\d+$/i.test(String(meta?.id || '')));
    const id = String(candidate?.imdb_id || candidate?.id || '').trim();
    if (!/^tt\d+$/i.test(id)) return '';

    wyzieMediaIdCache.set(normalizedTitle, { id, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
    return id;
  } catch {
    return '';
  }
}

async function searchWyzieSubtitles(request, env, params) {
  const apiKey = String(env?.WYZIE_API_KEY || '').trim();
  const mediaId = await resolveWyzieMediaId(params);
  if (!apiKey || !mediaId) return [];

  const endpoint = new URL(WYZIE_SEARCH_URL);
  endpoint.searchParams.set('id', mediaId);
  endpoint.searchParams.set('season', String(Math.max(1, parseInt(params.get('season') || '1', 10) || 1)));
  endpoint.searchParams.set('episode', String(Math.max(1, parseInt(params.get('episode') || '1', 10) || 1)));
  endpoint.searchParams.set('language', 'es');
  endpoint.searchParams.set('format', 'srt,vtt,ass');
  endpoint.searchParams.set('key', apiKey);

  try {
    const payload = await fetchSubtitleProvider(endpoint.href);
    return normalizeProviderSubtitles(payload, 'wyzie', request);
  } catch {
    return [];
  }
}

async function searchSubdlSubtitles(request, env, params) {
  const apiKey = String(env?.SUBDL_API_KEY || '').trim();
  const title = String(params.get('title') || '').trim();
  if (!apiKey || (!title && !params.get('tmdbId') && !params.get('imdbId'))) return [];

  const endpoint = new URL(SUBDL_SEARCH_URL);
  if (params.get('tmdbId')) {
    endpoint.searchParams.set('tmdb_id', String(params.get('tmdbId')));
    endpoint.searchParams.set('type', 'tv');
  } else if (params.get('imdbId')) {
    endpoint.searchParams.set('imdb_id', String(params.get('imdbId')));
  } else {
    endpoint.searchParams.set('film_name', title);
    endpoint.searchParams.set('type', 'tv');
  }
  endpoint.searchParams.set('season', String(Math.max(1, parseInt(params.get('season') || '1', 10) || 1)));
  endpoint.searchParams.set('episode', String(Math.max(1, parseInt(params.get('episode') || '1', 10) || 1)));
  endpoint.searchParams.set('languages', 'es');
  endpoint.searchParams.set('unpack', '1');

  try {
    const payload = await fetchSubtitleProvider(endpoint.href, { headers: { Authorization: `Bearer ${apiKey}` } });
    return normalizeProviderSubtitles(payload, 'subdl', request);
  } catch {
    return [];
  }
}

async function handleSubtitleSearch(request, env, params) {
  let subtitles = await searchWyzieSubtitles(request, env, params);
  let provider = 'wyzie';

  if (subtitles.length === 0) {
    subtitles = await searchSubdlSubtitles(request, env, params);
    provider = 'subdl';
  }

  // Compatibilidad temporal: solo se usa si los proveedores directos no responden.
  if (subtitles.length === 0 && env?.SUBTITLE_ALCHEMY_URL && env?.SUBTITLE_ALCHEMY_CONFIG) {
    return handleLegacySubtitleSearch(request, env, params);
  }

  if (subtitles.length === 0) {
    return jsonResponse({ error: 'No hay un proveedor de subtitulos espanoles disponible' }, 503);
  }

  return jsonResponse({ provider, subtitles, hasSpanish: true });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const params = Object.fromEntries(url.searchParams);

    // Health check
    if (path === '/' || path === '/health' || path === '/api/health') {
      return jsonResponse({
        status: 'healthy',
        service: 'Orunei Streaming Edge Engine',
        version: '2.4.0',
        timestamp: new Date().toISOString()
      });
    }

    // Endpoint: /api/news
    if (path === '/api/news') {
      try {
        const items = await fetchWorkerNews();
        const headers = corsHeaders();
        headers['Cache-Control'] = 'public, s-maxage=300, max-age=300, stale-while-revalidate=600';
        return new Response(JSON.stringify({ status: 'ok', items }), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // Anime1v queda aislado detrás de una URL y una API key configuradas en el backend.
    if (path.startsWith('/api/anime1v/')) {
      const action = path.slice('/api/anime1v/'.length);
      return handleAnime1v(request, env, action, url.searchParams);
    }

    // SubAlchemy solo aporta pistas; nunca selecciona ni aloja el video.
    if (path === '/api/subtitles/search') {
      return handleSubtitleSearch(request, env, url.searchParams);
    }

    // Endpoint: /api/stream/search
    if (path === '/api/stream/search') {
      const id = params.id;
      const title = params.title;
      if (!id && !title) return jsonResponse({ error: 'Falta parametro id o title' }, 400);

      try {
        const miruroId = await resolveMiruroId(id, title);
        if (!miruroId) return jsonResponse({ error: 'No se encontro Miruro ID' }, 404);
        return jsonResponse({ miruroId });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // Endpoint: /api/stream/resolve
    if (path === '/api/stream/resolve') {
      const id = params.id;
      const ep = parseInt(params.ep, 10) || 1;
      const anilistId = params.anilistId;
      const malId = params.malId;
      const title = params.title;
      if (!id && !anilistId) return jsonResponse({ error: 'Falta parametro id o anilistId' }, 400);

      try {
        const workerOrigin = new URL(request.url).origin;
        const playback = await resolveEpisode(id || anilistId, ep, workerOrigin, { anilistId, malId, animeTitle: title });
        return jsonResponse(playback);
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // Endpoint: /api/stream/proxy (soporta /api/stream/proxy, /api/stream/proxy/stream.m3u8, etc.)
    if (path === '/api/stream/proxy' || path.startsWith('/api/stream/proxy/') || path.startsWith('/api/stream/proxy.')) {
      try {
        return await handleProxy(params.url, params.referer, params.origin, request, env);
      } catch (err) {
        return jsonResponse({ error: err.message }, 502);
      }
    }

    return jsonResponse({ error: 'Ruta no encontrada' }, 404);
  }
};
