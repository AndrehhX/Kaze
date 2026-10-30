"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageSquare, PenLine, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { friendlyDbError, REVIEW_SELECT, type Review } from "@/lib/social";
import type { MediaSnapshot } from "@/lib/library/types";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/shell/user-menu";
import { EmptyState, ErrorPanel, SafeImage, Skeleton } from "@/components/ui/primitives";
import { Spoiler } from "./spoiler";
import { ReportButton } from "./report";
import { CommentThread } from "./comments";
import { BackendMissing } from "./gate";
import { cn, relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import { isSupabaseConfigured } from "@/lib/env";

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Pick a rating").max(10),
  title: z.string().trim().min(3, "Title needs at least 3 characters").max(120),
  body: z.string().trim().min(40, "Write at least 40 characters").max(10000),
  has_spoilers: z.boolean(),
});

export function useReviews(opts: { mediaId?: number; sort: "recent" | "top"; limit?: number }) {
  return useQuery({
    queryKey: ["reviews", opts],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      let q = getSupabaseBrowser()!.from("reviews").select(REVIEW_SELECT).eq("status", "published");
      if (opts.mediaId) q = q.eq("media_id", opts.mediaId);
      q = opts.sort === "top" ? q.order("like_count", { ascending: false }).order("created_at", { ascending: false }) : q.order("created_at", { ascending: false });
      const { data, error } = await q.limit(opts.limit ?? 20);
      if (error) throw error;
      return data as unknown as Review[];
    },
  });
}

function useMyLikes(ids: string[]) {
  const me = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: ["review-likes", me, ids],
    enabled: Boolean(me && ids.length),
    queryFn: async () => {
      const { data } = await getSupabaseBrowser()!.from("review_reactions").select("review_id").eq("user_id", me!).in("review_id", ids);
      return new Set((data ?? []).map((r: { review_id: string }) => r.review_id));
    },
  });
}

export function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating out of 10" className="flex flex-wrap gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 10`}
          onClick={() => onChange(n)}
          className={cn("grid size-9 place-items-center rounded-[min(var(--k-radius-btn),8px)] text-sm font-bold tabular-nums transition-colors", n <= value ? "k-btn-primary" : "bg-[var(--k-btn-ghost)] text-muted")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function ReviewComposer({ mediaId, snapshot, onDone, existing }: { mediaId: number; snapshot: Partial<MediaSnapshot>; onDone?: () => void; existing?: Review | null }) {
  const me = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  const [form, setForm] = useState({ rating: existing?.rating ?? 0, title: existing?.title ?? "", body: existing?.body ?? "", has_spoilers: existing?.has_spoilers ?? false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: async () => {
      const parsed = reviewSchema.safeParse(form);
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
        throw new Error("validation");
      }
      setErrors({});
      const db = getSupabaseBrowser()!;
      const { error } = existing
        ? await db.from("reviews").update({ ...parsed.data, media_snapshot: snapshot }).eq("id", existing.id)
        : await db.from("reviews").insert({ ...parsed.data, user_id: me, media_id: mediaId, media_snapshot: snapshot });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(existing ? "Review updated" : "Review published");
      qc.invalidateQueries({ queryKey: ["reviews"] });
      onDone?.();
    },
    onError: (e) => e.message !== "validation" && toast.error(friendlyDbError(e)),
  });
  return (
    <form
      className="k-card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      noValidate
    >
      <div>
        <p className="mb-2 text-sm font-semibold">Your rating</p>
        <RatingInput value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} />
        {errors.rating && <p className="mt-1 text-xs text-danger">{errors.rating}</p>}
      </div>
      <div>
        <label htmlFor="rv-title" className="mb-1.5 block text-sm font-semibold">
          Headline
        </label>
        <input id="rv-title" className="k-input" maxLength={120} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} aria-invalid={Boolean(errors.title)} />
        {errors.title && <p className="mt-1 text-xs text-danger">{errors.title}</p>}
      </div>
      <div>
        <label htmlFor="rv-body" className="mb-1.5 block text-sm font-semibold">
          Review
        </label>
        <textarea id="rv-body" className="k-input !min-h-40" maxLength={10000} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} aria-invalid={Boolean(errors.body)} />
        <div className="mt-1 flex justify-between text-xs">
          <span className="text-danger">{errors.body}</span>
          <span className="text-muted tabular-nums">{form.body.trim().length} / 10000</span>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.has_spoilers} onChange={(e) => setForm((f) => ({ ...f, has_spoilers: e.target.checked }))} className="accent-[var(--k-primary)]" />
        This review contains spoilers (readers must reveal it)
      </label>
      <div className="flex justify-end gap-2">
        {onDone && (
          <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={onDone}>
            Cancel
          </button>
        )}
        <button className="k-btn k-btn-primary k-btn-sm" disabled={m.isPending}>
          {m.isPending ? "Publishing…" : existing ? "Save changes" : "Publish review"}
        </button>
      </div>
    </form>
  );
}

export function ReviewCard({ r, liked, showMedia }: { r: Review; liked: boolean; showMedia?: boolean }) {
  const me = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  const now = useNow();
  const [comments, setComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const name = r.author?.display_name || r.author?.username || "Member";

  const toggleLike = async () => {
    if (!me) return toast("Sign in to like reviews");
    const db = getSupabaseBrowser()!;
    const { error } = liked ? await db.from("review_reactions").delete().eq("review_id", r.id).eq("user_id", me) : await db.from("review_reactions").insert({ review_id: r.id, user_id: me });
    if (error) toast.error(friendlyDbError(error));
    qc.invalidateQueries({ queryKey: ["reviews"] });
    qc.invalidateQueries({ queryKey: ["review-likes"] });
  };
  const remove = async () => {
    const { error } = await getSupabaseBrowser()!.from("reviews").delete().eq("id", r.id);
    if (error) toast.error(friendlyDbError(error));
    else {
      toast("Review deleted");
      qc.invalidateQueries({ queryKey: ["reviews"] });
    }
  };

  if (editing) return <ReviewComposer mediaId={r.media_id} snapshot={r.media_snapshot} existing={r} onDone={() => setEditing(false)} />;

  return (
    <article id={r.id} className="k-card scroll-mt-32 p-5">
      <header className="flex items-start gap-3">
        {showMedia && (
          <Link href={`/anime/${r.media_id}`} className="k-poster relative h-20 w-14 shrink-0">
            <SafeImage src={r.media_snapshot.cover ?? ""} alt="" fill sizes="56px" className="object-cover" fallbackLabel={r.media_snapshot.title} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {showMedia && (
            <Link href={`/anime/${r.media_id}`} className="k-label text-primary-ink hover:underline">
              {r.media_snapshot.title}
            </Link>
          )}
          <h3 className="font-display mt-0.5 text-lg leading-tight">{r.title}</h3>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted">
            <Avatar src={r.author?.avatar_url} name={name} size={20} />
            {r.author ? (
              <Link href={`/profile/${r.author.username}`} className="font-semibold text-fg hover:text-primary-ink">
                {name}
              </Link>
            ) : (
              name
            )}
            <span>· {now ? relativeTime(new Date(r.created_at).getTime(), now) : ""}</span>
          </p>
        </div>
        <span className="k-score shrink-0 text-lg" aria-label={`Rated ${r.rating} out of 10`}>
          <Star className="size-4 fill-accent text-accent" aria-hidden />
          {r.rating}
          <span className="text-xs font-normal text-muted">/10</span>
        </span>
      </header>
      <Spoiler active={r.has_spoilers} className="mt-4">
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-fg/90">{r.body}</p>
      </Spoiler>
      <footer className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
        <button className={cn("k-btn k-btn-ghost k-btn-sm", liked && "text-accent")} onClick={toggleLike} aria-pressed={liked} aria-label={liked ? "Unlike review" : "Like review"}>
          <Heart className={cn("size-4", liked && "fill-current")} aria-hidden /> {r.like_count}
        </button>
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setComments((c) => !c)} aria-expanded={comments}>
          <MessageSquare className="size-4" aria-hidden /> {r.comment_count}
        </button>
        <span className="ml-auto" />
        {me === r.user_id ? (
          <>
            <button className="k-btn k-btn-ghost k-btn-sm text-xs" onClick={() => setEditing(true)}>
              <PenLine className="size-3.5" aria-hidden /> Edit
            </button>
            <button className="k-btn k-btn-ghost k-btn-sm text-xs text-muted" onClick={remove}>
              <Trash2 className="size-3.5" aria-hidden /> Delete
            </button>
          </>
        ) : (
          <ReportButton targetType="review" targetId={r.id} />
        )}
      </footer>
      {comments && (
        <div className="mt-3 border-t border-line pt-2">
          <CommentThread targetType="review" targetId={r.id} />
        </div>
      )}
    </article>
  );
}

export function ReviewList({ mediaId, sort = "recent", showMedia, limit }: { mediaId?: number; sort?: "recent" | "top"; showMedia?: boolean; limit?: number }) {
  const { data, isLoading, error } = useReviews({ mediaId, sort, limit });
  const likes = useMyLikes((data ?? []).map((r) => r.id));
  if (!isSupabaseConfigured) return <BackendMissing feature="Community reviews" />;
  if (isLoading) return <Skeleton className="h-40" />;
  if (error) return <ErrorPanel title="Couldn't load reviews" message={(error as Error).message} />;
  if (!data?.length) return <EmptyState icon={<PenLine className="size-6" />} jp="評" title="Aún no hay reseñas en KAZE" body="Sé el primero en escribir una reseña — aquí solo verás opiniones de miembros de la comunidad." />;
  return (
    <div className="grid gap-4">
      {data.map((r) => (
        <ReviewCard key={r.id} r={r} liked={Boolean(likes.data?.has(r.id))} showMedia={showMedia} />
      ))}
    </div>
  );
}

/** Reviews block on an anime page: list + composer for signed-in users. */
export function MediaReviews({ mediaId, snapshot }: { mediaId: number; snapshot: Partial<MediaSnapshot> }) {
  const status = useAuth((s) => s.status);
  const me = useAuth((s) => s.user?.id);
  const [writing, setWriting] = useState(false);
  const mine = useReviews({ mediaId, sort: "recent", limit: 50 }).data?.find((r) => r.user_id === me);
  return (
    <div className="space-y-4">
      {status === "signed-in" && !mine && !writing && (
        <button className="k-btn k-btn-primary k-btn-sm" onClick={() => setWriting(true)}>
          <PenLine className="size-4" aria-hidden /> Write a review
        </button>
      )}
      {status === "signed-out" && (
        <p className="text-sm text-muted">
          <Link href="/login" className="font-semibold text-primary-ink">
            Sign in
          </Link>{" "}
          to write a review.
        </p>
      )}
      {writing && <ReviewComposer mediaId={mediaId} snapshot={snapshot} onDone={() => setWriting(false)} />}
      <ReviewList mediaId={mediaId} />
    </div>
  );
}
