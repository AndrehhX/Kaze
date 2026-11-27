import { anilistRequest } from "@/lib/anilist/client";
import { errorResponse, json, limitOrNull, parseId } from "@/lib/api-response";

const QUERY = /* GraphQL */ `
  query Airing($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      status
      isAdult
      nextAiringEpisode { episode airingAt }
    }
  }
`;

type Res = { Media: { id: number; status: string | null; isAdult: boolean; nextAiringEpisode: { episode: number; airingAt: number } | null } | null };

/**
 * Estado de emisión fresco de un anime (la ficha completa se guarda en caché hasta un día).
 * Lo usa la tarjeta de fin de episodio: "El EP 6 sale el jueves".
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = limitOrNull(req, "airing", 60);
  if (limited) return limited;
  const id = parseId((await ctx.params).id);
  if (!id) return json({ error: "Invalid id" }, { status: 400 });
  try {
    const d = await anilistRequest<Res>(QUERY, { id }, { persist: false });
    const m = d.Media;
    if (!m || m.isAdult) return json({ error: "Not found" }, { status: 404 });
    return json({ status: m.status, next: m.nextAiringEpisode }, { cache: "public, max-age=300, s-maxage=900, stale-while-revalidate=3600" });
  } catch (err) {
    return errorResponse(err);
  }
}
