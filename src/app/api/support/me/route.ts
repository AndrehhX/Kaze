import { getRequestUser } from "@/lib/supabase/server";
import { json } from "@/lib/api-response";
import { getMySupport } from "@/lib/support/server";

/** Estado de apoyo de la cuenta con sesión (nivel, vencimiento, cosméticos y voto). */
export async function GET() {
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  try {
    return json(await getMySupport(user.id), { cache: "private, no-store" });
  } catch {
    return json({ error: "No disponible" }, { status: 503 });
  }
}
