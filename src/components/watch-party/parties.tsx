"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Popcorn, Radio, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { DEMO_SERIES } from "@/lib/media/demo-catalog";
import { useAuth } from "@/stores/auth";
import { friendlyDbError } from "@/lib/social";
import { AuthGate } from "@/components/social/gate";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";

type RoomRow = { id: string; title: string; series_id: string; episode_id: string; host_id: string; is_playing: boolean; created_at: string; ended_at: string | null; host: { username: string; display_name: string } | null };

export function WatchPartiesIndex() {
  return (
    <AuthGate feature="watch parties" jp="宴">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const me = useAuth((s) => s.user?.id)!;
  const sp = useSearchParams();
  const router = useRouter();
  const now = useNow();
  const series = DEMO_SERIES[0];
  const [title, setTitle] = useState("Movie night");
  const [episode, setEpisode] = useState(sp.get("episode") ?? series.episodes[0].id);
  const [inviteOnly, setInviteOnly] = useState(true);
  const [busy, setBusy] = useState(false);

  const rooms = useQuery({
    queryKey: ["rooms", me],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()!
        .from("watch_party_rooms")
        .select("id, title, series_id, episode_id, host_id, is_playing, created_at, ended_at, host:profiles!watch_party_rooms_host_id_fkey(username, display_name)")
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as RoomRow[];
    },
    refetchInterval: 30_000,
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await getSupabaseBrowser()!.from("watch_party_rooms").insert({ host_id: me, title: title.trim().slice(0, 80) || "Watch party", series_id: series.id, episode_id: episode, invite_only: inviteOnly }).select("id").single();
    setBusy(false);
    if (error) return toast.error(friendlyDbError(error));
    router.push(`/watch-parties/${data.id}`);
  };

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[400px_1fr]">
      <form onSubmit={create} className="k-card space-y-4 self-start p-5">
        <p className="flex items-center gap-2 font-display text-lg">
          <Popcorn className="size-5 text-primary-ink" aria-hidden /> Host a party
        </p>
        <div>
          <label htmlFor="wp-title" className="mb-1.5 block text-sm font-semibold">Room name</label>
          <input id="wp-title" className="k-input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="wp-ep" className="mb-1.5 block text-sm font-semibold">What to watch</label>
          <select id="wp-ep" className="k-input" value={episode} onChange={(e) => setEpisode(e.target.value)}>
            {series.episodes.map((ep) => (
              <option key={ep.id} value={ep.id}>
                {series.title} · {ep.number}. {ep.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">Only media every participant is entitled to stream can be shown. Today that&apos;s the open-licensed demo catalog.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={inviteOnly} onChange={(e) => setInviteOnly(e.target.checked)} className="accent-[var(--k-primary)]" /> Friends &amp; invited people only
        </label>
        <button className="k-btn k-btn-primary w-full" disabled={busy}>
          {busy ? "Opening room…" : "Create room"}
        </button>
      </form>

      <section aria-labelledby="rooms-h">
        <h2 id="rooms-h" className="font-display text-section mb-4">Rooms you can join</h2>
        {rooms.isLoading && <Skeleton className="h-40" />}
        {rooms.data?.length === 0 && <EmptyState icon={<Users className="size-6" />} jp="宴" title="No open rooms right now" body="Rooms hosted by your friends, or ones you were invited to, show up here." />}
        <ul className="grid gap-3 sm:grid-cols-2">
          {rooms.data?.map((r) => {
            const ep = series.episodes.find((e) => e.id === r.episode_id);
            return (
              <li key={r.id}>
                <Link href={`/watch-parties/${r.id}`} className="k-card flex h-full flex-col gap-2 p-4 transition-shadow hover:shadow-[var(--k-hover-glow)]">
                  <span className="flex items-center gap-2">
                    {r.is_playing && <Radio className="size-4 animate-pulse text-danger" aria-label="Playing now" />}
                    <span className="truncate font-semibold">{r.title}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {ep ? `${ep.number}. ${ep.title}` : r.episode_id} · hosted by {r.host_id === me ? "you" : (r.host?.display_name || r.host?.username)}
                  </span>
                  <span className="text-xs text-muted">opened {now ? relativeTime(new Date(r.created_at).getTime(), now) : ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
