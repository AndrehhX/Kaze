"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { friendRequests, friendlyDbError, listFriends, searchUsers, type PublicProfile } from "@/lib/social";
import { useAuth } from "@/stores/auth";
import { useDebounced, useNow } from "@/lib/hooks";
import { Avatar } from "@/components/shell/user-menu";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorPanel, Skeleton } from "@/components/ui/primitives";
import { ActivityList, useFriendActivity } from "./friends-activity";
import { AuthGate } from "./gate";
import { cn, relativeTime } from "@/lib/utils";

function db() {
  return getSupabaseBrowser()!;
}

export function useFriendsList() {
  const me = useAuth((s) => s.user?.id);
  return useQuery({ queryKey: ["friends", me], queryFn: () => listFriends(db(), me!), enabled: Boolean(me) });
}

export function useRequests() {
  const me = useAuth((s) => s.user?.id);
  return useQuery({ queryKey: ["friend-requests", me], queryFn: () => friendRequests(db(), me!), enabled: Boolean(me) });
}

function useRefreshSocial() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["friends"] });
    qc.invalidateQueries({ queryKey: ["friend-requests"] });
    qc.invalidateQueries({ queryKey: ["relationship"] });
    qc.invalidateQueries({ queryKey: ["friend-activity"] });
  };
}

function useRpc(name: string, ok: string) {
  const refresh = useRefreshSocial();
  return useMutation({
    mutationFn: async (args: Record<string, unknown>) => {
      const { error } = await db().rpc(name, args);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(ok);
      refresh();
    },
    onError: (e) => toast.error(friendlyDbError(e)),
  });
}

function useSocialMutations() {
  return {
    send: useRpc("send_friend_request", "Friend request sent"),
    respond: useRpc("respond_friend_request", "Done"),
    remove: useRpc("remove_friend", "Friend removed"),
    block: useRpc("block_user", "User blocked"),
    refresh: useRefreshSocial(),
  };
}

export function FriendButton({ target }: { target: PublicProfile }) {
  const me = useAuth((s) => s.user?.id);
  const m = useSocialMutations();
  const [confirm, setConfirm] = useState<"remove" | "block" | null>(null);
  const rel = useQuery({
    queryKey: ["relationship", me, target.id],
    enabled: Boolean(me && me !== target.id),
    queryFn: async () => {
      const { relationship } = await import("@/lib/social");
      return relationship(db(), me!, target.id);
    },
  });
  if (!me || me === target.id) return null;
  const r = rel.data;
  const cancelOutgoing = async () => {
    if (!r?.requestId) return;
    const { error } = await db().from("friend_requests").update({ status: "cancelled", responded_at: new Date().toISOString() }).eq("id", r.requestId);
    if (error) toast.error(friendlyDbError(error));
    else m.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!r ? (
        <span className="k-skeleton h-9 w-28" />
      ) : r.blocked ? (
        <button
          className="k-btn k-btn-outline k-btn-sm"
          onClick={async () => {
            const { error } = await db().from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", target.id);
            if (error) toast.error(friendlyDbError(error));
            else {
              toast("Unblocked");
              m.refresh();
            }
          }}
        >
          Unblock
        </button>
      ) : r.friends ? (
        <button className="k-btn k-btn-outline k-btn-sm" onClick={() => setConfirm("remove")}>
          <Check className="size-4" aria-hidden /> Friends
        </button>
      ) : r.pending === "outgoing" ? (
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={cancelOutgoing}>
          Requested · cancel
        </button>
      ) : r.pending === "incoming" ? (
        <>
          <button className="k-btn k-btn-primary k-btn-sm" onClick={() => m.respond.mutate({ request_id: r.requestId, accept: true })}>
            Accept request
          </button>
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => m.respond.mutate({ request_id: r.requestId, accept: false })}>
            Decline
          </button>
        </>
      ) : (
        <button className="k-btn k-btn-primary k-btn-sm" onClick={() => m.send.mutate({ target: target.id })} disabled={m.send.isPending}>
          <UserPlus className="size-4" aria-hidden /> Add friend
        </button>
      )}
      {r && r.mutual > 0 && <span className="text-xs text-muted">{r.mutual} mutual</span>}
      {r && !r.blocked && (
        <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm text-muted" aria-label={`Block ${target.username}`} title="Block" onClick={() => setConfirm("block")}>
          <Ban className="size-4" />
        </button>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "block" ? `Block @${target.username}?` : `Remove @${target.username} from friends?`}
        body={confirm === "block" ? "They won't be able to see your profile, reviews or comments, send requests, or join your watch parties. Any friendship is removed." : "You'll stop seeing each other's friend-only activity."}
        destructive
        confirmLabel={confirm === "block" ? "Block" : "Remove"}
        onConfirm={() => {
          if (confirm === "block") m.block.mutate({ target: target.id });
          else m.remove.mutate({ other: target.id });
          setConfirm(null);
        }}
      />
    </div>
  );
}

function isOnline(p: PublicProfile, now: number | null) {
  return Boolean(p.show_online_status && p.last_seen_at && now && now - new Date(p.last_seen_at).getTime() < 5 * 60_000);
}

export function FriendsPage() {
  return (
    <AuthGate feature="friends" jp="友">
      <FriendsInner />
    </AuthGate>
  );
}

function FriendsInner() {
  const me = useAuth((s) => s.user?.id)!;
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 300);
  const friends = useFriendsList();
  const requests = useRequests();
  const activity = useFriendActivity(40);
  const now = useNow();
  const search = useQuery({ queryKey: ["user-search", dq], queryFn: () => searchUsers(db(), dq, me), enabled: dq.length >= 2 });
  const blocked = useQuery({
    queryKey: ["blocked", me],
    queryFn: async () => {
      const { data, error } = await db().from("user_blocks").select("blocked_id, blocked:profiles!user_blocks_blocked_id_fkey(id, username, display_name, avatar_url)").eq("blocker_id", me);
      if (error) throw error;
      return (data as unknown as { blocked: PublicProfile }[]).map((r) => r.blocked).filter(Boolean);
    },
  });
  const incoming = requests.data?.incoming.length ?? 0;

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-10">
        <section aria-labelledby="find-h">
          <h2 id="find-h" className="font-display text-section">Find people</h2>
          <div className="relative mt-4 max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="user-q" className="sr-only">Search by username or name</label>
            <input id="user-q" className="k-input !pl-9" placeholder="Search by username or display name" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {dq.length >= 2 && (
            <ul className="mt-4 space-y-2">
              {search.isLoading && <Skeleton className="h-16" />}
              {search.data?.length === 0 && <p className="text-sm text-muted">No one found for “{dq}”.</p>}
              {search.data?.map((p) => (
                <li key={p.id} className="k-card flex flex-wrap items-center gap-3 p-3">
                  <Link href={`/profile/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar src={p.avatar_url} name={p.display_name || p.username} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.display_name || p.username}</span>
                      <span className="block text-xs text-muted">@{p.username}</span>
                    </span>
                  </Link>
                  <FriendButton target={p} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="feed-h">
          <h2 id="feed-h" className="font-display text-section mb-4">Friend activity</h2>
          <div className="k-card px-4">
            <ActivityList
              events={activity.data}
              isLoading={activity.isLoading}
              error={activity.error}
              empty={<p className="py-8 text-center text-sm text-muted">No activity yet. Only events your friends choose to share appear here.</p>}
            />
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <Link href="/friends/requests" className={cn("k-card flex items-center justify-between p-4", incoming > 0 && "ring-2 ring-accent")}>
          <span className="font-semibold">Friend requests</span>
          <span className="k-chip">{incoming} pending</span>
        </Link>
        <section aria-labelledby="list-h" className="k-card p-4">
          <h2 id="list-h" className="font-display text-lg">Friends · {friends.data?.length ?? 0}</h2>
          {friends.isLoading && <Skeleton className="mt-3 h-24" />}
          {friends.error && <ErrorPanel message={(friends.error as Error).message} />}
          {friends.data?.length === 0 && <EmptyState className="mt-3 !py-8" icon={<Users className="size-5" />} title="No friends yet" body="Search for people you know above." />}
          <ul className="mt-2 divide-y divide-line">
            {friends.data?.map((f) => (
              <li key={f.id}>
                <Link href={`/profile/${f.username}`} className="flex items-center gap-3 py-2.5">
                  <span className="relative">
                    <Avatar src={f.avatar_url} name={f.display_name || f.username} size={36} />
                    {isOnline(f, now) && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-success" aria-label="Online" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{f.display_name || f.username}</span>
                    <span className="block text-xs text-muted">
                      @{f.username}
                      {f.show_online_status && f.last_seen_at && now ? ` · seen ${relativeTime(new Date(f.last_seen_at).getTime(), now)}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {(blocked.data?.length ?? 0) > 0 && (
          <section aria-labelledby="blocked-h" className="k-card p-4">
            <h2 id="blocked-h" className="font-display text-lg">Blocked</h2>
            <ul className="mt-2 divide-y divide-line">
              {blocked.data!.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>@{b.username}</span>
                  <FriendButton target={b} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}

export function RequestsPage() {
  return (
    <AuthGate feature="friend requests">
      <RequestsInner />
    </AuthGate>
  );
}

function RequestsInner() {
  const { data, isLoading, error } = useRequests();
  const m = useSocialMutations();
  const now = useNow();
  if (isLoading) return <Skeleton className="mt-8 h-48" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  const Row = ({ p, children, at }: { p: PublicProfile | null; children: React.ReactNode; at: string }) => (
    <li className="k-card flex flex-wrap items-center gap-3 p-3">
      <Link href={p ? `/profile/${p.username}` : "#"} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar src={p?.avatar_url} name={p?.display_name || p?.username || "?"} size={40} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{p?.display_name || p?.username}</span>
          <span className="block text-xs text-muted">
            @{p?.username} · {now ? relativeTime(new Date(at).getTime(), now) : ""}
          </span>
        </span>
      </Link>
      {children}
    </li>
  );
  return (
    <div className="mt-8 grid gap-10 md:grid-cols-2">
      <section aria-labelledby="in-h">
        <h2 id="in-h" className="font-display text-section mb-4">Received</h2>
        {!data?.incoming.length ? (
          <EmptyState title="No pending requests" />
        ) : (
          <ul className="space-y-2">
            {data.incoming.map((r) => (
              <Row key={r.id} p={r.sender} at={r.created_at}>
                <button className="k-btn k-btn-primary k-btn-sm" onClick={() => m.respond.mutate({ request_id: r.id, accept: true })}>
                  <Check className="size-4" aria-hidden /> Accept
                </button>
                <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => m.respond.mutate({ request_id: r.id, accept: false })}>
                  <X className="size-4" aria-hidden /> Reject
                </button>
              </Row>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="out-h">
        <h2 id="out-h" className="font-display text-section mb-4">Sent</h2>
        {!data?.outgoing.length ? (
          <EmptyState title="No outgoing requests" />
        ) : (
          <ul className="space-y-2">
            {data.outgoing.map((r) => (
              <Row key={r.id} p={r.receiver} at={r.created_at}>
                <button
                  className="k-btn k-btn-ghost k-btn-sm"
                  onClick={async () => {
                    const { error } = await db().from("friend_requests").update({ status: "cancelled", responded_at: new Date().toISOString() }).eq("id", r.id);
                    if (error) toast.error(friendlyDbError(error));
                    else m.refresh();
                  }}
                >
                  <UserMinus className="size-4" aria-hidden /> Cancel
                </button>
              </Row>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
