'use strict';
/**
 * Proxy de trozos de video (segmentos HLS) en la VPS.
 *
 * El Worker de Cloudflare (orunei-stream) reescribe cada playlist .m3u8 y manda la mitad de los
 * segmentos aquí para no gastar su límite diario de peticiones. Cada enlace va firmado por el
 * Worker (HMAC del host de origen + caducidad) con SEGMENT_SIGNING_KEY, así este endpoint no es
 * un proxy abierto. La lista de servidores permitidos y las cabeceras por servidor son las mismas
 * que usa el Worker (orunei-stream-worker.js → handleProxy).
 *
 * Se instala en /opt/kaze-resolver/segment-proxy.js y lo usa server.js en /api/stream/seg.
 */
const crypto = require('crypto');
const { Readable } = require('stream');

const SECRET = process.env.SEGMENT_SIGNING_KEY || '';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ALLOWED_CDN_DOMAINS = [
  'keeply.top', 'ultracloud.cc', 'megaplay.buzz', 'miruro.tv', 'miruro.to', 'bunnycdn.com', 'rabbitstream.net',
  'dokicloud.one', 'mcloud.to', 'vizcloud.online', 'rapid-cloud.co', 'animeav1.com', 'yourupload.com', 'vidcache.net',
  'mp4upload.com', 'streamtape.com', 'voe.sx', 'tioanime.com', 'vgfplay.com', 'mixdrop.bz', 'mixdroop.bz',
  'derricknationtop.com', 'latanime.org', 'monoschinos2.com', 'monoschinos2.net', 'monoschinos.st', 'streamwish.to',
  'streamwish.com', 'filemoon.sx', 'filemoon.to', 'filemoon.in', 'luluvdo.com', 'doodstream.com', 'streamhide.to',
  'broforgotsave.online', 'nexabloom.top', 'shiora.top', 'wintergrove.space', 'uwucdn.top', 'kwik.cx', 'echovideo',
  'roburnt10.store', 'zilla-networks.com', 'uns.bio', 'animeflv.net', 'www3.animeflv.net', 'jkanime.net',
  'playmudos.com', 'ducvomes.com', 'jkdesa.com', 'mega.nz', 'ok.ru', 'okcdn.ru', 'odnoklassniki.ru', 'anixo.buzz',
  'megavid.buzz', 'cp.megavid.buzz', 'cdn.megavid.buzz', 'megavid.se', 'commondatastorage.googleapis.com',
  'test-streams.mux.dev',
];

function isAllowed(parsed) {
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const h = parsed.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '::1') return false;
  return ALLOWED_CDN_DOMAINS.some((d) => h === d || h.endsWith('.' + d));
}

/** Firma = HMAC-SHA256(secret, "<host>|<exp>") en base64url, 32 caracteres (igual que el Worker). */
function validSignature(host, exp, sig) {
  if (!SECRET || !sig || !/^\d{9,11}$/.test(exp || '')) return false;
  if (Number(exp) * 1000 < Date.now()) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(`${host}|${exp}`).digest('base64url').slice(0, 32);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** Mismas reglas de Referer/Origin por servidor que el Worker. */
function upstreamHeaders(url, referer, origin) {
  let ref = referer || '';
  let org = origin || '';
  if (!ref) {
    if (url.includes('anixo.buzz')) { ref = 'https://www.miruro.to/'; org ||= 'https://www.miruro.to'; }
    else if (url.includes('keeply.top') || url.includes('ultracloud.cc')) { ref = 'https://ultracloud.cc/'; org ||= 'https://ultracloud.cc'; }
    else if (/broforgotsave\.online|nexabloom\.top|shiora\.top|wintergrove\.space|megaplay\.buzz/.test(url)) ref = 'https://megaplay.buzz/';
    else if (url.includes('uwucdn.top') || url.includes('kwik.cx')) ref = 'https://kwik.cx/';
    else if (url.includes('echovideo') || url.includes('roburnt10.store')) ref = 'https://play.echovideo.ru/';
    else if (url.includes('zilla-networks.com')) {
      const m = url.match(/\/(?:m3u8|segs)\/([a-zA-Z0-9]+)/);
      ref = m ? `https://player.zilla-networks.com/play/${m[1]}` : 'https://player.zilla-networks.com/';
      org ||= 'https://player.zilla-networks.com';
    } else if (/ok\.ru|okcdn\.ru|odnoklassniki\.ru/.test(url)) { ref = 'https://ok.ru/'; org ||= 'https://ok.ru'; }
  }
  const isZilla = url.includes('zilla-networks.com');
  const h = { 'User-Agent': isZilla ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0' : USER_AGENT };
  if (ref) h.Referer = ref;
  if (org) h.Origin = org;
  if (isZilla) Object.assign(h, { 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-origin' });
  return h;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
}

function fail(res, status, message) {
  if (res.headersSent) return res.destroy();
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: message }));
}

async function handleSegment(req, res, reqUrl) {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Método no permitido');

  const target = reqUrl.searchParams.get('url') || '';
  let parsed;
  try { parsed = new URL(target); } catch { return fail(res, 400, 'URL inválida'); }
  if (!isAllowed(parsed)) return fail(res, 403, 'Destino no autorizado');
  if (!validSignature(parsed.host, reqUrl.searchParams.get('exp'), reqUrl.searchParams.get('sig'))) return fail(res, 403, 'Firma inválida o caducada');

  const headers = upstreamHeaders(target, reqUrl.searchParams.get('referer'), reqUrl.searchParams.get('origin'));
  if (req.headers.range) headers.Range = req.headers.range;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  req.on('close', () => controller.abort()); // el espectador cerró o saltó: no seguir descargando

  let upstream;
  try {
    upstream = await fetch(target, { method: req.method, headers, signal: controller.signal, redirect: 'follow' });
  } catch (err) {
    clearTimeout(timer);
    return fail(res, 504, `CDN timeout o error: ${err.message}`);
  }
  clearTimeout(timer);
  if (!upstream.ok && upstream.status !== 206) return fail(res, upstream.status, `CDN error: HTTP ${upstream.status}`);

  const ct = upstream.headers.get('content-type') || '';
  const out = { 'Accept-Ranges': 'bytes' };
  const cr = upstream.headers.get('content-range');
  if (upstream.status === 206 && cr) out['Content-Range'] = cr;

  // Segmentos disfrazados de imagen (/a/*.jpg): pueden ser WebVTT o video TS.
  if (target.includes('/a/') && /\.(jpe?g|png)$/i.test(parsed.pathname)) {
    const buf = Buffer.from(await upstream.arrayBuffer());
    const isVtt = buf.length >= 3 && buf[0] === 0x57 && buf[1] === 0x45 && buf[2] === 0x42; // "WEB"
    res.writeHead(upstream.status, { ...out, 'Content-Type': isVtt ? 'text/vtt; charset=utf-8' : 'video/mp2t', 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=86400, immutable' });
    return res.end(req.method === 'HEAD' ? undefined : buf);
  }

  const isChunk = /\.(ts|m4s|mp4|png|jpe?g|html)(?:$|\?)/i.test(target) || target.includes('/segs/');
  const type = isChunk ? (/\.mp4|\/segs\/|\.html/i.test(target) ? 'video/mp4' : 'video/mp2t') : (ct || 'application/octet-stream');
  out['Content-Type'] = type;
  out['Cache-Control'] = upstream.status === 206 ? 'no-cache, no-store, must-revalidate' : isChunk ? 'public, max-age=86400, immutable' : 'no-cache';
  const cl = upstream.headers.get('content-length');
  if (cl) out['Content-Length'] = cl;
  res.writeHead(upstream.status, out);
  if (req.method === 'HEAD' || !upstream.body) return res.end();
  Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res);
}

module.exports = { handleSegment };
