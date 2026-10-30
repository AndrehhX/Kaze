import type { NextRequest } from "next/server";
import { browseMedia } from "@/lib/anilist/service";
import { parseBrowseParams } from "@/lib/anilist/browse-params";
import { errorResponse, json, limitOrNull } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const limited = limitOrNull(req, "browse", 90);
  if (limited) return limited;
  try {
    const params = parseBrowseParams(req.nextUrl.searchParams);
    const data = await browseMedia({ ...params, perPage: 30 });
    return json(data, { cache: "public, max-age=180, s-maxage=900, stale-while-revalidate=86400" });
  } catch (err) {
    return errorResponse(err);
  }
}
