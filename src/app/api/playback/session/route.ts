import { z } from "zod";
import { createPlaybackGrant } from "@/lib/media/provider";
import { getRequestUser } from "@/lib/supabase/server";
import { json, limitOrNull } from "@/lib/api-response";

const body = z.object({
  seriesId: z.string().min(1).max(64),
  episodeId: z.string().min(1).max(64),
  preferredAudio: z.enum(["latino", "castellano", "sub"]).optional(),
});

/**
 * Issues a playback grant after an entitlement check. Metadata never implies
 * rights: only provider-confirmed entitlements return a playable asset.
 */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "playback", 60);
  if (limited) return limited;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request" }, { status: 400 });

  const { supabase, user } = await getRequestUser();
  const result = await createPlaybackGrant(
    parsed.data.seriesId,
    parsed.data.episodeId,
    user?.id ?? null,
    parsed.data.preferredAudio
  );
  if (!result.ok) return json({ error: "Playback not available", reason: result.entitlement.reason }, { status: result.status });

  if (supabase && user) {
    // Session audit trail for signed-in users (RLS: owner-only).
    const { error } = await supabase.from("playback_sessions").insert({
      id: result.grant.sessionId,
      user_id: user.id,
      provider: "demo",
      series_id: parsed.data.seriesId,
      episode_id: parsed.data.episodeId,
    });
    if (error) console.warn("[kaze] playback session insert failed", error.message);
  }
  return json({ grant: result.grant });
}
