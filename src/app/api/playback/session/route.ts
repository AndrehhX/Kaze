import type { NextRequest } from "next/server";
import { z } from "zod";
import { createPlaybackGrant } from "@/lib/media/provider";
import { json, limitOrNull } from "@/lib/api-response";

export const maxDuration = 15;

const querySchema = z.object({
  seriesId: z.string().min(1).max(64),
  episodeId: z.string().min(1).max(64),
  preferredAudio: z.enum(["latino", "castellano", "sub"]).optional(),
  preferredServer: z.enum(["fast", "clean"]).optional(),
  codecPreference: z.enum(["av1", "h264"]).optional(),
});

const GRANT_CDN_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

async function issueGrant(parsedData: z.infer<typeof querySchema>, cacheOk?: string) {
  const result = await createPlaybackGrant(
    parsedData.seriesId,
    parsedData.episodeId,
    null,
    parsedData.preferredAudio,
    parsedData.preferredServer,
    parsedData.codecPreference,
  );
  if (!result.ok) {
    return json({ error: "Playback not available", reason: result.entitlement.reason }, { status: result.status, cache: "no-store" });
  }
  return json({ grant: result.grant }, { cache: cacheOk ?? "no-store" });
}

/**
 * Cacheable playback grant lookup used by the web player so Vercel CDN absorbs
 * repeat episode loads with zero Serverless/Fluid CPU.
 */
export async function GET(req: NextRequest) {
  const limited = limitOrNull(req, "playback", 60);
  if (limited) return limited;
  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    seriesId: sp.get("seriesId") ?? undefined,
    episodeId: sp.get("episodeId") ?? undefined,
    preferredAudio: sp.get("preferredAudio") || undefined,
    preferredServer: sp.get("preferredServer") || undefined,
    codecPreference: sp.get("codecPreference") || undefined,
  });
  if (!parsed.success) return json({ error: "Invalid request" }, { status: 400 });
  return issueGrant(parsed.data, GRANT_CDN_CACHE);
}

/**
 * POST endpoint preserved for KAZE Android mobile clients while still reusing
 * cached server stream resolution.
 */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "playback", 60);
  if (limited) return limited;
  const parsed = querySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request" }, { status: 400 });
  return issueGrant(parsed.data);
}
