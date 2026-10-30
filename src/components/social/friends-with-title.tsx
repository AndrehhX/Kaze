"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { listFriends } from "@/lib/social";
import { useAuth } from "@/stores/auth";
import { statusMeta, type LibraryStatus } from "@/lib/library/types";
import { Avatar } from "@/components/shell/user-menu";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { AuthGate } from "./gate";

/** Friends who have this title in their library — RLS hides lists that friends keep private. */
export function FriendsWithTitle({ mediaId }: { mediaId: number }) {
  return (
    <AuthGate feature="friend activity">
      <Inner mediaId={mediaId} />
    </AuthGate>
  );
}

function Inner({ mediaId }: { mediaId: number }) {
  const me = useAuth((s) => s.user?.id);
  const { data, isLoading } = useQuery({
    queryKey: ["friends-with", mediaId, me],
    enabled: Boolean(me),
    queryFn: async () => {
      const db = getSupabaseBrowser()!;
      const friends = await listFriends(db, me!);
      if (!friends.length) return { friends: 0, rows: [] as { friend: (typeof friends)[number]; status: LibraryStatus; progress: number; score: number | null }[] };
      const { data, error } = await db
        .from("anime_library_entries")
        .select("user_id, status, progress, score")
        .eq("media_id", mediaId)
        .in(
          "user_id",
          friends.map((f) => f.id),
        );
      if (error) throw error;
      const byId = new Map(friends.map((f) => [f.id, f]));
      return {
        friends: friends.length,
        rows: (data ?? []).map((r: { user_id: string; status: LibraryStatus; progress: number; score: number | null }) => ({ friend: byId.get(r.user_id)!, status: r.status, progress: r.progress, score: r.score })),
      };
    },
  });
  if (isLoading) return <Skeleton className="h-20" />;
  if (!data?.rows.length)
    return (
      <EmptyState
        icon={<Users className="size-6" />}
        title={data?.friends ? "None of your friends have this in a shared list" : "No friends yet"}
        body={data?.friends ? "Friends who keep their lists private won't appear here." : "Add friends to see who's watching what."}
        action={!data?.friends ? <Link href="/friends" className="k-btn k-btn-primary k-btn-sm">Find friends</Link> : undefined}
      />
    );
  return (
    <ul className="flex flex-wrap gap-3">
      {data.rows.map((r) => (
        <li key={r.friend.id}>
          <Link href={`/profile/${r.friend.username}`} className="k-card flex items-center gap-3 p-3 pr-5">
            <Avatar src={r.friend.avatar_url} name={r.friend.display_name || r.friend.username} size={36} />
            <div>
              <p className="text-sm font-semibold">{r.friend.display_name || r.friend.username}</p>
              <p className="text-xs text-muted">
                {statusMeta(r.status).label}
                {r.progress ? ` · ep ${r.progress}` : ""}
                {r.score ? ` · ${r.score}/100` : ""}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
