import { connection } from "next/server";
import { json } from "@/lib/api-response";
import { supportStats } from "@/lib/support/server";
import { MONTHLY_GOAL, FOUNDER_LIMIT, CURRENT_POLL } from "@/lib/support/tiers";

/** Datos públicos de /apoyar (meta del mes, recaudado, muro y encuesta). Caché corta en Cloudflare. */
export async function GET() {
  await connection();
  try {
    return json(await supportStats(), { cache: "public, max-age=60, s-maxage=120" });
  } catch {
    return json({ goal: MONTHLY_GOAL, raised: 0, activeCount: 0, foundersLeft: FOUNDER_LIMIT, wall: [], poll: { id: CURRENT_POLL.id, tally: {} } }, { cache: "public, max-age=30" });
  }
}
