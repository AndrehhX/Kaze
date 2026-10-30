import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ANILIST_AUTHORIZE, oauthConfig, STATE_COOKIE } from "@/lib/anilist/oauth";
import { getRequestUser } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const cfg = oauthConfig();
  const back = new URL("/settings/integrations", req.nextUrl.origin);
  if (!cfg) {
    back.searchParams.set("anilist", "unconfigured");
    return NextResponse.redirect(back);
  }
  const { user } = await getRequestUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/settings/integrations", req.nextUrl.origin));

  // CSRF protection: random state bound to this browser and this user.
  const state = randomBytes(24).toString("base64url");
  const url = new URL(ANILIST_AUTHORIZE);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, `${state}.${user.id}`, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/integrations/anilist", maxAge: 600 });
  return res;
}
