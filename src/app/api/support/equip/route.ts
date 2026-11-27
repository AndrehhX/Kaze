import { z } from "zod";
import { getRequestUser } from "@/lib/supabase/server";
import { json, limitOrNull } from "@/lib/api-response";
import { saveEquipped } from "@/lib/support/server";

const slot = z.string().max(40).optional();
const schema = z.object({
  equipped: z.object({ nameColor: slot, nameGradient: slot, avatarFrame: slot, commentFrame: slot, profileEffect: slot }),
  showOnWall: z.boolean().optional(),
});

/** Guarda los cosméticos de apoyo (el servidor comprueba que el nivel los permite). */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "support-equip", 30);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Datos no válidos" }, { status: 400 });
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  const r = await saveEquipped(user.id, parsed.data.equipped, parsed.data.showOnWall).catch(() => ({ ok: false as const, error: "No disponible" }));
  return r.ok ? json({ ok: true }) : json({ error: r.error }, { status: 400 });
}
