import type { NextRequest } from "next/server";
import { getMangaBatch } from "@/lib/anilist/manga-service";
import { errorResponse, json, limitOrNull } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const limited = limitOrNull(req, "manga-batch", 40);
  if (limited) return limited;
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);
  if (!ids.length) return json({ media: [] });
  try {
    const media = await getMangaBatch([...new Set(ids)].sort((a, b) => a - b));
    return json({ media }, { cache: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" });
  } catch (err) {
    return errorResponse(err);
  }
}
