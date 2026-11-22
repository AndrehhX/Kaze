import { timingSafeEqual } from "node:crypto";
import { connection, NextResponse, type NextRequest } from "next/server";
import { runEpisodeAlerts } from "@/lib/episode-alerts";

/**
 * Cron de avisos de episodios nuevos. Solo responde con la cabecera `x-cron-secret`
 * igual a CRON_SECRET (lo llama el cron de la VPS por 127.0.0.1, nunca desde fuera).
 */
function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("x-cron-secret");
  if (!secret || !got) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  await connection();
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const minutes = Number(req.nextUrl.searchParams.get("window") ?? "75");
  // ?dryRun=1: calcula a quién se avisaría, sin escribir notificaciones ni publicar en Discord.
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const result = await runEpisodeAlerts({ windowMinutes: Number.isFinite(minutes) ? Math.min(Math.max(minutes, 5), 24 * 60) : 75, dryRun });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
