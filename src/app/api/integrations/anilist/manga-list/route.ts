import { anilistRequest } from "@/lib/anilist/client";
import { VIEWER_MANGA_LIST_QUERY } from "@/lib/anilist/manga-queries";
import type { AniListMangaListEntry } from "@/lib/anilist/manga-types";
import { getAniListToken } from "@/lib/anilist/oauth";
import { getRequestUser } from "@/lib/supabase/server";
import { errorResponse, json, limitOrNull } from "@/lib/api-response";

/** The connected user's AniList MANGA list (read-only). The token never leaves the server. */
export async function GET(req: Request) {
  const limited = limitOrNull(req, "anilist-manga-list", 6);
  if (limited) return limited;
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  const conn = await getAniListToken(user.id);
  if (!conn) return json({ error: "AniList is not connected, or the token expired" }, { status: 409 });
  try {
    const d = await anilistRequest<{ MediaListCollection: { lists: { entries: AniListMangaListEntry[] }[] } }>(VIEWER_MANGA_LIST_QUERY, { userId: Number(conn.externalUserId) }, { token: conn.token });
    const seen = new Set<number>();
    const entries = d.MediaListCollection.lists.flatMap((l) => l.entries).filter((e) => !e.media.isAdult && !seen.has(e.mediaId) && seen.add(e.mediaId));
    return json({ entries });
  } catch (err) {
    return errorResponse(err);
  }
}
