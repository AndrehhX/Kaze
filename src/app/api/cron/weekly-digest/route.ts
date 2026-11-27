import { timingSafeEqual } from "node:crypto";
import { connection, NextResponse, type NextRequest } from "next/server";
import { runWeeklyDigest } from "@/lib/weekly-digest";

/**
 * Cron del resumen semanal por correo. Solo con la cabecera `x-cron-secret` = CRON_SECRET
 * (lo llama el cron de la VPS los domingos, por 127.0.0.1).
 * ?dryRun=1 calcula a quién se enviaría sin mandar nada. ?user=<uuid> limita a una cuenta (pruebas).
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
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const onlyUserId = req.nextUrl.searchParams.get("user") ?? undefined;
  const result = await runWeeklyDigest({ dryRun, onlyUserId });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
