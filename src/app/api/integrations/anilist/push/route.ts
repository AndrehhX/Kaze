import { z } from "zod";
import { anilistRequest } from "@/lib/anilist/client";
import { SAVE_LIST_ENTRY_MUTATION } from "@/lib/anilist/queries";
import { getAniListToken } from "@/lib/anilist/oauth";
import { isoToFuzzy } from "@/lib/library/sync";
import { getRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";
import { json, limitOrNull } from "@/lib/api-response";

const schema = z.object({
  entries: z
    .array(
      z.object({
        mediaId: z.number().int().positive(),
        status: z.enum(["CURRENT", "PLANNING", "COMPLETED", "DROPPED", "PAUSED", "REPEATING"]),
        progress: z.number().int().min(0).max(10000),
        score: z.number().int().min(0).max(100).nullable(),
        notes: z.string().max(4000),
        startedAt: z.string().nullable(),
        completedAt: z.string().nullable(),
      }),
    )
    .max(25),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pushes up to 25 list changes per call, paced to stay inside AniList's rate limit. */
export async function POST(req: Request) {
  const limited = limitOrNull(req, "anilist-push", 10);
  if (limited) return limited;
  const { user } = await getRequestUser();
  if (!user) return json({ error: "Not signed in" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid payload" }, { status: 400 });
  const conn = await getAniListToken(user.id);
  if (!conn) return json({ error: "AniList is not connected" }, { status: 409 });

  const results: { mediaId: number; ok: boolean; error?: string }[] = [];
  for (const e of parsed.data.entries) {
    try {
      await anilistRequest(
        SAVE_LIST_ENTRY_MUTATION,
        { mediaId: e.mediaId, status: e.status, progress: e.progress, scoreRaw: e.score ?? 0, notes: e.notes || null, startedAt: isoToFuzzy(e.startedAt), completedAt: isoToFuzzy(e.completedAt) },
        { token: conn.token },
      );
      results.push({ mediaId: e.mediaId, ok: true });
    } catch (err) {
      results.push({ mediaId: e.mediaId, ok: false, error: (err as Error).message });
      if ((err as { status?: number }).status === 429) break;
    }
    await sleep(700);
  }
  const failed = results.filter((r) => !r.ok).length;
  await getSupabaseAdmin()
    ?.from("connected_accounts")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: failed ? (failed === results.length ? "error" : "partial") : "ok",
      last_sync_message: failed ? `${failed} change(s) failed` : null,
    })
    .eq("id", conn.accountId);
  return json({ results, pushed: results.length - failed, failed, remaining: parsed.data.entries.length - results.length });
}
