import { getCharacter } from "@/lib/anilist/service";
import { errorResponse, json, limitOrNull, parseId } from "@/lib/api-response";

export async function GET(req: Request, ctx: RouteContext<"/api/anilist/character/[id]">) {
  const limited = limitOrNull(req, "character", 60);
  if (limited) return limited;
  const id = parseId((await ctx.params).id);
  if (!id) return json({ error: "Invalid id" }, { status: 400 });
  try {
    const character = await getCharacter(id);
    if (!character) return json({ error: "Not found" }, { status: 404 });
    return json({ character }, { cache: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" });
  } catch (err) {
    return errorResponse(err);
  }
}
