"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, EyeOff, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/social";
import { useAuth } from "@/stores/auth";
import { AuthGate } from "./gate";
import { EmptyState, ErrorPanel, Skeleton } from "@/components/ui/primitives";
import { cn, relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";

type Report = {
  id: string;
  target_type: "review" | "discussion" | "comment" | "profile" | "watch_party_message";
  target_id: string;
  reason: string;
  details: string;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  created_at: string;
  reporter: { username: string } | null;
};

const TABLE: Partial<Record<Report["target_type"], string>> = { review: "reviews", discussion: "discussions", comment: "comments" };

export function useIsModerator() {
  const me = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: ["is-moderator", me],
    enabled: Boolean(me),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // RLS: a user can only see their own moderators row.
      const { data } = await getSupabaseBrowser()!.from("moderators").select("user_id").eq("user_id", me!).maybeSingle();
      return Boolean(data);
    },
  });
}

export function ModerationConsole() {
  return (
    <AuthGate feature="moderation">
      <Gate />
    </AuthGate>
  );
}

function Gate() {
  const mod = useIsModerator();
  if (mod.isLoading) return <Skeleton className="mt-8 h-48" />;
  if (!mod.data)
    return <EmptyState className="mt-8" icon={<ShieldCheck className="size-6" />} jp="守" title="Moderators only" body="Moderator access is granted by an administrator (a row in the moderators table)." />;
  return <Queue />;
}

function Target({ r }: { r: Report }) {
  const table = TABLE[r.target_type];
  const { data, isLoading } = useQuery({
    queryKey: ["mod-target", r.target_type, r.target_id],
    enabled: Boolean(table),
    queryFn: async () => {
      const cols = r.target_type === "review" ? "title, body, status, media_id" : r.target_type === "discussion" ? "title, body, status" : "body, status, target_type, target_id";
      const { data } = await getSupabaseBrowser()!.from(table!).select(cols).eq("id", r.target_id).maybeSingle();
      return data as { title?: string; body: string; status: string; media_id?: number; target_type?: string; target_id?: string } | null;
    },
  });
  if (r.target_type === "profile") return <p className="text-sm text-muted">Profile id {r.target_id}</p>;
  if (r.target_type === "watch_party_message") return <p className="text-sm text-muted">Watch-party message {r.target_id} (messages are visible to room members only)</p>;
  if (isLoading) return <Skeleton className="h-12" />;
  if (!data) return <p className="text-sm text-muted">The content no longer exists.</p>;
  const href = r.target_type === "discussion" ? `/community/discussions/${r.target_id}` : r.target_type === "review" ? `/community/reviews#${r.target_id}` : data.target_type === "discussion" ? `/community/discussions/${data.target_id}` : `/community/reviews#${data.target_id}`;
  return (
    <div className="rounded-[min(var(--k-radius-card),12px)] bg-[var(--k-btn-ghost)] p-3 text-sm">
      {data.title && <p className="font-semibold">{data.title}</p>}
      <p className="clamp-3 whitespace-pre-line break-words text-fg/85">{data.body}</p>
      <p className="mt-2 text-xs text-muted">
        Status: <span className={cn(data.status !== "published" && "font-semibold text-danger")}>{data.status}</span> ·{" "}
        <Link href={href} className="underline">
          open in context
        </Link>
      </p>
    </div>
  );
}

function Queue() {
  const qc = useQueryClient();
  const now = useNow();
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const reports = useQuery({
    queryKey: ["reports", filter],
    queryFn: async () => {
      const q = getSupabaseBrowser()!
        .from("reports")
        .select("id, target_type, target_id, reason, details, status, created_at, reporter:profiles!reports_reporter_id_fkey(username)")
        .order("created_at", { ascending: filter === "open" })
        .limit(100);
      const { data, error } = await (filter === "open" ? q.in("status", ["open", "reviewing"]) : q.in("status", ["actioned", "dismissed"]));
      if (error) throw error;
      return data as unknown as Report[];
    },
  });

  const act = useMutation({
    mutationFn: async ({ r, action }: { r: Report; action: "hide" | "restore" | "dismiss" }) => {
      const db = getSupabaseBrowser()!;
      const table = TABLE[r.target_type];
      if (action !== "dismiss" && table) {
        const { error } = await db.from(table).update({ status: action === "hide" ? "hidden" : "published" }).eq("id", r.target_id);
        if (error) throw error;
      }
      const { error } = await db.from("reports").update({ status: action === "dismiss" ? "dismissed" : "actioned" }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.action === "hide" ? "Content hidden and report closed" : v.action === "restore" ? "Content restored" : "Report dismissed");
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["mod-target"] });
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["discussions"] });
    },
    onError: (e) => toast.error(friendlyDbError(e)),
  });

  return (
    <div className="mt-8 max-w-4xl">
      <div className="mb-4 flex gap-1.5" role="group" aria-label="Report status">
        <button className="k-chip" aria-pressed={filter === "open"} onClick={() => setFilter("open")}>Open</button>
        <button className="k-chip" aria-pressed={filter === "closed"} onClick={() => setFilter("closed")}>Resolved</button>
      </div>
      {reports.isLoading && <Skeleton className="h-48" />}
      {reports.error && <ErrorPanel message={(reports.error as Error).message} />}
      {reports.data?.length === 0 && <EmptyState jp="静" title={filter === "open" ? "No open reports" : "Nothing resolved yet"} body="The queue is clear." />}
      <ul className="space-y-4">
        {reports.data?.map((r) => (
          <li key={r.id} className="k-card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="k-chip !min-h-6 capitalize">{r.target_type.replace(/_/g, " ")}</span>
              <span className="k-chip !min-h-6 border-danger/50 capitalize text-danger">{r.reason}</span>
              <span className="text-muted">
                by @{r.reporter?.username ?? "unknown"} · {now ? relativeTime(new Date(r.created_at).getTime(), now) : ""}
              </span>
              <span className="ml-auto font-semibold capitalize">{r.status}</span>
            </div>
            <Target r={r} />
            {r.details && <p className="mt-2 text-sm text-muted">“{r.details}”</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {TABLE[r.target_type] && (
                <>
                  <button className="k-btn k-btn-sm bg-danger text-white" disabled={act.isPending} onClick={() => act.mutate({ r, action: "hide" })}>
                    <EyeOff className="size-4" aria-hidden /> Hide content
                  </button>
                  {filter === "closed" && (
                    <button className="k-btn k-btn-outline k-btn-sm" disabled={act.isPending} onClick={() => act.mutate({ r, action: "restore" })}>
                      <Check className="size-4" aria-hidden /> Restore
                    </button>
                  )}
                </>
              )}
              {filter === "open" && (
                <button className="k-btn k-btn-ghost k-btn-sm" disabled={act.isPending} onClick={() => act.mutate({ r, action: "dismiss" })}>
                  <X className="size-4" aria-hidden /> Dismiss
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
