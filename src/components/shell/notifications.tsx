"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/stores/auth";
import { cn, relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";

export type Notification = {
  id: string;
  kind: "friend_request" | "friend_accepted" | "review_like" | "comment" | "reply" | "watch_party_invite" | "achievement" | "system";
  payload: Record<string, string>;
  read_at: string | null;
  created_at: string;
  actor: { username: string; display_name: string; avatar_url: string | null } | null;
};

const useNotifs = create<{ items: Notification[]; set: (i: Notification[]) => void }>((set) => ({ items: [], set: (items) => set({ items }) }));

function describe(n: Notification): { text: string; href: string } {
  const who = n.actor?.display_name || n.actor?.username || "Someone";
  switch (n.kind) {
    case "friend_request":
      return { text: `${who} sent you a friend request`, href: "/friends/requests" };
    case "friend_accepted":
      return { text: `${who} accepted your friend request`, href: n.actor ? `/profile/${n.actor.username}` : "/friends" };
    case "review_like":
      return { text: `${who} liked your review`, href: `/community/reviews#${n.payload.review_id}` };
    case "comment":
      return { text: `${who} commented on your ${n.payload.target_type}`, href: n.payload.target_type === "discussion" ? `/community/discussions/${n.payload.target_id}` : `/community/reviews#${n.payload.target_id}` };
    case "reply":
      return { text: `${who} replied to your comment`, href: n.payload.target_type === "discussion" ? `/community/discussions/${n.payload.target_id}` : `/community/reviews#${n.payload.target_id}` };
    case "watch_party_invite":
      return { text: `${who} invited you to “${n.payload.title ?? "a watch party"}”`, href: `/watch-parties/${n.payload.room_id}` };
    case "achievement":
      return { text: `Achievement unlocked: ${n.payload.name ?? ""}`, href: "/profile" };
    default:
      return { text: n.payload.message ?? "Update", href: "/" };
  }
}

const SELECT = "id, kind, payload, read_at, created_at, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)";

/** Loads notifications and subscribes to new ones over Supabase Realtime. */
export function useNotificationFeed() {
  const userId = useAuth((s) => s.user?.id);
  const { items, set } = useNotifs();
  useEffect(() => {
    const db = getSupabaseBrowser();
    if (!db || !userId) {
      set([]);
      return;
    }
    let alive = true;
    const load = async () => {
      const { data } = await db.from("notifications").select(SELECT).eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
      if (alive && data) set(data as unknown as Notification[]);
    };
    load();
    const ch = db
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, async (payload) => {
        const { data } = await db.from("notifications").select(SELECT).eq("id", (payload.new as { id: string }).id).maybeSingle();
        if (!alive || !data) return;
        const n = data as unknown as Notification;
        useNotifs.setState((s) => ({ items: [n, ...s.items.filter((x) => x.id !== n.id)].slice(0, 50) }));
        toast(describe(n).text);
      })
      .subscribe();
    return () => {
      alive = false;
      db.removeChannel(ch);
    };
  }, [userId, set]);
  return items;
}

export function NotificationBell() {
  const status = useAuth((s) => s.status);
  const items = useNotificationFeed();
  const now = useNow();
  if (status !== "signed-in") return null;
  const unread = items.filter((n) => !n.read_at).length;

  const markAll = async () => {
    const db = getSupabaseBrowser();
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!db || !ids.length) return;
    const at = new Date().toISOString();
    useNotifs.setState((s) => ({ items: s.items.map((n) => (ids.includes(n.id) ? { ...n, read_at: at } : n)) }));
    const { error } = await db.from("notifications").update({ read_at: at }).in("id", ids);
    if (error) toast.error("Couldn't mark notifications as read");
  };

  return (
    <DM.Root onOpenChange={(o) => !o && unread && markAll()}>
      <DM.Trigger asChild>
        <button type="button" className="k-btn k-btn-ghost k-btn-icon k-btn-sm relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell className="size-[18px]" aria-hidden />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-bold leading-4 text-black">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={10} className="k-panel z-[90] w-[min(92vw,380px)] !bg-surface p-2">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <span className="font-display text-base">Notifications</span>
            <button className="k-btn k-btn-ghost k-btn-sm !min-h-8 text-xs" onClick={markAll} disabled={!unread}>
              <CheckCheck className="size-3.5" /> Mark read
            </button>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto">
            {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">You&apos;re all caught up. Friend requests, replies and invites land here.</p>}
            {items.map((n) => {
              const d = describe(n);
              return (
                <DM.Item key={n.id} asChild>
                  <Link
                    href={d.href}
                    className={cn("flex gap-3 rounded-[min(var(--k-radius-btn),12px)] px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-[var(--k-btn-ghost)]", !n.read_at && "bg-primary/[0.07]")}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block">{d.text}</span>
                      <span className="text-xs text-muted">{now ? relativeTime(new Date(n.created_at).getTime(), now) : ""}</span>
                    </span>
                  </Link>
                </DM.Item>
              );
            })}
          </div>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
