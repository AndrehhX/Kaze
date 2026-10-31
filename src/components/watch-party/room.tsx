"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Crown, DoorOpen, Lock, Send, Unlock, UserPlus, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/stores/auth";
import { correction, estimateOffset, expectedPosition, rowToState, type ClockSample, type RoomState } from "@/lib/watch-party/sync";
import { friendlyDbError, listFriends, type PublicProfile } from "@/lib/social";
import { Player } from "@/components/player/player";
import { usePlaybackGrant } from "@/components/player/watch-client";
import { Avatar } from "@/components/shell/user-menu";
import { ReportButton } from "@/components/social/report";
import { AuthGate } from "@/components/social/gate";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorPanel, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";

type Room = {
  id: string;
  title: string;
  host_id: string;
  series_id: string;
  episode_id: string;
  is_playing: boolean;
  position_seconds: number;
  playback_rate: number;
  state_updated_at: string;
  state_version: number;
  invite_only: boolean;
  ended_at: string | null;
};
type Msg = { id: string; user_id: string; body: string; created_at: string };
type Participant = { user_id: string; role: string; left_at: string | null; profile: PublicProfile | null };
type Conn = "connecting" | "live" | "reconnecting" | "offline";

const EMOJI = ["😂", "😭", "🔥", "😱", "❤️", "👏", "🤯", "💀"];

export function WatchPartyRoom({ roomId }: { roomId: string }) {
  return (
    <AuthGate feature="watch parties" jp="宴">
      <RoomInner roomId={roomId} />
    </AuthGate>
  );
}

function RoomInner({ roomId }: { roomId: string }) {
  const me = useAuth((s) => s.user!.id);
  const myProfile = useAuth((s) => s.profile);
  const router = useRouter();
  const db = getSupabaseBrowser()!;
  const { reduced } = useKazeMotion();
  const [room, setRoom] = useState<Room | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [conn, setConn] = useState<Conn>("connecting");
  const [offset, setOffset] = useState(0);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [drift, setDrift] = useState<number | null>(null);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [draft, setDraft] = useState("");
  const [invite, setInvite] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const stateRef = useRef<RoomState | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const isHost = room?.host_id === me;

  const profiles = new Map(participants.map((p) => [p.user_id, p.profile]));
  const nameOf = (id: string) => {
    if (id === me) return myProfile?.display_name || myProfile?.username || "Tú";
    const prof = profiles.get(id);
    if (prof?.display_name || prof?.username) return prof.display_name || prof.username;
    if (room && id === room.host_id) return "Host";
    return "Usuario";
  };

  // ── Clock sync with the database server ────────────────────────────
  const syncClock = useCallback(async () => {
    const samples: ClockSample[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const { data, error } = await db.rpc("server_time");
      const t1 = Date.now();
      if (!error && data) samples.push({ t0, server: new Date(data as string).getTime(), t1 });
    }
    const est = estimateOffset(samples);
    if (est) setOffset(est.offset);
  }, [db]);

  // ── Load + join + subscribe ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    let roomData: Room | null = null;
    try {
      const { data, error } = await db.from("watch_party_rooms").select("*").eq("id", roomId).maybeSingle();
      if (!error && data) roomData = data as Room;
    } catch {}

    if (!roomData) {
      try {
        const raw = localStorage.getItem("kaze:watch_party_rooms");
        if (raw) {
          const list = JSON.parse(raw);
          const found = list.find((r: { id: string }) => r.id === roomId);
          if (found) {
            roomData = {
              id: found.id,
              title: found.title,
              host_id: found.host_id,
              series_id: found.series_id,
              episode_id: found.episode_id,
              is_playing: found.is_playing ?? false,
              position_seconds: found.position_seconds ?? 0,
              playback_rate: found.playback_rate ?? 1,
              state_updated_at: found.state_updated_at ?? new Date().toISOString(),
              state_version: found.state_version ?? 0,
              invite_only: found.invite_only ?? false,
              ended_at: found.ended_at ?? null,
            };
          }
        }
      } catch {}
    }

    if (!roomData) return setLoadError("Esta sala no existe, ha finalizado o no tienes acceso.");
    setRoom(roomData);
    stateRef.current = rowToState(roomData);

    try {
      const [{ data: msgs }, { data: parts }] = await Promise.all([
        db.from("watch_party_messages").select("id, user_id, body, created_at").eq("room_id", roomId).order("created_at").limit(200),
        db.from("watch_party_participants").select("user_id, role, left_at, profile:profiles(id, username, display_name, avatar_url)").eq("room_id", roomId),
      ]);
      setMessages((msgs as Msg[]) ?? []);
      setParticipants((parts as unknown as Participant[]) ?? []);
    } catch {
      setMessages([]);
      setParticipants([]);
    }
  }, [db, roomId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
      const { data: r } = await db.from("watch_party_rooms").select("host_id").eq("id", roomId).maybeSingle();
      if (r) {
        await db.from("watch_party_participants").upsert({
          room_id: roomId,
          user_id: me,
          role: r.host_id === me ? "host" : "guest",
          left_at: null,
        }, { onConflict: "room_id,user_id" });
      }
      } catch {}
      if (!alive) return;
      await loadAll();
      syncClock();
    })();

    const ch = db
      .channel(`room:${roomId}`, { config: { presence: { key: me }, broadcast: { self: false } } })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "watch_party_rooms", filter: `id=eq.${roomId}` }, (p) => {
        const r = p.new as Room;
        setRoom(r);
        const s = rowToState(r);
        if (!stateRef.current || s.version >= stateRef.current.version) stateRef.current = s;
        if (r.ended_at) toast("The host ended this party");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "watch_party_messages", filter: `room_id=eq.${roomId}` }, (p) => {
        const m = p.new as Msg;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m].slice(-300)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "watch_party_participants", filter: `room_id=eq.${roomId}` }, () => loadAll())
      .on("broadcast", { event: "reaction" }, ({ payload }) => spawnReaction(payload.emoji))
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConn("live");
          await ch.track({ at: Date.now() });
          // Re-anchor after any reconnection: state may have changed while we were away.
          loadAll();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConn("reconnecting");
        else if (status === "CLOSED") setConn("offline");
      });
    channel.current = ch;
    const clock = setInterval(syncClock, 60_000);
    return () => {
      alive = false;
      clearInterval(clock);
      db.removeChannel(ch);
      db.from("watch_party_participants").update({ left_at: new Date().toISOString() }).eq("room_id", roomId).eq("user_id", me).then(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, me]);

  // ── Guests: continuously converge on the host's authoritative state ──
  useEffect(() => {
    if (isHost) return;
    const t = setInterval(() => {
      const v = video.current;
      const s = stateRef.current;
      if (!v || !s || v.readyState < 2 || s.episodeId !== room?.episode_id) return;
      const expected = expectedPosition(s, Date.now() + offset);
      if (s.isPlaying && v.paused) {
        v.play().catch(() => setNeedsGesture(true));
      } else if (!s.isPlaying && !v.paused) v.pause();
      const c = correction(v.currentTime, expected, s.rate);
      setDrift(c.kind === "ok" ? 0 : c.drift);
      if (c.kind === "seek") v.currentTime = c.to;
      else if (s.isPlaying) v.playbackRate = c.rate;
    }, 500);
    return () => clearInterval(t);
  }, [isHost, offset, room?.episode_id]);

  // ── Host: publish actions through the server-authoritative RPC ─────
  const control = useCallback(
    async (playing: boolean, position: number, episode?: string) => {
      const { error } = await db.rpc("watch_party_control", { room: roomId, playing, pos: position, episode: episode ?? null, rate: video.current?.playbackRate ?? 1 });
      if (error) toast.error(`Sync failed: ${friendlyDbError(error)}`);
    },
    [db, roomId],
  );
  useEffect(() => {
    if (!isHost) return;
    // Heartbeat re-anchors guests even if an update was missed.
    const t = setInterval(() => {
      const v = video.current;
      if (v && !v.paused) control(true, v.currentTime);
    }, 10_000);
    return () => clearInterval(t);
  }, [isHost, control]);

  const [preferredAudio, setPreferredAudio] = useState<"latino" | "sub">("latino");
  const { data: grant, error: grantError } = usePlaybackGrant(room?.series_id ?? "", room?.episode_id ?? "", preferredAudio);

  function spawnReaction(emoji: string) {
    const id = Date.now() + Math.random();
    setReactions((r) => [...r.slice(-20), { id, emoji, x: 10 + Math.random() * 80 }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2600);
  }
  const react = (emoji: string) => {
    spawnReaction(emoji);
    channel.current?.send({ type: "broadcast", event: "reaction", payload: { emoji, from: me } });
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim().slice(0, 500);
    if (!body) return;
    setDraft("");
    const { error } = await db.from("watch_party_messages").insert({ room_id: roomId, user_id: me, body });
    if (error) {
      toast.error(friendlyDbError(error));
      setDraft(body);
    }
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(`${location.origin}/watch-parties/${roomId}`);
    toast.success("Invite link copied", { description: room?.invite_only ? "Only friends and invited people can join this room." : "Anyone signed in with the link can join." });
  };

  if (loadError)
    return (
      <div className="container-k pt-10">
        <EmptyState jp="閉" title="No se pudo abrir esta sala" body={loadError} action={<Link href="/watch-parties" className="k-btn k-btn-outline k-btn-sm">Todas las salas</Link>} />
      </div>
    );
  if (!room) return <Skeleton className="container-k mt-8 aspect-video" />;
  if (room.ended_at)
    return (
      <div className="container-k pt-10">
        <EmptyState jp="終" title="Esta sala ha finalizado" action={<Link href="/watch-parties" className="k-btn k-btn-primary k-btn-sm">Crear tu propia sala</Link>} />
      </div>
    );

  const active = participants.filter((p) => !p.left_at);
  return (
    <div className="container-k grid gap-6 overflow-x-clip pt-4 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <div className="relative">
          {grantError ? (
            <ErrorPanel title="No se pudo reproducir este contenido" message="Cada participante transmite el video en su propio dispositivo; asegúrate de contar con acceso o prueba con otro episodio." />
          ) : !grant ? (
            <Skeleton className="aspect-video w-full" />
          ) : (
            <Player
              key={grant.episode.id}
              grant={grant}
              autoPlay={false}
              onVideo={(v) => (video.current = v)}
              onNavigateEpisode={isHost ? (id) => control(false, 0, id) : undefined}
              sync={{
                locked: !isHost,
                onLocalAction: isHost ? (a) => control(a.type === "play" ? true : a.type === "pause" ? false : !(video.current?.paused ?? true), a.position) : undefined,
                banner: (
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                    {isHost ? <Crown className="size-3.5 text-accent" aria-hidden /> : null}
                    {isHost ? "Tú controlas la reproducción" : `Sincronizado con ${nameOf(room.host_id)}`}
                    {!isHost && drift != null && <span className="font-mono text-white/60">{drift === 0 ? "in sync" : `${drift > 0 ? "+" : ""}${drift.toFixed(2)}s`}</span>}
                  </span>
                ),
              }}
            />
          )}
          {needsGesture && !isHost && (
            <button
              className="absolute inset-0 z-[40] grid place-items-center bg-black/60 text-white"
              onClick={() => {
                video.current?.play().then(() => setNeedsGesture(false)).catch(() => {});
              }}
            >
              <span className="k-btn k-btn-primary">Unirse a la reproducción</span>
            </button>
          )}
          <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden" aria-hidden>
            <AnimatePresence>
              {reactions.map((r) => (
                <motion.span key={r.id} className="absolute bottom-16 text-4xl" style={{ left: `${r.x}%` }} initial={{ y: 0, opacity: 1, scale: 0.6 }} animate={{ y: reduced ? 0 : -260, opacity: 0, scale: 1.2 }} transition={{ duration: 2.4, ease: "easeOut" }}>
                  {r.emoji}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Selector de Audio (SUB vs DUB) en Sala de Cine */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface/80 px-4 py-2.5 border border-line">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Audio / Idioma:</span>
            <div className="flex gap-1.5 rounded-lg bg-elevated p-1">
              <button
                type="button"
                onClick={() => setPreferredAudio("latino")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all",
                  preferredAudio === "latino" ? "bg-primary text-black shadow-sm" : "text-muted hover:text-fg"
                )}
              >
                <span>🇲🇽</span>
                <span>Español Latino (DUB)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreferredAudio("sub")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all",
                  preferredAudio === "sub" ? "bg-primary text-black shadow-sm" : "text-muted hover:text-fg"
                )}
              >
                <span>🇯🇵</span>
                <span>Japonés (SUB)</span>
              </button>
            </div>
          </div>
          <span className="text-xs text-muted">
            {preferredAudio === "sub" ? "Subtítulos en español integrados" : "Doblaje al español latino"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-section mr-auto">{room.title}</h1>
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", conn === "live" ? "text-success" : "text-danger")} role="status">
            {conn === "live" ? <Wifi className="size-4" aria-hidden /> : <WifiOff className="size-4" aria-hidden />}
            {conn === "live" ? "En vivo" : conn === "connecting" ? "Conectando…" : conn === "reconnecting" ? "Reconectando…" : "Desconectado"}
          </span>
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={copyLink}>
            <Copy className="size-4" aria-hidden /> Copiar enlace
          </button>
          {isHost && (
            <>
              <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setInvite(true)}>
                <UserPlus className="size-4" aria-hidden /> Invitar amigos
              </button>
              <button
                className="k-btn k-btn-ghost k-btn-sm"
                onClick={async () => {
                  const nextVal = !room.invite_only;
                  setRoom((prev) => (prev ? { ...prev, invite_only: nextVal } : prev));
                  try {
                    const raw = localStorage.getItem("kaze:watch_party_rooms");
                    if (raw) {
                      const list = JSON.parse(raw);
                      const updated = list.map((r: any) => (r.id === room.id ? { ...r, invite_only: nextVal } : r));
                      localStorage.setItem("kaze:watch_party_rooms", JSON.stringify(updated));
                    }
                  } catch {}
                  try {
                    const { error } = await db.from("watch_party_rooms").update({ invite_only: nextVal }).eq("id", room.id);
                    if (error && !error.message?.includes("schema cache")) {
                      toast.error(friendlyDbError(error));
                    }
                  } catch {}
                }}
                aria-pressed={!room.invite_only}
              >
                {room.invite_only ? <Lock className="size-4" aria-hidden /> : <Unlock className="size-4" aria-hidden />} {room.invite_only ? "Solo invitados" : "Enlace abierto"}
              </button>
              <button className="k-btn k-btn-ghost k-btn-sm text-danger" onClick={() => setConfirmEnd(true)}>
                Finalizar sala
              </button>
            </>
          )}
          <button
            className="k-btn k-btn-outline k-btn-sm"
            onClick={() => router.push("/watch-parties")}
          >
            <DoorOpen className="size-4" aria-hidden /> Salir de la sala
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Enviar una reacción">
          {EMOJI.map((e) => (
            <button key={e} className="k-btn k-btn-ghost k-btn-icon k-btn-sm text-lg" onClick={() => react(e)} aria-label={`React ${e}`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <aside className="flex min-h-[420px] flex-col gap-4 xl:max-h-[calc(100dvh-var(--k-nav-h)-32px)]">
        <section aria-labelledby="ppl-h" className="k-card p-4">
          <h2 id="ppl-h" className="font-display text-base">En la sala · {active.length}</h2>
          <ul className="mt-3 space-y-2">
            {active.map((p) => (
              <li key={p.user_id} className="flex items-center gap-2.5 text-sm">
                <span className="relative">
                  <Avatar src={p.profile?.avatar_url} name={p.profile?.display_name || p.profile?.username || "?"} size={28} />
                  <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface", online.has(p.user_id) ? "bg-success" : "bg-muted")} aria-label={online.has(p.user_id) ? "Connected" : "Not connected"} />
                </span>
                <span className="flex-1 truncate">{p.user_id === me ? `${myProfile?.display_name || "You"} (you)` : p.profile?.display_name || p.profile?.username}</span>
                {p.role === "host" && <Crown className="size-4 text-accent" aria-label="Host" />}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="chat-h" className="k-card flex min-h-0 flex-1 flex-col">
          <h2 id="chat-h" className="font-display px-4 pt-4 text-base">Chat</h2>
          <ChatLog messages={messages} me={me} nameOf={nameOf} />
          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <label htmlFor="chat-input" className="sr-only">Message</label>
            <input id="chat-input" className="k-input !min-h-10 text-sm" maxLength={500} placeholder="Escribe un mensaje en el chat…" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" />
            <button className="k-btn k-btn-primary k-btn-icon k-btn-sm !size-10" aria-label="Send" disabled={!draft.trim()}>
              <Send className="size-4" />
            </button>
          </form>
        </section>
      </aside>

      {invite && <InviteDialog roomId={roomId} roomTitle={room?.title} onClose={() => setInvite(false)} />}
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="¿Finalizar esta sala de cine?"
        body="Todos los participantes serán desconectados y la sala se cerrará definitivamente."
        destructive
        confirmLabel="Finalizar sala"
        onConfirm={async () => {
          const nowStr = new Date().toISOString();
          try {
            const raw = localStorage.getItem("kaze:watch_party_rooms");
            if (raw) {
              const list = JSON.parse(raw);
              const updated = list.map((r: any) => (r.id === roomId ? { ...r, ended_at: nowStr, is_playing: false } : r));
              localStorage.setItem("kaze:watch_party_rooms", JSON.stringify(updated));
            }
          } catch {}
          try {
            await db.from("watch_party_rooms").update({ ended_at: nowStr, is_playing: false }).eq("id", roomId);
          } catch {}
          setConfirmEnd(false);
          toast.success("Sala finalizada con éxito");
          router.push("/watch-parties");
        }}
      />
    </div>
  );
}

function ChatLog({ messages, me, nameOf }: { messages: Msg[]; me: string; nameOf: (id: string) => string }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [messages.length]);
  return (
    <ol ref={ref} className="min-h-40 flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite" aria-relevant="additions">
      {messages.length === 0 && <li className="text-sm text-muted">No messages yet. Say hi!</li>}
      {messages.map((m) => (
        <li key={m.id} className={cn("group text-sm", m.user_id === me && "text-right")}>
          <span className="text-xs font-semibold text-primary-ink">{nameOf(m.user_id)}</span>
          <p className={cn("mt-0.5 inline-block max-w-[90%] whitespace-pre-line break-words rounded-[min(var(--k-radius-card),14px)] px-3 py-1.5 text-left", m.user_id === me ? "bg-primary/20" : "bg-[var(--k-btn-ghost)]")}>{m.body}</p>
          {m.user_id !== me && (
            <span className="ml-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <ReportButton targetType="watch_party_message" targetId={m.id} label="" />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function InviteDialog({ roomId, roomTitle, onClose }: { roomId: string; roomTitle?: string; onClose: () => void }) {
  const me = useAuth((s) => s.user!.id);
  const db = getSupabaseBrowser()!;
  const friends = useQuery({ queryKey: ["friends", me], queryFn: () => listFriends(db, me) });
  const [sent, setSent] = useState<Set<string>>(new Set());
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Invitar amigos" description="Recibirán una notificación con el enlace directo a esta sala.">
      <div className="px-5 pb-5 pt-2">
        {friends.isLoading && <Skeleton className="h-24" />}
        {friends.data?.length === 0 && <p className="text-sm text-muted">Agrega amigos primero para poder invitarlos a tu sala.</p>}
        <ul className="divide-y divide-line">
          {friends.data?.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2.5">
              <Avatar src={f.avatar_url} name={f.display_name || f.username} size={32} />
              <span className="flex-1 truncate text-sm font-semibold">{f.display_name || f.username}</span>
              <button
                className="k-btn k-btn-outline k-btn-sm"
                disabled={sent.has(f.id)}
                onClick={async () => {
                  const { error } = await db.from("watch_party_invites").insert({ room_id: roomId, user_id: f.id, invited_by: me });
                  if (error && !/duplicate/i.test(error.message)) return toast.error(friendlyDbError(error));
                  setSent((s) => new Set(s).add(f.id));

                  // Generar notificación en tiempo real para el amigo
                  await db.from("notifications").insert({
                    user_id: f.id,
                    actor_id: me,
                    kind: "watch_party_invite",
                    payload: {
                      room_id: roomId,
                      title: roomTitle || "Watch Party",
                    },
                  }).then(() => {}, () => {});
                  toast.success(`Invitación enviada a ${f.display_name || f.username}`);
                }}
              >
                {sent.has(f.id) ? "Invitado" : "Invitar"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
