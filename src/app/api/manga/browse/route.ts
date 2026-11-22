import type { NextRequest } from "next/server";
import { browseManga } from "@/lib/anilist/manga-service";
import { parseMangaParams } from "@/lib/anilist/manga-params";
import { errorResponse, json, limitOrNull } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const limited = limitOrNull(req, "manga-browse", 90);
  if (limited) return limited;
  try {
    const params = parseMangaParams(req.nextUrl.searchParams);
    const reqPerPage = Number(req.nextUrl.searchParams.get("perPage") ?? "30");
    const perPage = Number.isInteger(reqPerPage) && reqPerPage > 0 ? Math.min(reqPerPage, 50) : 30;
    const data = await browseManga({ ...params, perPage });
    return json(data, { cache: "public, max-age=180, s-maxage=900, stale-while-revalidate=86400" });
  } catch (err) {
    return errorResponse(err);
  }
}
