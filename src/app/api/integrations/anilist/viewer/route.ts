import { anilistRequest } from "@/lib/anilist/client";
import { VIEWER_FAVOURITES_QUERY, VIEWER_QUERY } from "@/lib/anilist/queries";
import type { AniListViewer, MediaCard } from "@/lib/anilist/types";
import { getAniListToken } from "@/lib/anilist/oauth";
import { getRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, json, limitOrNull } from "@/lib/api-response";

type Favs = { favourites: { anime: { nodes: MediaCard[] }; characters: { nodes: { id: number; name: { full: string; native: string | null }; image: { large: string | null } }[] } } };

/** Profile, statistics and favourites of the connected AniList account. */
export async function GET(req: Request) {
  const limited = limitOrNull(req, "anilist-viewer", 10);
  if (limited) return limited;
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  const conn = await getAniListToken(user.id);
  if (!conn) return json({ error: "AniList is not connected" }, { status: 409 });
  try {
    const [v, f] = await Promise.all([
      anilistRequest<{ Viewer: AniListViewer }>(VIEWER_QUERY, {}, { token: conn.token }),
      anilistRequest<{ Viewer: Favs }>(VIEWER_FAVOURITES_QUERY, {}, { token: conn.token }),
    ]);
    return json({ viewer: v.Viewer, favourites: f.Viewer.favourites });
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      await getSupabaseAdmin()?.from("connected_accounts").update({ last_sync_status: "error", last_sync_message: "AniList rejected the token. Reconnect." }).eq("id", conn.accountId);
    }
    return errorResponse(err);
  }
}
