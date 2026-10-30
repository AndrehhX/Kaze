import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";

/**
 * Supabase Auth return URL: email verification, password recovery and magic links.
 * Supports both PKCE (`code`) and token-hash email templates. Redirects only to
 * same-origin relative paths.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeRedirectPath(url.searchParams.get("next"), "/");
  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.redirect(new URL("/login?error=unconfigured", url.origin));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let error: { message: string } | null = null;
  if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else if (tokenHash && type) ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  else error = { message: "missing code" };

  if (error) {
    const dest = new URL("/login", url.origin);
    dest.searchParams.set("error", "link");
    return NextResponse.redirect(dest);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
