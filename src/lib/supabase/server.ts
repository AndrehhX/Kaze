import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getServerEnv, isSupabaseConfigured, publicEnv } from "@/lib/env";

/** Per-request client bound to the caller's session cookies (RLS applies). */
export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  const store = await cookies();
  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes cookies instead.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS — use only for narrowly scoped server tasks. */
export function getSupabaseAdmin(): SupabaseClient | null {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  if (!isSupabaseConfigured || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Verified user for the current request (validates the JWT with Supabase Auth). */
export async function getRequestUser() {
  const supabase = await getSupabaseServer();
  if (!supabase) return { supabase: null, user: null } as const;
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null } as const;
}
