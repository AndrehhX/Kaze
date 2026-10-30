import { getMediaDetail } from "@/lib/anilist/service";
import { errorResponse, json, limitOrNull, parseId } from "@/lib/api-response";

export async function GET(req: Request, ctx: RouteContext<"/api/anilist/media/[id]">) {
  const limited = limitOrNull(req, "media", 90);
  if (limited) return limited;
  const id = parseId((await ctx.params).id);
  if (!id) return json({ error: "Invalid id" }, { status: 400 });
  try {
    const media = await getMediaDetail(id);
    if (!media || media.isAdult) return json({ error: "Not found" }, { status: 404 });
    return json({ media }, { cache: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" });
  } catch (err) {
    return errorResponse(err);
  }
}
