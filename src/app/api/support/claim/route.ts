import { z } from "zod";
import { getRequestUser } from "@/lib/supabase/server";
import { json, limitOrNull } from "@/lib/api-response";
import { claimPayment } from "@/lib/support/server";

const schema = z.object({ transactionId: z.string().trim().min(6).max(80), email: z.string().trim().email().max(320) });

/** Vincula a tu cuenta un pago de Ko-fi hecho con otro correo (con el código del recibo de Ko-fi). */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "support-claim", 8);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Revisa el código y el correo." }, { status: 400 });
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  const r = await claimPayment(user.id, parsed.data.transactionId, parsed.data.email).catch(() => ({ ok: false as const, error: "No disponible" }));
  return r.ok ? json({ ok: true }) : json({ error: r.error }, { status: 400 });
}
