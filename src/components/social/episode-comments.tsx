"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { friendlyDbError } from "@/lib/social";
import { useAuth } from "@/stores/auth";
import { CommentThread } from "./comments";
import { AnimeComments } from "./anime-comments";

/**
 * Comentarios de un episodio, compartidos entre todos los usuarios.
 *
 * Cada episodio tiene su hilo: un debate (public.discussions) con
 * media_snapshot = { kind: "episode", episode: N, ... }. Lo crea quien comenta primero;
 * los comentarios van a public.comments con target_type "discussion". Así no hace falta
 * cambiar el esquema de la base de datos.
 */
type Thread = { id: string };

function threadKey(mediaId: number, episode: number) {
  return ["episode-thread", mediaId, episode] as const;
}

function useEpisodeThread(mediaId: number, episode: number) {
  return useQuery({
    queryKey: threadKey(mediaId, episode),
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
    queryFn: async (): Promise<Thread | null> => {
      const { data, error } = await getSupabaseBrowser()!
        .from("discussions")
        .select("id")
        .eq("media_id", mediaId)
        .eq("media_snapshot->>kind", "episode")
        .eq("media_snapshot->>episode", String(episode))
        .in("status", ["published", "locked"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Thread | null;
    },
  });
}

function FirstComment({ mediaId, episode, animeTitle, cover }: { mediaId: number; episode: number; animeTitle: string; cover?: string | null }) {
  const me = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const m = useMutation({
    mutationFn: async () => {
      const db = getSupabaseBrowser()!;
      // Si alguien creó el hilo mientras escribías, se usa ese.
      const existing = await db
        .from("discussions")
        .select("id")
        .eq("media_id", mediaId)
        .eq("media_snapshot->>kind", "episode")
        .eq("media_snapshot->>episode", String(episode))
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      let threadId = (existing.data as Thread | null)?.id;
      if (!threadId) {
        const title = `Episodio ${episode} · ${animeTitle}`.slice(0, 140);
        const { data, error } = await db
          .from("discussions")
          .insert({
            user_id: me,
            media_id: mediaId,
            media_snapshot: { kind: "episode", episode: String(episode), title: animeTitle, cover: cover ?? null },
            title: title.length >= 4 ? title : `Episodio ${episode}`,
            body: `Comentarios del episodio ${episode} de ${animeTitle}.`,
            has_spoilers: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        threadId = (data as Thread).id;
      }
      const { error: cErr } = await db.from("comments").insert({ user_id: me, target_type: "discussion", target_id: threadId, body: body.trim(), has_spoilers: spoiler });
      if (cErr) throw cErr;
      return threadId;
    },
    onSuccess: (threadId) => {
      setBody("");
      setSpoiler(false);
      qc.setQueryData(threadKey(mediaId, episode), { id: threadId });
      qc.invalidateQueries({ queryKey: ["comments", "discussion", threadId] });
    },
    onError: (e) => toast.error(friendlyDbError(e)),
  });

  return (
    <div>
      <p className="flex items-center gap-2 py-2 text-sm text-muted">
        <MessageSquare className="size-4" aria-hidden /> Aún no hay comentarios en este episodio. ¡Sé el primero!
      </p>
      {me ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) m.mutate();
          }}
        >
          <label className="sr-only" htmlFor={`ep-${mediaId}-${episode}`}>Comentario</label>
          <textarea
            id={`ep-${mediaId}-${episode}`}
            className="k-input !min-h-16 text-sm"
            maxLength={4000}
            placeholder="¿Qué te pareció el episodio?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="accent-[var(--k-primary)]" /> Contiene spoilers
            </label>
            <button type="submit" className="k-btn k-btn-primary k-btn-sm ml-auto" disabled={!body.trim() || m.isPending}>
              {m.isPending ? "Publicando…" : "Comentar"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-muted">
          <Link href="/login" className="font-semibold text-primary-ink">Inicia sesión</Link> para comentar el episodio.
        </p>
      )}
    </div>
  );
}

export function EpisodeComments({
  seriesId,
  episodeId,
  episodeNumber,
  animeTitle,
  cover,
}: {
  seriesId: string;
  episodeId: string;
  episodeNumber: number;
  animeTitle: string;
  cover?: string | null;
}) {
  const mediaId = /^\d+$/.test(seriesId) ? Number(seriesId) : null;
  // Series de demostración (sin id de AniList) o sin Supabase: se mantienen los comentarios locales.
  const usable = isSupabaseConfigured && mediaId != null && Number.isFinite(episodeNumber) && episodeNumber > 0;
  const thread = useEpisodeThread(mediaId ?? 0, episodeNumber);

  if (!usable) return <AnimeComments seriesId={seriesId} episodeId={episodeId} animeTitle={animeTitle} />;

  return (
    <section aria-labelledby="ep-comments-h" className="k-card mt-6 p-5">
      <h2 id="ep-comments-h" className="font-display text-xl">
        Comentarios · Episodio {episodeNumber}
      </h2>
      <p className="mt-1 text-xs text-muted">Sé amable y marca los spoilers. Los comentarios se pueden reportar.</p>
      <div className="mt-3">
        {thread.isLoading ? (
          <div className="k-skeleton h-20 rounded-xl" />
        ) : thread.data ? (
          <CommentThread targetType="discussion" targetId={thread.data.id} />
        ) : (
          <FirstComment mediaId={mediaId!} episode={episodeNumber} animeTitle={animeTitle} cover={cover} />
        )}
      </div>
    </section>
  );
}
