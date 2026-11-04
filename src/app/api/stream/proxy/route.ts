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
  // Redirige todo tráfico de streaming al Cloudflare Worker con 0 bytes de Fast Origin Transfer en Vercel
  const workerBase = 'https://orunei-stream.thealex230820.workers.dev/api/stream/proxy';
  return Response.redirect(`${workerBase}?${searchParams.toString()}`, 307);
}
