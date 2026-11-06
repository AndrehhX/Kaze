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

  if (!targetUrl) {
    return Response.json({ error: 'Falta parametro url' }, { status: 400 });
  }

  // Delegar todo el tráfico de video y manifiestos al Cloudflare Worker
  // (ancho de banda gratuito ilimitado) para eliminar a 0 el Fast Origin Transfer en Vercel.
  const workerProxy = 'https://orunei-stream.thealex230820.workers.dev/api/stream/proxy';
  return Response.redirect(`${workerProxy}?${searchParams.toString()}`, 307);
}
