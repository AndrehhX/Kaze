"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import type { SupporterPublic } from "@/lib/support/tiers";

/** Estado público de apoyo de una cuenta (insignia y cosméticos). null si no apoya. */
export function useSupporter(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["supporter", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await getSupabaseBrowser()!.from("supporters").select("tier, expires_at, founder, equipped").eq("user_id", userId!).maybeSingle();
      return (data as SupporterPublic | null) ?? null;
    },
  });
}
