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

function useSocialMutations() {
  const refresh = useRefreshSocial();
  return {
    send: useMutation({
      mutationFn: async ({ target }: { target: string }) => {
        const me = useAuth.getState().user?.id;
        if (!me) throw new Error("No autenticado");
        const { error } = await db().from("friendships").insert({
          requester_id: me,
          addressee_id: target,
          status: "pendientes",
        });
        if (error) throw error;
      },
      onSuccess: () => {
        toast.success("Solicitud de amistad enviada");
        refresh();
      },
      onError: (e) => toast.error(friendlyDbError(e)),
    }),
    respond: useMutation({
      mutationFn: async ({ request_id, accept }: { request_id: string; accept: boolean }) => {
        if (accept) {
          const { error } = await db()
            .from("friendships")
            .update({ status: "accepted", updated_at: new Date().toISOString() })
            .eq("id", request_id);
          if (error) throw error;
        } else {
          const { error } = await db().from("friendships").delete().eq("id", request_id);
          if (error) throw error;
        }
      },
      onSuccess: (_, v) => {
        toast.success(v.accept ? "Solicitud aceptada" : "Solicitud rechazada");
        refresh();
      },
      onError: (e) => toast.error(friendlyDbError(e)),
    }),
    remove: useMutation({
      mutationFn: async ({ other }: { other: string }) => {
        const me = useAuth.getState().user?.id;
        if (!me) throw new Error("No autenticado");
        const { error } = await db()
          .from("friendships")
          .delete()
          .or(`and(requester_id.eq.${me},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${me})`);
        if (error) throw error;
      },
      onSuccess: () => {
        toast.success("Amigo eliminado");
        refresh();
      },
      onError: (e) => toast.error(friendlyDbError(e)),
    }),
    block: useMutation({
      mutationFn: async ({ target }: { target: string }) => {
        const me = useAuth.getState().user?.id;
        if (!me) throw new Error("No autenticado");
        try {
          await db().from("user_blocks").insert({ blocker_id: me, blocked_id: target });
        } catch {}
        await db()
          .from("friendships")
          .delete()
          .or(`and(requester_id.eq.${me},addressee_id.eq.${target}),and(requester_id.eq.${target},addressee_id.eq.${me})`);
      },
      onSuccess: () => {
        toast.success("Usuario bloqueado");
        refresh();
      },
      onError: (e) => toast.error(friendlyDbError(e)),
    }),
    refresh,
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
    const { error } = await db().from("friendships").delete().eq("id", r.requestId);
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
              toast("Desbloqueado");
              m.refresh();
            }
          }}
        >
          Unblock
        </button>
      ) : r.friends ? (
        <button className="k-btn k-btn-outline k-btn-sm" onClick={() => setConfirm("remove")}>
          <Check className="size-4" aria-hidden /> Amigos
        </button>
      ) : r.pending === "outgoing" ? (
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={cancelOutgoing}>
          Solicitud enviada · cancelar
        </button>
      ) : r.pending === "incoming" ? (
        <>
          <button className="k-btn k-btn-primary k-btn-sm" onClick={() => r.requestId && m.respond.mutate({ request_id: r.requestId, accept: true })}>
            Aceptar solicitud
          </button>
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => r.requestId && m.respond.mutate({ request_id: r.requestId, accept: false })}>
            Decline
          </button>
        </>
      ) : (
        <button className="k-btn k-btn-primary k-btn-sm" onClick={() => m.send.mutate({ target: target.id })} disabled={m.send.isPending}>
          <UserPlus className="size-4" aria-hidden /> Añadir amigo
        </button>
      )}
      {r && r.mutual > 0 && <span className="text-xs text-muted">{r.mutual} en común</span>}
      {r && !r.blocked && (
        <button className="k-btn k-btn-ghost k-btn-icon k-btn-sm text-muted" aria-label={`Block ${target.username}`} title="Bloquear" onClick={() => setConfirm("block")}>
          <Ban className="size-4" />
        </button>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "block" ? `¿Bloquear a @${target.username}?` : `¿Eliminar a @${target.username} de tus amigos?`}
        body={confirm === "block" ? "No podrá ver tu perfil, tus reseñas ni unirse a tus watch parties." : "Dejarán de ver la actividad de amigos del otro."}
        destructive
        confirmLabel={confirm === "block" ? "Bloquear" : "Eliminar"}
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
  const blocked = useQuery<PublicProfile[]>({
    queryKey: ["blocked", me],
    queryFn: async () => {
      try {
        const { data, error } = await db().from("user_blocks").select("blocked_id").eq("blocker_id", me);
        if (error || !data) return [];
        return [];
      } catch {
        return [];
      }
    },
  });
  const incoming = requests.data?.incoming.length ?? 0;

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-10">
        <section aria-labelledby="find-h">
          <h2 id="find-h" className="font-display text-section">Buscar personas</h2>
          <div className="relative mt-4 max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="user-q" className="sr-only">Search by username or name</label>
            <input id="user-q" className="k-input !pl-9" placeholder="Buscar por usuario o nombre para mostrar" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {dq.length >= 2 && (
            <ul className="mt-4 space-y-2">
              {search.isLoading && <Skeleton className="h-16" />}
              {search.data?.length === 0 && <p className="text-sm text-muted">No se encontraron usuarios para “{dq}”.</p>}
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
          <h2 id="feed-h" className="font-display text-section mb-4">Actividad de amigos</h2>
          <div className="k-card px-4">
            <ActivityList
              events={activity.data}
              isLoading={activity.isLoading}
              error={activity.error}
              empty={<p className="py-8 text-center text-sm text-muted">Sin actividad aún. Solo los eventos que tus amigos decidan compartir aparecerán aquí.</p>}
            />
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <Link href="/friends/requests" className={cn("k-card flex items-center justify-between p-4", incoming > 0 && "ring-2 ring-accent")}>
          <span className="font-semibold">Solicitudes de amistad</span>
          <span className="k-chip">{incoming} pendientes</span>
        </Link>
        <section aria-labelledby="list-h" className="k-card p-4">
          <h2 id="list-h" className="font-display text-lg">Amigos · {friends.data?.length ?? 0}</h2>
          {friends.isLoading && <Skeleton className="mt-3 h-24" />}
          {(!friends.isLoading && (friends.error || !friends.data || friends.data.length === 0)) && (
            <EmptyState className="mt-3 !py-8" icon={<Users className="size-5" />} title="Aún no tienes amigos agregados" body="Busca a personas que conozcas en la barra superior." />
          )}
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
                      {f.show_online_status && f.last_seen_at && now ? ` · activo ${relativeTime(new Date(f.last_seen_at).getTime(), now)}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {(blocked.data?.length ?? 0) > 0 && (
          <section aria-labelledby="blocked-h" className="k-card p-4">
            <h2 id="blocked-h" className="font-display text-lg">Usuarios bloqueados</h2>
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
        <h2 id="in-h" className="font-display text-section mb-4">Recibidas</h2>
        {!data?.incoming.length ? (
          <EmptyState title="No tienes solicitudes pendientes" />
        ) : (
          <ul className="space-y-2">
            {data.incoming.map((r) => (
              <Row key={r.id} p={r.sender} at={r.created_at}>
                <button className="k-btn k-btn-primary k-btn-sm" onClick={() => m.respond.mutate({ request_id: r.id, accept: true })}>
                  <Check className="size-4" aria-hidden /> Aceptar
                </button>
                <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => m.respond.mutate({ request_id: r.id, accept: false })}>
                  <X className="size-4" aria-hidden /> Rechazar
                </button>
              </Row>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="out-h">
        <h2 id="out-h" className="font-display text-section mb-4">Enviadas</h2>
        {!data?.outgoing.length ? (
          <EmptyState title="No has enviado solicitudes" />
        ) : (
          <ul className="space-y-2">
            {data.outgoing.map((r) => (
              <Row key={r.id} p={r.receiver} at={r.created_at}>
                <button
                  className="k-btn k-btn-ghost k-btn-sm"
                  onClick={async () => {
                    const { error } = await db().from("friendships").delete().eq("id", r.id);
                    if (error) toast.error(friendlyDbError(error));
                    else m.refresh();
                  }}
                >
                  <UserMinus className="size-4" aria-hidden /> Cancelar
                </button>
              </Row>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
