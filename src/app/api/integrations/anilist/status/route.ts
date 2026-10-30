import { connection } from "next/server";
import { isAniListOAuthConfigured } from "@/lib/env";
import { getRequestUser } from "@/lib/supabase/server";
import { json } from "@/lib/api-response";

/** Whether AniList OAuth is configured on this deployment, and the caller's connection (RLS read). */
export async function GET() {
  await connection();
  const configured = isAniListOAuthConfigured();
  const { supabase, user } = await getRequestUser();
  if (!supabase || !user) return json({ configured, account: null });
  const { data } = await supabase
    .from("connected_accounts")
    .select("external_username, external_avatar_url, connected_at, last_synced_at, last_sync_status, last_sync_message")
    .eq("user_id", user.id)
    .eq("provider", "anilist")
    .maybeSingle();
  return json({ configured, account: data ?? null });
}
