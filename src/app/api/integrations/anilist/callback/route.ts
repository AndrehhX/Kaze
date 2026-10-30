import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, STATE_COOKIE } from "@/lib/anilist/oauth";
import { anilistRequest } from "@/lib/anilist/client";
import { encryptSecret } from "@/lib/crypto";
import { getRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  const back = new URL("/settings/integrations", req.nextUrl.origin);
  const finish = (result: string) => {
    back.searchParams.set("anilist", result);
    const res = NextResponse.redirect(back);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/integrations/anilist" });
    return res;
  };
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const [expectedState, expectedUser] = (req.cookies.get(STATE_COOKIE)?.value ?? "").split(".");
  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) return finish("state");

  const { user } = await getRequestUser();
  if (!user || user.id !== expectedUser) return finish("session");
  const admin = getSupabaseAdmin();
  if (!admin) return finish("unconfigured");

  try {
    const { accessToken, expiresAt } = await exchangeCode(code);
    const viewer = await anilistRequest<{ Viewer: { id: number; name: string; avatar: { large: string | null } } }>(`query { Viewer { id name avatar { large } } }`, {}, { token: accessToken });
    const { data: acct, error } = await admin
      .from("connected_accounts")
      .upsert(
        {
          user_id: user.id,
          provider: "anilist",
          external_user_id: String(viewer.Viewer.id),
          external_username: viewer.Viewer.name,
          external_avatar_url: viewer.Viewer.avatar.large,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      )
      .select("id")
      .single();
    if (error || !acct) return finish(/external_user_id/.test(error?.message ?? "") ? "in-use" : "save");
    const { error: sErr } = await admin
      .from("connected_account_secrets")
      .upsert({ account_id: acct.id, encrypted_token: encryptSecret(accessToken), token_expires_at: expiresAt?.toISOString() ?? null, updated_at: new Date().toISOString() });
    if (sErr) return finish("save");
  } catch (err) {
    // Never log the token or code; the message carries only status information.
    console.warn("[kaze] AniList connect failed:", (err as Error).message);
    return finish("exchange");
  }
  return finish("connected");
}
