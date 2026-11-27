import { z } from "zod";
import { getRequestUser } from "@/lib/supabase/server";
import { json, limitOrNull } from "@/lib/api-response";
import { isDigestEnabled, setDigestEnabled } from "@/lib/weekly-digest";

/** Estado del resumen semanal por correo de la cuenta con sesión. */
export async function GET() {
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  return json({ enabled: await isDigestEnabled(user.id) }, { cache: "private, no-store" });
}

const schema = z.object({ enabled: z.boolean() });

export async function POST(req: Request) {
  const limited = limitOrNull(req, "digest", 20);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid body" }, { status: 400 });
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  try {
    await setDigestEnabled(user.id, parsed.data.enabled);
    return json({ enabled: parsed.data.enabled });
  } catch {
    return json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
