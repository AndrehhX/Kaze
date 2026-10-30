"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { activityParts, describeActivity, friendActivity, userActivity, type ActivityEvent } from "@/lib/social";
import { useAuth } from "@/stores/auth";
import { Rail } from "@/components/ui/rail";
import { EmptyState, ErrorPanel, SafeImage, Skeleton } from "@/components/ui/primitives";
import { Avatar } from "@/components/shell/user-menu";
import { relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";

export function useFriendActivity(limit = 30) {
  const me = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: ["friend-activity", me, limit],
    queryFn: () => friendActivity(getSupabaseBrowser()!, me!, limit),
    enabled: Boolean(me && getSupabaseBrowser()),
    staleTime: 60_000,
  });
}

export function useUserActivity(userId: string | undefined, limit = 30) {
  return useQuery({
    queryKey: ["user-activity", userId, limit],
    queryFn: () => userActivity(getSupabaseBrowser()!, userId!, limit),
    enabled: Boolean(userId && getSupabaseBrowser()),
  });
}

export function ActivityItem({ e, now }: { e: ActivityEvent; now: number | null }) {
  const name = e.user?.display_name || e.user?.username || "Friend";
  return (
    <li className="flex gap-3 border-b border-line py-3 last:border-0">
      <Link href={e.user ? `/profile/${e.user.username}` : "#"} className="shrink-0">
        <Avatar src={e.user?.avatar_url} name={name} size={36} />
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <p>
          <Link href={e.user ? `/profile/${e.user.username}` : "#"} className="font-semibold hover:text-primary-ink">
            {name}
          </Link>{" "}
          <span className="text-muted">{activityParts(e).before}</span>{" "}
          {e.media_id ? (
            <Link href={`/anime/${e.media_id}`} className="font-medium hover:text-primary-ink">
              {e.media_snapshot?.title ?? "an anime"}
            </Link>
          ) : (
            <span>{e.media_snapshot?.title ?? "an anime"}</span>
          )}{" "}
          <span className="text-muted">{activityParts(e).after}</span>
        </p>
        <p className="text-xs text-muted">{now ? relativeTime(new Date(e.created_at).getTime(), now) : ""}</p>
      </div>
      {e.media_snapshot?.cover && (
        <Link href={`/anime/${e.media_id}`} className="k-poster relative h-14 w-10 shrink-0">
          <SafeImage src={e.media_snapshot.cover} alt="" fill sizes="40px" className="object-cover" />
        </Link>
      )}
    </li>
  );
}

export function ActivityList({ events, isLoading, error, empty }: { events?: ActivityEvent[]; isLoading: boolean; error: unknown; empty: React.ReactNode }) {
  const now = useNow();
  if (isLoading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  if (error) return <ErrorPanel title="Couldn't load activity" message={(error as Error).message} />;
  if (!events?.length) return <>{empty}</>;
  return (
    <ul>
      {events.map((e) => (
        <ActivityItem key={e.id} e={e} now={now} />
      ))}
    </ul>
  );
}

/** Compact rail used on the home page. */
export function FriendsActivityRail() {
  const { data, isLoading, error } = useFriendActivity(20);
  const now = useNow();
  if (isLoading) return <Skeleton className="h-28" />;
  if (error) return <ErrorPanel title="Couldn't load friend activity" message={(error as Error).message} />;
  const watching = (data ?? []).filter((e) => e.media_id);
  if (!watching.length)
    return (
      <EmptyState
        icon={<Users className="size-6" />}
        jp="友"
        title="No friend activity yet"
        body="When friends start, finish or rate something — and their privacy settings allow it — it shows up here."
        action={
          <Link href="/friends" className="k-btn k-btn-primary k-btn-sm">
            Find friends
          </Link>
        }
      />
    );
  return (
    <Rail label="Friend activity" itemClassName="w-[78vw] xs:w-[56vw] sm:w-[40vw] md:w-[30vw] lg:w-[23vw] xl:w-[19vw]">
      {watching.map((e) => {
        const name = e.user?.display_name || e.user?.username || "Friend";
        return (
          <Link key={e.id} href={`/anime/${e.media_id}`} className="k-card flex h-full gap-3 p-2.5">
            <div className="k-poster relative aspect-[2/3] w-16 shrink-0">
              <SafeImage src={e.media_snapshot?.cover ?? ""} alt="" fill sizes="64px" className="object-cover" fallbackLabel={e.media_snapshot?.title} />
            </div>
            <div className="min-w-0 py-1 text-sm">
              <div className="flex items-center gap-2">
                <Avatar src={e.user?.avatar_url} name={name} size={20} />
                <span className="truncate text-xs font-semibold">{name}</span>
              </div>
              <p className="clamp-2 mt-1.5 text-xs text-muted">{describeActivity(e)}</p>
              <p className="mt-1 text-[0.6875rem] text-muted">{now ? relativeTime(new Date(e.created_at).getTime(), now) : ""}</p>
            </div>
          </Link>
        );
      })}
    </Rail>
  );
}
