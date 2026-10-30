import { getRecommendationsFor } from "@/lib/anilist/service";
import { errorResponse, json, limitOrNull, parseId } from "@/lib/api-response";

export async function GET(req: Request, ctx: RouteContext<"/api/anilist/recommendations/[id]">) {
  const limited = limitOrNull(req, "recs", 60);
  if (limited) return limited;
  const id = parseId((await ctx.params).id);
  if (!id) return json({ error: "Invalid id" }, { status: 400 });
  try {
    const m = await getRecommendationsFor(id);
    if (!m) return json({ source: null, items: [], relations: [] });
    const items = m.recommendations.nodes
      .filter((n) => n.mediaRecommendation && !n.mediaRecommendation.isAdult && n.rating > 0)
      .map((n) => ({ rating: n.rating, media: n.mediaRecommendation! }));
    const relations = m.relations.edges.filter((e) => e.node.type === "ANIME" && !e.node.isAdult);
    return json({ source: { id: m.id, title: m.title, genres: m.genres, coverImage: m.coverImage }, items, relations }, { cache: "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" });
  } catch (err) {
    return errorResponse(err);
  }
}
