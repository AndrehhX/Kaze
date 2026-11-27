import { z } from "zod";
import { getRequestUser } from "@/lib/supabase/server";
import { json, limitOrNull } from "@/lib/api-response";
import { castVote } from "@/lib/support/server";

const schema = z.object({ option: z.string().max(40) });

/** Voto en la encuesta de Tormenta. */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "support-vote", 20);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Datos no válidos" }, { status: 400 });
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  const r = await castVote(user.id, parsed.data.option).catch(() => ({ ok: false as const, error: "No disponible" }));
  return r.ok ? json({ ok: true }) : json({ error: r.error }, { status: 400 });
}
