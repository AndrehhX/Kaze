"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { COMMENT_SELECT, friendlyDbError, type Comment } from "@/lib/social";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/shell/user-menu";
import { Spoiler } from "./spoiler";
import { ReportButton } from "./report";
import { relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/primitives";

export function useComments(targetType: "review" | "discussion", targetId: string, enabled = true) {
  return useQuery({
    queryKey: ["comments", targetType, targetId],
    enabled,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()!.from("comments").select(COMMENT_SELECT).eq("target_type", targetType).eq("target_id", targetId).eq("status", "published").order("created_at").limit(200);
      if (error) throw error;
      return data as unknown as Comment[];
    },
  });
}

export function CommentComposer({ targetType, targetId, parentId, onDone, autoFocus }: { targetType: "review" | "discussion"; targetId: string; parentId?: string; onDone?: () => void; autoFocus?: boolean }) {
  const me = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseBrowser()!.from("comments").insert({ user_id: me, target_type: targetType, target_id: targetId, parent_id: parentId ?? null, body: body.trim(), has_spoilers: spoiler });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      setSpoiler(false);
      qc.invalidateQueries({ queryKey: ["comments", targetType, targetId] });
      onDone?.();
    },
    onError: (e) => toast.error(friendlyDbError(e)),
  });
  if (!me) return <p className="text-xs text-muted"><Link href="/login" className="font-semibold text-primary-ink">Sign in</Link> to join the conversation.</p>;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) m.mutate();
      }}
    >
      <label className="sr-only" htmlFor={`c-${targetId}-${parentId ?? "root"}`}>
        {parentId ? "Reply" : "Comment"}
      </label>
      <textarea
        id={`c-${targetId}-${parentId ?? "root"}`}
        autoFocus={autoFocus}
        className="k-input !min-h-16 text-sm"
        maxLength={4000}
        placeholder={parentId ? "Write a reply…" : "Add a comment…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="accent-[var(--k-primary)]" /> Contains spoilers
        </label>
        <button type="submit" className="k-btn k-btn-primary k-btn-sm ml-auto" disabled={!body.trim() || m.isPending}>
          {m.isPending ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
      </div>
    </form>
  );
}

export function CommentThread({ targetType, targetId }: { targetType: "review" | "discussion"; targetId: string }) {
  const { data, isLoading, error } = useComments(targetType, targetId);
  const me = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  const now = useNow();
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const remove = async (id: string) => {
    const { error } = await getSupabaseBrowser()!.from("comments").delete().eq("id", id);
    if (error) toast.error(friendlyDbError(error));
    else qc.invalidateQueries({ queryKey: ["comments", targetType, targetId] });
  };

  if (isLoading) return <Skeleton className="h-20" />;
  if (error) return <p className="text-sm text-danger">Couldn&apos;t load comments.</p>;
  const roots = (data ?? []).filter((c) => !c.parent_id);
  const replies = (id: string) => (data ?? []).filter((c) => c.parent_id === id);

  const Item = ({ c, depth }: { c: Comment; depth: number }) => {
    const name = c.author?.display_name || c.author?.username || "Member";
    return (
      <li className={depth ? "ml-6 border-l border-line pl-4" : ""}>
        <div className="flex gap-3 py-3">
          <Avatar src={c.author?.avatar_url} name={name} size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-xs">
              {c.author ? (
                <Link href={`/profile/${c.author.username}`} className="font-semibold hover:text-primary-ink">
                  {name}
                </Link>
              ) : (
                name
              )}{" "}
              <span className="text-muted">{now ? relativeTime(new Date(c.created_at).getTime(), now) : ""}</span>
            </p>
            <Spoiler active={c.has_spoilers}>
              <p className="mt-1 whitespace-pre-line break-words text-sm">{c.body}</p>
            </Spoiler>
            <div className="mt-1 flex items-center gap-1">
              {me && depth === 0 && (
                <button className="k-btn k-btn-ghost k-btn-sm !min-h-8 text-xs" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                  <CornerDownRight className="size-3.5" aria-hidden /> Reply
                </button>
              )}
              {me === c.user_id ? (
                <button className="k-btn k-btn-ghost k-btn-sm !min-h-8 text-xs text-muted" onClick={() => remove(c.id)}>
                  <Trash2 className="size-3.5" aria-hidden /> Delete
                </button>
              ) : (
                <ReportButton targetType="comment" targetId={c.id} />
              )}
            </div>
            {replyTo === c.id && (
              <div className="mt-2">
                <CommentComposer targetType={targetType} targetId={targetId} parentId={c.id} onDone={() => setReplyTo(null)} autoFocus />
              </div>
            )}
          </div>
        </div>
        {replies(c.id).length > 0 && (
          <ul>
            {replies(c.id).map((r) => (
              <Item key={r.id} c={r} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div>
      {roots.length === 0 && (
        <p className="flex items-center gap-2 py-2 text-sm text-muted">
          <MessageSquare className="size-4" aria-hidden /> No comments yet.
        </p>
      )}
      <ul className="divide-y divide-line">
        {roots.map((c) => (
          <Item key={c.id} c={c} depth={0} />
        ))}
      </ul>
      <div className="mt-3">
        <CommentComposer targetType={targetType} targetId={targetId} />
      </div>
    </div>
  );
}
