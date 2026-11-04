import { z } from "zod";

/**
 * Environment validation. Every integration is optional so the public catalog
 * works out of the box; features that need a service report "not configured"
 * instead of failing silently.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_ANILIST_CLIENT_ID: z.string().regex(/^\d+$/).optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ANILIST_CLIENT_SECRET: z.string().min(10).optional(),
  /** 32-byte key, base64 encoded. Encrypts AniList tokens at rest. */
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((v) => {
      try {
        return Buffer.from(v, "base64").length === 32;
      } catch {
        return false;
      }
    }, "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded")
    .optional(),
});

function emptyToUndefined<T extends Record<string, string | undefined>>(o: T): T {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(o)) out[k] = v === "" ? undefined : v;
  return out as T;
}

// NEXT_PUBLIC_* must be referenced literally so Next can inline them in client bundles.
const publicParsed = publicSchema.safeParse(
  emptyToUndefined({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ANILIST_CLIENT_ID: process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID,
  }),
);

if (!publicParsed.success) {
  console.error("[kaze] Invalid public environment variables:", z.prettifyError(publicParsed.error));
}

export const publicEnv = publicParsed.success ? publicParsed.data : {};

export const isSupabaseConfigured = Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const siteUrl =
  process.env.NODE_ENV === "production"
    ? (publicEnv.NEXT_PUBLIC_SITE_URL && !publicEnv.NEXT_PUBLIC_SITE_URL.includes("localhost")
        ? publicEnv.NEXT_PUBLIC_SITE_URL
        : "https://www.orunei.sbs")
    : (publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

/** Server-only accessor; never import the result into client components. */
export function getServerEnv() {
  if (typeof window !== "undefined") throw new Error("getServerEnv() called in the browser");
  const parsed = serverSchema.safeParse(
    emptyToUndefined({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ANILIST_CLIENT_SECRET: process.env.ANILIST_CLIENT_SECRET,
      TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    }),
  );
  if (!parsed.success) {
    console.error("[kaze] Invalid server environment variables:", z.prettifyError(parsed.error));
    return {} as z.infer<typeof serverSchema>;
  }
  return parsed.data;
}

export function isAniListOAuthConfigured() {
  const s = getServerEnv();
  return Boolean(
    publicEnv.NEXT_PUBLIC_ANILIST_CLIENT_ID && s.ANILIST_CLIENT_SECRET && s.TOKEN_ENCRYPTION_KEY && s.SUPABASE_SERVICE_ROLE_KEY && isSupabaseConfigured,
  );
}
