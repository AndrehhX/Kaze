import { getRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";
import { json } from "@/lib/api-response";

/**
 * Removes the connection and its encrypted token (cascade). AniList offers no
 * token-revocation endpoint, so the UI also links to AniList's app settings.
 */
export async function POST() {
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return json({ error: "Not configured" }, { status: 503 });
  const { error } = await admin.from("connected_accounts").delete().eq("user_id", user.id).eq("provider", "anilist");
  if (error) return json({ error: "Could not disconnect" }, { status: 500 });
  return json({ ok: true });
}
