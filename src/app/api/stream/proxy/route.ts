import { isAuthorizedCdnUrl, rewriteM3U8, normalizeSubtitleToVtt } from '@/lib/media/stream-policy';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Origin, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');
  let referer = searchParams.get('referer') || '';
  let origin = searchParams.get('origin') || '';

  if (!targetUrl) {
    return Response.json({ error: 'Falta parametro url' }, { status: 400 });
  }

  if (!isAuthorizedCdnUrl(targetUrl)) {
    return Response.json(
      { error: 'Destino no autorizado por la política de seguridad del proxy (SSRF Protection)' },
      { status: 403 }
    );
  }

  if (!referer && targetUrl.includes('anixo.buzz')) {
    referer = 'https://www.miruro.to/';
    if (!origin) origin = 'https://www.miruro.to';
  } else if (!referer && (targetUrl.includes('megavid.buzz') || targetUrl.includes('megavid.se'))) {
    referer = 'https://megavid.buzz/';
    if (!origin) origin = 'https://megavid.buzz';
  } else if (targetUrl.includes('zilla-networks.com')) {
    if (!referer) {
      const match = targetUrl.match(/\/(?:m3u8|segs)\/([a-zA-Z0-9]+)/);
      referer = match?.[1] ? `https://player.zilla-networks.com/play/${match[1]}` : 'https://player.zilla-networks.com/';
    }
    origin = 'https://player.zilla-networks.com';
  }

  const upstreamHeaders: HeadersInit = {
    'User-Agent': targetUrl.includes('zilla-networks.com')
      ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
      : USER_AGENT,
  };

  if (referer) upstreamHeaders['Referer'] = referer;
  if (origin) upstreamHeaders['Origin'] = origin;

  if (targetUrl.includes('zilla-networks.com')) {
    upstreamHeaders['Sec-Fetch-Dest'] = 'empty';
    upstreamHeaders['Sec-Fetch-Mode'] = 'cors';
    upstreamHeaders['Sec-Fetch-Site'] = 'same-origin';
  }

  const range = req.headers.get('range');
  if (range) {
    upstreamHeaders['Range'] = range;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const upstreamResp = await fetch(targetUrl, {
      method: 'GET',
      headers: upstreamHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!upstreamResp.ok && upstreamResp.status !== 206) {
      return Response.json(
        { error: `Error del CDN proveedor: HTTP ${upstreamResp.status} ${upstreamResp.statusText}` },
        { status: upstreamResp.status }
      );
    }

    const contentType = upstreamResp.headers.get('content-type') || '';
    const isM3U8 =
      (contentType.includes('mpegurl') || contentType.includes('x-mpegURL') || targetUrl.includes('.m3u8')) &&
      !contentType.includes('mp2t') &&
      !contentType.includes('video/');

    const isSubtitle =
      targetUrl.includes('.vtt') ||
      targetUrl.includes('.srt') ||
      targetUrl.includes('.ass') ||
      contentType.includes('vtt') ||
      (targetUrl.endsWith('.jpeg') && targetUrl.includes('/a/'));

    const responseHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Origin, Content-Type, Accept',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      'Accept-Ranges': 'bytes',
      'Cache-Control': upstreamResp.status === 206 ? 'no-cache, no-store, must-revalidate' : 'no-cache',
    });

    if (upstreamResp.status === 206) {
      const cr = upstreamResp.headers.get('content-range');
      if (cr) responseHeaders.set('Content-Range', cr);
    }

    // 1. Manifiesto HLS M3U8
    if (isM3U8) {
      const rawText = await upstreamResp.text();
      const rewritten = rewriteM3U8(rawText, targetUrl, referer, origin);
      responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      return new Response(rewritten, {
        status: upstreamResp.status,
        headers: responseHeaders,
      });
    }

    // 2. Subtítulos WebVTT normalizados
    if (isSubtitle) {
      const rawSub = await upstreamResp.text();
      const vtt = normalizeSubtitleToVtt(rawSub, targetUrl);
      responseHeaders.set('Content-Type', 'text/vtt; charset=utf-8');
      return new Response(vtt, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // 3. Segmentos de video binario (TS / MP4 / fMP4)
    if (
      targetUrl.includes('.mp4') ||
      targetUrl.includes('.html') ||
      targetUrl.includes('/segs/') ||
      contentType.includes('mp4') ||
      contentType.includes('octet-stream')
    ) {
      responseHeaders.set('Content-Type', 'video/mp4');
    } else if (targetUrl.includes('.ts') || contentType.includes('mp2t')) {
      responseHeaders.set('Content-Type', 'video/mp2t');
    } else if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    }
    const cl = upstreamResp.headers.get('content-length');
    if (cl) responseHeaders.set('Content-Length', cl);

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido de proxy';
    return Response.json({ error: `Proxy fetch failed: ${errorMsg}` }, { status: 502 });
  }
}
