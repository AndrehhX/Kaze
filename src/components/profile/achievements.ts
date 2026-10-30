"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { computeAchievements, type Achievement } from "@/lib/dna";
import type { LibraryEntry } from "@/lib/library/types";
import { isSupabaseConfigured } from "@/lib/env";
import { seasonOf } from "@/lib/utils";

/** Completed titles this season (completedAt on/after the season's first day). */
export function seasonProgress(entries: LibraryEntry[], now = new Date()) {
  const { season, year } = seasonOf(now);
  const startMonth = { WINTER: -1, SPRING: 2, SUMMER: 5, FALL: 8 }[season];
  const from = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
  return { season, year, done: entries.filter((e) => e.status === "COMPLETED" && e.completedAt && e.completedAt >= from).length };
}

type Extras = { reviews: number; hostedParties: number; goal: number | null; persisted: string[] };

/**
 * Achievements from real data: library entries, published reviews, hosted
 * watch parties and the seasonal goal. Earned badges are persisted for the
 * owner so other people can see them even when lists are private.
 */
export function useAchievements(entries: LibraryEntry[], userId: string | null, isMe: boolean) {
  const enabled = isSupabaseConfigured && Boolean(userId) && userId !== "guest";
  const extras = useQuery<Extras>({
    queryKey: ["achievement-extras", userId, isMe],
    enabled,
    queryFn: async () => {
      const db = getSupabaseBrowser()!;
      const { season, year } = seasonOf(new Date());
      const [reviews, rooms, goal, earned] = await Promise.all([
        db.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", userId!).eq("status", "published"),
        // Rooms are visible to their host only; other viewers rely on persisted badges.
        isMe ? db.from("watch_party_rooms").select("id", { count: "exact", head: true }).eq("host_id", userId!) : Promise.resolve({ count: 0 }),
        isMe ? db.from("seasonal_goals").select("target").eq("user_id", userId!).eq("season", season).eq("year", year).maybeSingle() : Promise.resolve({ data: null }),
        db.from("user_achievements").select("achievement_id").eq("user_id", userId!),
      ]);
      return {
        reviews: reviews.count ?? 0,
        hostedParties: rooms.count ?? 0,
        goal: (goal.data as { target: number } | null)?.target ?? null,
        persisted: ((earned.data ?? []) as { achievement_id: string }[]).map((r) => r.achievement_id),
      };
    },
  });

  const achievements: Achievement[] = useMemo(() => {
    const e = extras.data;
    const goalMet = Boolean(e?.goal && seasonProgress(entries).done >= e.goal);
    const list = computeAchievements(entries, { reviews: e?.reviews, hostedParties: e?.hostedParties, seasonGoalMet: goalMet });
    const persisted = new Set(e?.persisted ?? []);
    return list.map((a) => (persisted.has(a.id) && !a.earned ? { ...a, earned: true, progress: a.target } : a));
  }, [entries, extras.data]);

  // Persist newly earned badges for the owner (insert-only; RLS checks ownership).
  const saved = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled || !isMe || !extras.data) return;
    const fresh = achievements.filter((a) => a.earned && !extras.data!.persisted.includes(a.id) && !saved.current.has(a.id));
    if (!fresh.length) return;
    fresh.forEach((a) => saved.current.add(a.id));
    getSupabaseBrowser()!
      .from("user_achievements")
      .upsert(fresh.map((a) => ({ user_id: userId, achievement_id: a.id })), { onConflict: "user_id,achievement_id", ignoreDuplicates: true })
      .then(({ error }) => error && console.warn("[kaze] achievement sync failed", error.message));
  }, [achievements, enabled, isMe, extras.data, userId]);

  return { achievements, goal: extras.data?.goal ?? null, loading: extras.isLoading && enabled, refetch: extras.refetch };
}

export async function saveSeasonGoal(userId: string, target: number) {
  const { season, year } = seasonOf(new Date());
  const db = getSupabaseBrowser()!;
  if (target <= 0) return db.from("seasonal_goals").delete().eq("user_id", userId).eq("season", season).eq("year", year);
  return db.from("seasonal_goals").upsert({ user_id: userId, season, year, target: Math.min(200, target) }, { onConflict: "user_id,season,year" });
}
