import { z } from "zod";
import { getRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";
import { json, limitOrNull } from "@/lib/api-response";

const schema = z.object({ confirm: z.literal("DELETE") });

/**
 * Permanently deletes the signed-in user's account. All user-owned rows cascade
 * from auth.users. The UI requires typing DELETE.
 */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "account-delete", 3, 10 * 60_000);
  if (limited) return limited;
  if (!schema.safeParse(await req.json().catch(() => null)).success) return json({ error: "Confirmation required" }, { status: 400 });
  const { supabase, user } = await getRequestUser();
  if (!supabase || !user) return json({ error: "Not signed in" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return json({ error: "Deletion failed. Please try again." }, { status: 500 });
    return json({ ok: true, removed: "account" });
  }
  // Without a service role the login record cannot be removed; wipe all profile data instead.
  const { error } = await supabase.rpc("delete_my_data");
  if (error) return json({ error: "Deletion failed." }, { status: 500 });
  await supabase.auth.signOut();
  return json({ ok: true, removed: "data", note: "Your data was deleted. The login record will be purged by an administrator." });
}
