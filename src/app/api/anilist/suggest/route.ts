import type { NextRequest } from "next/server";
import { suggestMedia } from "@/lib/anilist/service";
import { errorResponse, json, limitOrNull } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const limited = limitOrNull(req, "suggest", 120);
  if (limited) return limited;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return json({ results: [] });
  try {
    const results = await suggestMedia(q.toLowerCase());
    return json({ results }, { cache: "public, max-age=180, s-maxage=1800, stale-while-revalidate=86400" });
  } catch (err) {
    return errorResponse(err);
  }
}
