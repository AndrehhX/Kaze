import "server-only";
import { getServerEnv, isAniListOAuthConfigured, publicEnv, siteUrl } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";

/** AniList OAuth 2.0 authorization-code grant (https://docs.anilist.co/guide/auth/authorization-code). */
export const ANILIST_AUTHORIZE = "https://anilist.co/api/v2/oauth/authorize";
export const ANILIST_TOKEN = "https://anilist.co/api/v2/oauth/token";
export const STATE_COOKIE = "kaze_anilist_state";

export function redirectUri() {
  return `${siteUrl}/api/integrations/anilist/callback`;
}

export function oauthConfig() {
  if (!isAniListOAuthConfigured()) return null;
  return { clientId: publicEnv.NEXT_PUBLIC_ANILIST_CLIENT_ID!, clientSecret: getServerEnv().ANILIST_CLIENT_SECRET!, redirectUri: redirectUri() };
}

export async function exchangeCode(code: string) {
  const cfg = oauthConfig();
  if (!cfg) throw new Error("AniList OAuth is not configured");
  const res = await fetch(ANILIST_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ grant_type: "authorization_code", client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, code }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !body?.access_token) throw new Error(`AniList token exchange failed (${res.status})`);
  return { accessToken: body.access_token, expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null };
}

/** Loads and decrypts the caller's AniList token. Service-role read; never returned to the client. */
export async function getAniListToken(userId: string): Promise<{ token: string; accountId: string; externalUserId: string } | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data: acct } = await admin.from("connected_accounts").select("id, external_user_id").eq("user_id", userId).eq("provider", "anilist").maybeSingle();
  if (!acct) return null;
  const { data: secret } = await admin.from("connected_account_secrets").select("encrypted_token, token_expires_at").eq("account_id", acct.id).maybeSingle();
  if (!secret) return null;
  if (secret.token_expires_at && new Date(secret.token_expires_at).getTime() < Date.now()) return null;
  try {
    return { token: decryptSecret(secret.encrypted_token), accountId: acct.id, externalUserId: acct.external_user_id };
  } catch {
    return null;
  }
}
