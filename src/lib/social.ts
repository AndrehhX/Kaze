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

const PROFILE_COLS = "id, username, display_name, avatar_url, bio, last_seen_at";

export async function listFriends(db: SupabaseClient, me: string): Promise<PublicProfile[]> {
  try {
    let friendIds: string[] = [];
    const { data: rowsAB, error: errAB } = await db
      .from("friendships")
      .select("user_a, user_b")
      .or(`user_a.eq.${me},user_b.eq.${me}`);

    if (!errAB && rowsAB && rowsAB.length > 0) {
      friendIds = Array.from(
        new Set(
          (rowsAB as any[])
            .map((r) => (r.user_a === me ? r.user_b : r.user_a))
            .filter(Boolean)
        )
      );
    } else {
      const { data: rowsReq, error: errReq } = await db
        .from("friendships")
        .select("requester_id, addressee_id")
        .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
        .eq("status", "accepted");
      if (!errReq && rowsReq && rowsReq.length > 0) {
        friendIds = Array.from(
          new Set(
            (rowsReq as any[])
              .map((r) => (r.requester_id === me ? r.addressee_id : r.requester_id))
              .filter(Boolean)
          )
        );
      }
    }

    if (!friendIds.length) return [];
    const { data: profiles, error: pErr } = await db.from("profiles").select(PROFILE_COLS).in("id", friendIds);
    if (pErr || !profiles) return [];
    return profiles as unknown as PublicProfile[];
  } catch {
    return [];
  }
}

export async function friendActivity(db: SupabaseClient, me: string, limit = 30): Promise<ActivityEvent[]> {
  try {
    const friends = await listFriends(db, me);
    if (!friends.length) return [];
    const friendIds = friends.map((f) => f.id);
    const friendMap = new Map<string, PublicProfile>();
    for (const f of friends) friendMap.set(f.id, f);

    const { data, error } = await db
      .from("activity_events")
      .select("id, user_id, kind, media_id, media_snapshot, payload, created_at")
      .in("user_id", friendIds)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((e: any) => ({
      ...e,
      user: friendMap.get(e.user_id) ?? null,
    })) as ActivityEvent[];
  } catch {
    return [];
  }
}

export async function userActivity(db: SupabaseClient, userId: string, limit = 30): Promise<ActivityEvent[]> {
  try {
    const { data, error } = await db
      .from("activity_events")
      .select("id, user_id, kind, media_id, media_snapshot, payload, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    const { data: userProf } = await db.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle();
    const prof = (userProf as unknown as PublicProfile) ?? null;

    return data.map((e: any) => ({
      ...e,
      user: prof,
    })) as ActivityEvent[];
  } catch {
    return [];
  }
}

export async function friendRequests(db: SupabaseClient, me: string): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
  try {
    const { data: reqRows, error: reqErr } = await db
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status, created_at")
      .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    let rawList: { id: string; sender_id: string; receiver_id: string; status: string; created_at: string }[] = [];
    if (!reqErr && reqRows && reqRows.length > 0) {
      rawList = reqRows as any[];
    } else {
      const { data: rows, error } = await db
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!error && rows) {
        rawList = (rows as any[]).map((r) => ({
          id: r.id,
          sender_id: r.requester_id,
          receiver_id: r.addressee_id,
          status: r.status,
          created_at: r.created_at,
        }));
      }
    }

    if (!rawList.length) return { incoming: [], outgoing: [] };

    const userIds = Array.from(new Set(rawList.flatMap((r) => [r.sender_id, r.receiver_id]).filter(Boolean)));
    const { data: profiles } = await db.from("profiles").select(PROFILE_COLS).in("id", userIds);
    const profileMap = new Map<string, PublicProfile>();
    for (const p of (profiles as unknown as PublicProfile[]) ?? []) {
      profileMap.set(p.id, p);
    }

    const incoming: FriendRequest[] = rawList
      .filter((r) => r.receiver_id === me)
      .map((r) => ({
        id: r.id,
        sender_id: r.sender_id,
        receiver_id: r.receiver_id,
        status: r.status,
        created_at: r.created_at,
        sender: profileMap.get(r.sender_id) ?? null,
        receiver: profileMap.get(r.receiver_id) ?? null,
      }));

    const outgoing: FriendRequest[] = rawList
      .filter((r) => r.sender_id === me)
      .map((r) => ({
        id: r.id,
        sender_id: r.sender_id,
        receiver_id: r.receiver_id,
        status: r.status,
        created_at: r.created_at,
        sender: profileMap.get(r.sender_id) ?? null,
        receiver: profileMap.get(r.receiver_id) ?? null,
      }));

    return { incoming, outgoing };
  } catch {
    return { incoming: [], outgoing: [] };
  }
}

export async function searchUsers(db: SupabaseClient, q: string, me: string): Promise<PublicProfile[]> {
  try {
    const term = q.replace(/[%_,()]/g, "").trim();
    if (term.length < 2) return [];
    const { data, error } = await db
      .from("profiles")
      .select(PROFILE_COLS)
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .neq("id", me)
      .limit(20);
    if (error || !data) return [];
    return data as PublicProfile[];
  } catch {
    return [];
  }
}

export async function relationship(db: SupabaseClient, me: string, other: string) {
  try {
    const { data: row } = await db
      .from("friendships")
      .select("id, status, requester_id, addressee_id")
      .or(`and(requester_id.eq.${me},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${me})`)
      .maybeSingle();

    let blocked = false;
    try {
      const { data: blk } = await db.from("user_blocks").select("blocked_id").eq("blocker_id", me).eq("blocked_id", other).maybeSingle();
      blocked = Boolean(blk);
    } catch {}

    const isFriend = row?.status === "accepted";
    const isPending = row?.status === "pending";

    return {
      friends: isFriend,
      pending: isPending ? (row.requester_id === me ? ("outgoing" as const) : ("incoming" as const)) : null,
      requestId: (row?.id as string | undefined) ?? null,
      blocked,
      mutual: 0,
    };
  } catch {
    return {
      friends: false,
      pending: null,
      requestId: null,
      blocked: false,
      mutual: 0,
    };
  }
}

export const REVIEW_SELECT = `id, user_id, media_id, media_snapshot, rating, title, body, has_spoilers, like_count, comment_count, created_at, updated_at, author:profiles!reviews_user_id_fkey(${PROFILE_COLS})`;
export const DISCUSSION_SELECT = `id, user_id, media_id, media_snapshot, title, body, has_spoilers, status, comment_count, last_activity_at, created_at, author:profiles!discussions_user_id_fkey(${PROFILE_COLS})`;
export const COMMENT_SELECT = `id, user_id, target_type, target_id, parent_id, body, has_spoilers, created_at, author:profiles!comments_user_id_fkey(${PROFILE_COLS})`;

export function describeActivity(e: ActivityEvent): string {
  const t = e.media_snapshot?.title ?? "un anime";
  switch (e.kind) {
    case "started":
      return `comenzó a ver ${t}`;
    case "completed":
      return e.payload.score ? `completó ${t} y le dio ${e.payload.score}/100` : `completó ${t}`;
    case "rated":
      return `calificó ${t} con ${e.payload.score}/100`;
    case "favorited":
      return `añadió ${t} a favoritos`;
    case "reviewed":
      return `escribió una reseña de ${t} (${e.payload.rating}/10)`;
    default:
      return `actualizó ${t}`;
  }
}

/** Sentence parts around the title so the title can be rendered as a link. */
export function activityParts(e: ActivityEvent): { before: string; after: string } {
  switch (e.kind) {
    case "started":
      return { before: "comenzó a ver", after: "" };
    case "completed":
      return { before: "completó", after: e.payload.score ? `y le dio ${e.payload.score}/100` : "" };
    case "rated":
      return { before: "calificó", after: `${e.payload.score}/100` };
    case "favorited":
      return { before: "añadió", after: "a favoritos" };
    case "reviewed":
      return { before: "reseñó", after: `(${e.payload.rating}/10)` };
    default:
      return { before: "actualizó", after: "" };
  }
}

export function friendlyDbError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? "";
  if (/already friends/i.test(msg)) return "Ya son amigos.";
  if (/unavailable|not allowed/i.test(msg)) return "Esa acción no está disponible.";
  if (/duplicate key|unique/i.test(msg)) return "Ya existe una solicitud.";
  if (/violates check constraint/i.test(msg)) return "Los datos no cumplen los requisitos.";
  if (/row-level security/i.test(msg)) return "No tienes permisos para realizar esta acción.";
  return msg || "Ocurrió un error inesperado.";
}
