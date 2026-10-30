"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaSnapshot } from "@/lib/library/types";

/** Typed data access for the social layer. All reads/writes run under RLS with the user's JWT. */

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio?: string;
  last_seen_at?: string | null;
  show_online_status?: boolean;
};

export type ActivityEvent = {
  id: string;
  user_id: string;
  kind: "started" | "completed" | "rated" | "favorited" | "reviewed" | "progress";
  media_id: number | null;
  media_snapshot: Partial<MediaSnapshot>;
  payload: { score?: number; rating?: number; review_id?: string };
  created_at: string;
  user: PublicProfile | null;
};

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender: PublicProfile | null;
  receiver: PublicProfile | null;
};

export type Review = {
  id: string;
  user_id: string;
  media_id: number;
  media_snapshot: Partial<MediaSnapshot>;
  rating: number;
  title: string;
  body: string;
  has_spoilers: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author: PublicProfile | null;
};

export type Discussion = {
  id: string;
  user_id: string;
  media_id: number | null;
  media_snapshot: Partial<MediaSnapshot> | null;
  title: string;
  body: string;
  has_spoilers: boolean;
  status: string;
  comment_count: number;
  last_activity_at: string;
  created_at: string;
  author: PublicProfile | null;
};

export type Comment = {
  id: string;
  user_id: string;
  target_type: "review" | "discussion";
  target_id: string;
  parent_id: string | null;
  body: string;
  has_spoilers: boolean;
  created_at: string;
  author: PublicProfile | null;
};

const PROFILE_COLS = "id, username, display_name, avatar_url";

export async function listFriends(db: SupabaseClient, me: string): Promise<PublicProfile[]> {
  const { data, error } = await db
    .from("friendships")
    .select(`user_a, user_b, a:profiles!friendships_user_a_fkey(${PROFILE_COLS}, last_seen_at, show_online_status), b:profiles!friendships_user_b_fkey(${PROFILE_COLS}, last_seen_at, show_online_status)`)
    .or(`user_a.eq.${me},user_b.eq.${me}`);
  if (error) throw error;
  type Row = { user_a: string; a: PublicProfile; b: PublicProfile };
  return (data as unknown as Row[]).map((r) => (r.user_a === me ? r.b : r.a)).filter(Boolean);
}

export async function friendActivity(db: SupabaseClient, me: string, limit = 30): Promise<ActivityEvent[]> {
  const friends = await listFriends(db, me);
  if (!friends.length) return [];
  // RLS (can_view 'activity') drops events from friends who hide their activity.
  const { data, error } = await db
    .from("activity_events")
    .select(`id, user_id, kind, media_id, media_snapshot, payload, created_at, user:profiles!activity_events_user_id_fkey(${PROFILE_COLS})`)
    .in(
      "user_id",
      friends.map((f) => f.id),
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as ActivityEvent[];
}

export async function userActivity(db: SupabaseClient, userId: string, limit = 30): Promise<ActivityEvent[]> {
  const { data, error } = await db
    .from("activity_events")
    .select(`id, user_id, kind, media_id, media_snapshot, payload, created_at, user:profiles!activity_events_user_id_fkey(${PROFILE_COLS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as ActivityEvent[];
}

export async function friendRequests(db: SupabaseClient, me: string): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
  const { data, error } = await db
    .from("friend_requests")
    .select(`id, sender_id, receiver_id, status, created_at, sender:profiles!friend_requests_sender_id_fkey(${PROFILE_COLS}), receiver:profiles!friend_requests_receiver_id_fkey(${PROFILE_COLS})`)
    .eq("status", "pending")
    .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data as unknown as FriendRequest[];
  return { incoming: rows.filter((r) => r.receiver_id === me), outgoing: rows.filter((r) => r.sender_id === me) };
}

export async function searchUsers(db: SupabaseClient, q: string, me: string): Promise<PublicProfile[]> {
  const term = q.replace(/[%_,()]/g, "").trim();
  if (term.length < 2) return [];
  const { data, error } = await db
    .from("profiles")
    .select(PROFILE_COLS)
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .neq("id", me)
    .limit(20);
  if (error) throw error;
  return data as PublicProfile[];
}

export async function relationship(db: SupabaseClient, me: string, other: string) {
  const [{ data: fr }, { data: req }, { data: blk }, { data: mutual }] = await Promise.all([
    db.from("friendships").select("user_a").eq("user_a", me < other ? me : other).eq("user_b", me < other ? other : me).maybeSingle(),
    db.from("friend_requests").select("id, sender_id").eq("status", "pending").or(`and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`).maybeSingle(),
    db.from("user_blocks").select("blocked_id").eq("blocker_id", me).eq("blocked_id", other).maybeSingle(),
    db.rpc("mutual_friend_count", { other }),
  ]);
  return {
    friends: Boolean(fr),
    pending: req ? (req.sender_id === me ? ("outgoing" as const) : ("incoming" as const)) : null,
    requestId: (req?.id as string | undefined) ?? null,
    blocked: Boolean(blk),
    mutual: (mutual as number | null) ?? 0,
  };
}

export const REVIEW_SELECT = `id, user_id, media_id, media_snapshot, rating, title, body, has_spoilers, like_count, comment_count, created_at, updated_at, author:profiles!reviews_user_id_fkey(${PROFILE_COLS})`;
export const DISCUSSION_SELECT = `id, user_id, media_id, media_snapshot, title, body, has_spoilers, status, comment_count, last_activity_at, created_at, author:profiles!discussions_user_id_fkey(${PROFILE_COLS})`;
export const COMMENT_SELECT = `id, user_id, target_type, target_id, parent_id, body, has_spoilers, created_at, author:profiles!comments_user_id_fkey(${PROFILE_COLS})`;

export function describeActivity(e: ActivityEvent): string {
  const t = e.media_snapshot?.title ?? "an anime";
  switch (e.kind) {
    case "started":
      return `started watching ${t}`;
    case "completed":
      return e.payload.score ? `completed ${t} and scored it ${e.payload.score}` : `completed ${t}`;
    case "rated":
      return `rated ${t} ${e.payload.score}/100`;
    case "favorited":
      return `added ${t} to favorites`;
    case "reviewed":
      return `reviewed ${t} (${e.payload.rating}/10)`;
    default:
      return `updated ${t}`;
  }
}

/** Sentence parts around the title so the title can be rendered as a link. */
export function activityParts(e: ActivityEvent): { before: string; after: string } {
  switch (e.kind) {
    case "started":
      return { before: "started watching", after: "" };
    case "completed":
      return { before: "completed", after: e.payload.score ? `and scored it ${e.payload.score}` : "" };
    case "rated":
      return { before: "rated", after: `${e.payload.score}/100` };
    case "favorited":
      return { before: "added", after: "to favorites" };
    case "reviewed":
      return { before: "reviewed", after: `(${e.payload.rating}/10)` };
    default:
      return { before: "updated", after: "" };
  }
}

export function friendlyDbError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? "";
  if (/already friends/i.test(msg)) return "You're already friends.";
  if (/unavailable|not allowed/i.test(msg)) return "That action isn't available.";
  if (/duplicate key|unique/i.test(msg)) return "That already exists.";
  if (/violates check constraint/i.test(msg)) return "Some fields don't meet the requirements.";
  if (/row-level security/i.test(msg)) return "You don't have permission to do that.";
  return msg || "Something went wrong.";
}
