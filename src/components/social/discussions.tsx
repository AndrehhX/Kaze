"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, MessageSquare, MessagesSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { DISCUSSION_SELECT, friendlyDbError, type Discussion } from "@/lib/social";
import type { MediaSnapshot } from "@/lib/library/types";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/shell/user-menu";
import { EmptyState, ErrorPanel, SafeImage, Skeleton } from "@/components/ui/primitives";
import { Spoiler } from "./spoiler";
import { ReportButton } from "./report";
import { CommentThread } from "./comments";
import { BackendMissing } from "./gate";
import { relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import { isSupabaseConfigured } from "@/lib/env";

const schema = z.object({
  title: z.string().trim().min(4, "Title needs at least 4 characters").max(140),
  body: z.string().trim().min(1, "Say something to start the thread").max(8000),
  has_spoilers: z.boolean(),
});

export function useDiscussions(mediaId?: number, limit = 30) {
  return useQuery({
    queryKey: ["discussions", mediaId ?? "all", limit],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      let q = getSupabaseBrowser()!.from("discussions").select(DISCUSSION_SELECT).in("status", ["published", "locked"]);
      if (mediaId) q = q.eq("media_id", mediaId);
      const { data, error } = await q.order("last_activity_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data as unknown as Discussion[];
    },
  });
}

export function DiscussionComposer({ mediaId, snapshot, onDone }: { mediaId?: number; snapshot?: Partial<MediaSnapshot>; onDone?: () => void }) {
  const me = useAuth((s) => s.user?.id);
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", body: "", has_spoilers: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
        throw new Error("validation");
      }
      const { data, error } = await getSupabaseBrowser()!
        .from("discussions")
        .insert({ ...parsed.data, user_id: me, media_id: mediaId ?? null, media_snapshot: snapshot ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["discussions"] });
      toast.success("Discussion started");
      onDone?.();
      router.push(`/community/discussions/${id}`);
    },
    onError: (e) => e.message !== "validation" && toast.error(friendlyDbError(e)),
  });
  return (
    <form
      className="k-card space-y-3 p-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      {snapshot?.title && <p className="k-label text-primary-ink">About {snapshot.title}</p>}
      <div>
        <label htmlFor="d-title" className="mb-1.5 block text-sm font-semibold">
          Title
        </label>
        <input id="d-title" className="k-input" maxLength={140} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} aria-invalid={Boolean(errors.title)} />
        {errors.title && <p className="mt-1 text-xs text-danger">{errors.title}</p>}
      </div>
      <div>
        <label htmlFor="d-body" className="mb-1.5 block text-sm font-semibold">
          Opening post
        </label>
        <textarea id="d-body" className="k-input !min-h-32" maxLength={8000} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} aria-invalid={Boolean(errors.body)} />
        {errors.body && <p className="mt-1 text-xs text-danger">{errors.body}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.has_spoilers} onChange={(e) => setForm((f) => ({ ...f, has_spoilers: e.target.checked }))} className="accent-[var(--k-primary)]" /> Contains spoilers
      </label>
      <div className="flex justify-end gap-2">
        {onDone && (
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={onDone}>
            Cancel
          </button>
        )}
        <button className="k-btn k-btn-primary k-btn-sm" disabled={m.isPending}>
          {m.isPending ? "Posting…" : "Start discussion"}
        </button>
      </div>
    </form>
  );
}

export function DiscussionList({ mediaId, snapshot, limit }: { mediaId?: number; snapshot?: Partial<MediaSnapshot>; limit?: number }) {
  const { data, isLoading, error } = useDiscussions(mediaId, limit);
  const status = useAuth((s) => s.status);
  const [composing, setComposing] = useState(false);
  const now = useNow();
  if (!isSupabaseConfigured) return <BackendMissing feature="Community discussions" />;
  return (
    <div className="space-y-4">
      {status === "signed-in" &&
        (composing ? (
          <DiscussionComposer mediaId={mediaId} snapshot={snapshot} onDone={() => setComposing(false)} />
        ) : (
          <button className="k-btn k-btn-primary k-btn-sm" onClick={() => setComposing(true)}>
            <Plus className="size-4" aria-hidden /> New discussion
          </button>
        ))}
      {isLoading && <Skeleton className="h-32" />}
      {error && <ErrorPanel title="Couldn't load discussions" message={(error as Error).message} />}
      {data && !data.length && <EmptyState icon={<MessagesSquare className="size-6" />} jp="話" title="Aún no hay debates" body="Start the first thread — theories, favourite moments, episode reactions." />}
      {data && data.length > 0 && (
        <ul className="k-card divide-y divide-line">
          {data.map((d) => (
            <li key={d.id}>
              <Link href={`/community/discussions/${d.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--k-btn-ghost)]">
                {!mediaId && d.media_snapshot?.cover ? (
                  <div className="k-poster relative h-14 w-10 shrink-0">
                    <SafeImage src={d.media_snapshot.cover} alt="" fill sizes="40px" className="object-cover" />
                  </div>
                ) : (
                  <MessageSquare className="size-5 shrink-0 text-primary-ink" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {d.status === "locked" && <Lock className="mr-1 inline size-3.5" aria-label="Locked" />}
                    {d.title}
                    {d.has_spoilers && <span className="ml-2 rounded bg-danger/15 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-danger">Spoilers</span>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {d.author?.display_name || d.author?.username} · {d.media_snapshot?.title ? `${d.media_snapshot.title} · ` : ""}
                    active {now ? relativeTime(new Date(d.last_activity_at).getTime(), now) : ""}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-sm text-muted">
                  <MessageSquare className="size-4" aria-hidden /> {d.comment_count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DiscussionThread({ id }: { id: string }) {
  const me = useAuth((s) => s.user?.id);
  const router = useRouter();
  const now = useNow();
  const { data, isLoading, error } = useQuery({
    queryKey: ["discussion", id],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()!.from("discussions").select(DISCUSSION_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return data as unknown as Discussion | null;
    },
  });
  if (!isSupabaseConfigured) return <BackendMissing feature="Community discussions" />;
  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorPanel title="Couldn't load this discussion" message={(error as Error).message} />;
  if (!data) return <EmptyState title="Debate no encontrado" body="It may have been removed, or you may not have access." action={<Link href="/community/discussions" className="k-btn k-btn-outline k-btn-sm">All discussions</Link>} />;
  const name = data.author?.display_name || data.author?.username || "Member";
  const remove = async () => {
    const { error } = await getSupabaseBrowser()!.from("discussions").delete().eq("id", id);
    if (error) toast.error(friendlyDbError(error));
    else router.push("/community/discussions");
  };
  return (
    <article className="space-y-6">
      <header className="k-card p-6">
        {data.media_id && (
          <Link href={`/anime/${data.media_id}`} className="k-label text-primary-ink hover:underline">
            {data.media_snapshot?.title ?? "Anime"}
          </Link>
        )}
        <h1 className="font-display text-title mt-2">{data.title}</h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Avatar src={data.author?.avatar_url} name={name} size={24} />
          {data.author ? (
            <Link href={`/profile/${data.author.username}`} className="font-semibold text-fg">
              {name}
            </Link>
          ) : (
            name
          )}
          · {now ? relativeTime(new Date(data.created_at).getTime(), now) : ""}
        </p>
        <Spoiler active={data.has_spoilers} className="mt-5">
          <p className="whitespace-pre-line break-words leading-relaxed">{data.body}</p>
        </Spoiler>
        <div className="mt-4 flex justify-end">
          {me === data.user_id ? (
            <button className="k-btn k-btn-ghost k-btn-sm text-xs text-muted" onClick={remove}>
              <Trash2 className="size-3.5" aria-hidden /> Delete
            </button>
          ) : (
            <ReportButton targetType="discussion" targetId={data.id} />
          )}
        </div>
      </header>
      <section aria-label="Replies" className="k-card p-5">
        <h2 className="font-display text-lg">Replies · {data.comment_count}</h2>
        {data.status === "locked" ? <p className="mt-2 text-sm text-muted">This thread is locked by a moderator.</p> : <CommentThread targetType="discussion" targetId={data.id} />}
      </section>
    </article>
  );
}
