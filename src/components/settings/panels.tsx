"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, CloudDownload, CloudUpload, ExternalLink, Loader2, LogOut, RefreshCw, Trash2, Unlink } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { THEME_IDS, THEMES } from "@/lib/themes";
import { useSettings, type MotionPref } from "@/stores/settings";
import { useAuth } from "@/stores/auth";
import { useLibrary } from "@/stores/library";
import { ThemePreviewCard, useThemeSwitch } from "@/components/shell/theme-switcher";
import { AuthGate } from "@/components/social/gate";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { refreshProfile } from "@/components/providers/auth-provider";
import { friendlyDbError } from "@/lib/social";
import { passwordSchema } from "@/components/auth/auth-forms";
import { signOut } from "@/components/shell/user-menu";
import { reconcile, fuzzyToIso, type RemoteEntry, type SyncDecision } from "@/lib/library/sync";
import { snapshotFromMedia, type LibraryEntry } from "@/lib/library/types";
import type { AniListListEntry } from "@/lib/anilist/types";
import { cn, relativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks";

export function Panel({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="k-card mb-6 p-5 sm:p-6">
      <h2 className="font-display text-lg">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Switch({ id, label, description, checked, onChange, disabled }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-primary" : "bg-line")}
      >
        <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-[left]", checked ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}

export function SettingsOverview() {
  const status = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const theme = useSettings((s) => s.theme);
  const cards = [
    { href: "/settings/appearance", title: "Appearance", body: `${THEMES[theme].name} · motion & effects` },
    { href: "/settings/account", title: "Account", body: status === "signed-in" ? `Signed in as @${profile?.username ?? "…"}` : status === "unconfigured" ? "Accounts not configured" : "Not signed in" },
    { href: "/settings/privacy", title: "Privacy", body: profile ? `Profile is ${profile.visibility}` : "Profile visibility & activity sharing" },
    { href: "/settings/integrations", title: "Integrations", body: "Connect AniList, import & sync your list" },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {cards.map((c) => (
        <li key={c.href}>
          <Link href={c.href} className="k-card group flex h-full flex-col justify-between p-5 transition-shadow hover:shadow-[var(--k-hover-glow)]">
            <span className="font-display text-lg">{c.title}</span>
            <span className="mt-2 flex items-end justify-between gap-2 text-sm text-muted">
              {c.body} <ArrowUpRight className="size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AppearanceSettings() {
  const theme = useSettings((s) => s.theme);
  const motion = useSettings((s) => s.motion);
  const setMotion = useSettings((s) => s.setMotion);
  const ambient = useSettings((s) => s.ambientEffects);
  const setAmbient = useSettings((s) => s.setAmbientEffects);
  const signedIn = useAuth((s) => s.status === "signed-in");
  const { switchTo, overlay } = useThemeSwitch();
  return (
    <>
      <Panel title="Theme" description={signedIn ? "Your theme follows your account to every device." : "Saved on this device. Sign in to carry it across devices."}>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_IDS.map((id) => (
            <button
              key={id}
              className="group rounded-[var(--k-radius-card)] text-left"
              aria-pressed={theme === id}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                switchTo(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
              }}
            >
              <ThemePreviewCard id={id} active={theme === id} />
              <span className="mt-2 block px-1 text-xs text-muted">{THEMES[id].tagline}</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Motion" description="Animations communicate state; you decide how much of it you want.">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Motion preference">
          {(
            [
              ["system", "Follow system", "Respects your OS “reduce motion” setting"],
              ["reduce", "Reduced", "Fades only, no movement"],
              ["full", "Full", "All cinematic transitions"],
            ] as [MotionPref, string, string][]
          ).map(([v, l, d]) => (
            <button key={v} role="radio" aria-checked={motion === v} onClick={() => setMotion(v)} className={cn("k-card p-3 text-left", motion === v && "ring-2 ring-primary")}>
              <span className="flex items-center justify-between text-sm font-semibold">
                {l} {motion === v && <Check className="size-4 text-primary-ink" aria-hidden />}
              </span>
              <span className="mt-1 block text-xs text-muted">{d}</span>
            </button>
          ))}
        </div>
        <Switch id="ambient-fx" label="Ambient effects" description="Sakura petals, light trails and scan sweeps in the background." checked={ambient} onChange={setAmbient} />
      </Panel>
      {overlay}
    </>
  );
}

export function AccountSettings() {
  return (
    <AuthGate feature="account settings">
      <AccountInner />
    </AuthGate>
  );
}

function AccountInner() {
  const user = useAuth((s) => s.user)!;
  const sp = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(user.email ?? "");
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmOthers, setConfirmOthers] = useState(false);
  const reset = sp.get("reset") === "1";
  const db = getSupabaseBrowser()!;

  const updateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("email");
    const { error } = await db.auth.updateUser({ email }, { emailRedirectTo: `${location.origin}/auth/callback?next=/settings/account` });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success("Check both inboxes to confirm the change");
  };
  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = passwordSchema.safeParse(pw);
    if (!p.success) return setPwErr(p.error.issues[0].message);
    setPwErr("");
    setBusy("pw");
    const { error } = await db.auth.updateUser({ password: pw });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      setPw("");
      toast.success("Password updated");
      if (reset) router.replace("/settings/account");
    }
  };
  const deleteAccount = async () => {
    setBusy("delete");
    const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: confirmText }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? "Deletion failed");
    toast.success(body.note ?? "Your account was deleted");
    await db.auth.signOut();
    localStorage.removeItem("kaze:library");
    localStorage.removeItem("kaze:progress");
    router.replace("/");
  };

  return (
    <>
      {reset && <p className="mb-6 rounded-[var(--k-radius-card)] bg-primary/15 p-4 text-sm">You followed a password reset link. Choose a new password below.</p>}
      <Panel title="Email" description={user.emailConfirmed ? "Verified" : "Not yet verified — check your inbox."}>
        <form onSubmit={updateEmail} className="flex flex-wrap gap-2">
          <label htmlFor="acc-email" className="sr-only">Email</label>
          <input id="acc-email" type="email" className="k-input flex-1" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button className="k-btn k-btn-outline" disabled={busy === "email" || email === user.email}>
            {busy === "email" && <Loader2 className="size-4 animate-spin" />} Update
          </button>
        </form>
      </Panel>
      <Panel title="Password">
        <form onSubmit={updatePassword} className="space-y-2">
          <label htmlFor="acc-pw" className="text-sm font-semibold">New password</label>
          <div className="flex flex-wrap gap-2">
            <input id="acc-pw" type="password" className="k-input flex-1" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" aria-invalid={Boolean(pwErr)} />
            <button className="k-btn k-btn-outline" disabled={busy === "pw" || !pw}>
              {busy === "pw" && <Loader2 className="size-4 animate-spin" />} Change password
            </button>
          </div>
          {pwErr ? <p className="text-xs text-danger">{pwErr}</p> : <p className="text-xs text-muted">8+ characters with a letter and a number.</p>}
        </form>
      </Panel>
      <Panel title="Sessions" description="Sign out everywhere else if you used a shared or lost device.">
        <div className="flex flex-wrap gap-2">
          <button className="k-btn k-btn-outline k-btn-sm" onClick={() => setConfirmOthers(true)}>
            Sign out other devices
          </button>
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => signOut().then(() => router.replace("/"))}>
            <LogOut className="size-4" aria-hidden /> Sign out here
          </button>
        </div>
      </Panel>
      <Panel title="Delete account" description="Permanently removes your profile, library, reviews, comments, friends and connected accounts. This can't be undone.">
        <button className="k-btn k-btn-sm bg-danger text-white" onClick={() => setDel(true)}>
          <Trash2 className="size-4" aria-hidden /> Delete my account
        </button>
      </Panel>
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title="Sign out other devices?"
        body="Every other browser signed in to this account will be signed out."
        confirmLabel="Sign them out"
        onConfirm={async () => {
          const { error } = await db.auth.signOut({ scope: "others" });
          setConfirmOthers(false);
          if (error) toast.error(error.message);
          else toast.success("Other sessions signed out");
        }}
      />
      <Dialog open={del} onOpenChange={setDel} title="Delete your account?" description="Type DELETE to confirm.">
        <div className="space-y-3 px-5 pb-5 pt-2">
          <label htmlFor="del-confirm" className="sr-only">Type DELETE</label>
          <input id="del-confirm" className="k-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" autoComplete="off" />
          <div className="flex justify-end gap-2">
            <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setDel(false)}>Cancel</button>
            <button className="k-btn k-btn-sm bg-danger text-white" disabled={confirmText !== "DELETE" || busy === "delete"} onClick={deleteAccount}>
              {busy === "delete" ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function PrivacySettings() {
  const gamification = useSettings((s) => s.gamification);
  const setGamification = useSettings((s) => s.setGamification);
  return (
    <>
      <AuthGate feature="privacy settings">
        <PrivacyInner />
      </AuthGate>
      <Panel title="Gamification" description="Badges, milestones and seasonal goals. Entirely optional — no streak pressure, ever.">
        <Switch id="gami" label="Show achievements & celebrations" checked={gamification} onChange={setGamification} />
      </Panel>
    </>
  );
}

function PrivacyInner() {
  const profile = useAuth((s) => s.profile);
  const [saving, setSaving] = useState(false);
  if (!profile) return <div className="k-skeleton mb-6 h-64" />;
  const save = async (patch: Partial<typeof profile>) => {
    setSaving(true);
    const { error } = await getSupabaseBrowser()!.from("profiles").update(patch).eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(friendlyDbError(error));
    await refreshProfile();
    toast.success("Privacy updated");
  };
  return (
    <Panel title="Profile & activity" description="Enforced on the server by row-level security — not just hidden in the UI.">
      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-semibold">Who can see your profile</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["public", "friends", "private"] as const).map((v) => (
            <button key={v} disabled={saving} aria-pressed={profile.visibility === v} onClick={() => save({ visibility: v })} className={cn("k-card p-3 text-left text-sm", profile.visibility === v && "ring-2 ring-primary")}>
              <span className="font-semibold capitalize">{v}</span>
              <span className="mt-1 block text-xs text-muted">{v === "public" ? "Anyone, including signed-out visitors" : v === "friends" ? "Only accepted friends" : "Only you (friends see your name)"}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="divide-y divide-line">
        <Switch id="p-lists" label="Share my anime lists" checked={profile.show_lists} onChange={(v) => save({ show_lists: v })} disabled={saving} />
        <Switch id="p-hist" label="Share my watch history" description="Continue-watching progress on the demo player." checked={profile.show_watch_history} onChange={(v) => save({ show_watch_history: v })} disabled={saving} />
        <Switch id="p-favs" label="Share my favorites" checked={profile.show_favorites} onChange={(v) => save({ show_favorites: v })} disabled={saving} />
        <Switch id="p-act" label="Share my activity" description="Started, completed, rated and reviewed events in friends' feeds." checked={profile.show_activity} onChange={(v) => save({ show_activity: v })} disabled={saving} />
        <Switch id="p-online" label="Show when I'm online" description="Off by default." checked={profile.show_online_status} onChange={(v) => save(v ? { show_online_status: true } : { show_online_status: false, last_seen_at: null } as Partial<typeof profile>)} disabled={saving} />
      </div>
      <p className="mt-4 text-xs text-muted">
        Blocked users can&apos;t see your profile, reviews or comments. Manage blocks in <Link href="/friends" className="underline">Friends</Link>.
      </p>
    </Panel>
  );
}

type Status = { configured: boolean; account: { external_username: string; external_avatar_url: string | null; connected_at: string; last_synced_at: string | null; last_sync_status: string | null; last_sync_message: string | null } | null };

function remoteFromAniList(e: AniListListEntry): RemoteEntry {
  return {
    mediaId: e.mediaId,
    status: e.status,
    progress: e.progress,
    score: e.score || null,
    notes: e.notes ?? "",
    updatedAt: e.updatedAt * 1000,
    startedAt: fuzzyToIso(e.startedAt),
    completedAt: fuzzyToIso(e.completedAt),
    repeat: e.repeat,
  };
}

export function IntegrationSettings() {
  return (
    <AuthGate feature="integrations">
      <IntegrationInner />
    </AuthGate>
  );
}

function IntegrationInner() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const now = useNow();
  const { data, isLoading } = useQuery({ queryKey: ["anilist-status"], queryFn: () => fetch("/api/integrations/anilist/status").then((r) => r.json() as Promise<Status>) });
  const [plan, setPlan] = useState<{ decisions: SyncDecision[]; media: Map<number, AniListListEntry> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnect, setDisconnect] = useState(false);
  const entries = useLibrary((s) => s.entries);
  const importEntries = useLibrary((s) => s.importEntries);
  const lastSyncAt = data?.account?.last_synced_at ? new Date(data.account.last_synced_at).getTime() : null;

  useEffect(() => {
    const r = sp.get("anilist");
    if (!r) return;
    const msg: Record<string, [string, "success" | "error"]> = {
      connected: ["AniList connected", "success"],
      state: ["The connection request expired or was tampered with. Try again.", "error"],
      session: ["Your session changed during connection. Try again.", "error"],
      exchange: ["AniList didn't accept the authorization. Try again.", "error"],
      "in-use": ["That AniList account is already linked to another KAZE account.", "error"],
      save: ["Couldn't save the connection.", "error"],
      unconfigured: ["AniList OAuth isn't configured on this deployment.", "error"],
    };
    const [text, kind] = msg[r] ?? ["Unknown result", "error"];
    if (kind === "success") toast.success(text);
    else toast.error(text);
    window.history.replaceState(null, "", "/settings/integrations");
  }, [sp]);

  const preview = async () => {
    setBusy("preview");
    try {
      const res = await fetch("/api/integrations/anilist/list");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const list = body.entries as AniListListEntry[];
      const decisions = reconcile(Object.values(entries), list.map(remoteFromAniList), lastSyncAt);
      setPlan({ decisions, media: new Map(list.map((e) => [e.mediaId, e])) });
    } catch (err) {
      toast.error((err as Error).message || "Couldn't read your AniList list");
    } finally {
      setBusy(null);
    }
  };

  const apply = async (direction: "import" | "sync") => {
    if (!plan) return;
    setBusy(direction);
    const local: LibraryEntry[] = [];
    const push: RemoteEntry[] = [];
    const now = Date.now();
    const toLocal = (r: RemoteEntry): LibraryEntry => {
      const prev = entries[r.mediaId];
      const m = plan.media.get(r.mediaId);
      return {
        mediaId: r.mediaId,
        status: r.status,
        progress: r.progress,
        score: r.score,
        notes: r.notes,
        favorite: prev?.favorite ?? false,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        repeat: r.repeat,
        createdAt: prev?.createdAt ?? now,
        updatedAt: Math.max(r.updatedAt, prev?.updatedAt ?? 0),
        media: prev?.media ?? (m ? snapshotFromMedia(m.media) : { title: `AniList #${r.mediaId}`, titleNative: null, cover: null, banner: null, color: null, episodes: null, format: null, year: null, genres: [], averageScore: null, studio: null, duration: null }),
        anilistUpdatedAt: r.updatedAt,
        syncedAt: now,
      };
    };
    for (const d of plan.decisions) {
      if (d.kind === "import" || d.kind === "pull") local.push(toLocal(d.remote));
      if (d.kind === "merge") {
        local.push(toLocal(d.merged));
        if (direction === "sync" && d.pushRemote) push.push(d.merged);
      }
      if (direction === "sync" && (d.kind === "export" || d.kind === "push")) {
        const e = d.local;
        push.push({ mediaId: e.mediaId, status: e.status, progress: e.progress, score: e.score, notes: e.notes, updatedAt: e.updatedAt, startedAt: e.startedAt, completedAt: e.completedAt, repeat: e.repeat });
      }
    }
    const n = importEntries(local, { overwrite: true });
    let pushed = 0;
    let failed = 0;
    for (let i = 0; i < push.length; i += 25) {
      const res = await fetch("/api/integrations/anilist/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: push.slice(i, i + 25).map((p) => ({ mediaId: p.mediaId, status: p.status, progress: p.progress, score: p.score, notes: p.notes, startedAt: p.startedAt, completedAt: p.completedAt })) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "AniList rejected the sync");
        break;
      }
      pushed += body.pushed;
      failed += body.failed;
      if (body.remaining) break;
    }
    setBusy(null);
    setPlan(null);
    qc.invalidateQueries({ queryKey: ["anilist-status"] });
    toast.success(direction === "import" ? `Imported ${n} entries from AniList` : `Sync complete: ${n} updated here, ${pushed} sent to AniList${failed ? `, ${failed} failed` : ""}`);
  };

  if (isLoading) return <div className="k-skeleton h-48" />;
  if (!data?.configured)
    return (
      <Panel title="AniList" description="Connect your AniList account to import and sync your anime list.">
        <p className="text-sm text-muted">
          AniList OAuth isn&apos;t configured on this deployment. An administrator needs to register a client at{" "}
          <a href="https://anilist.co/settings/developer" className="underline" target="_blank" rel="noreferrer">
            anilist.co/settings/developer
          </a>{" "}
          and set <code className="font-mono text-xs">NEXT_PUBLIC_ANILIST_CLIENT_ID</code>, <code className="font-mono text-xs">ANILIST_CLIENT_SECRET</code>,{" "}
          <code className="font-mono text-xs">TOKEN_ENCRYPTION_KEY</code> and <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>.
        </p>
      </Panel>
    );

  const acct = data.account;
  const counts = plan?.decisions.reduce<Record<string, number>>((a, d) => ((a[d.kind] = (a[d.kind] ?? 0) + 1), a), {});
  const conflicts = plan?.decisions.filter((d) => d.kind === "merge") as Extract<SyncDecision, { kind: "merge" }>[] | undefined;

  return (
    <>
      <Panel title="AniList" description="Your KAZE login stays separate. AniList is a connected service you can disconnect at any time.">
        {acct ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {acct.external_avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={acct.external_avatar_url} alt="" className="size-12 rounded-full object-cover" />
              )}
              <div>
                <p className="font-semibold">
                  Connected as{" "}
                  <a href={`https://anilist.co/user/${encodeURIComponent(acct.external_username)}`} target="_blank" rel="noreferrer" className="text-primary-ink hover:underline">
                    {acct.external_username}
                  </a>
                </p>
                <p className="text-xs text-muted">
                  {acct.last_synced_at ? `Last synced ${now ? relativeTime(new Date(acct.last_synced_at).getTime(), now) : ""}` : "Never synced"}
                  {acct.last_sync_status && acct.last_sync_status !== "ok" ? ` · ${acct.last_sync_message ?? acct.last_sync_status}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="k-btn k-btn-primary k-btn-sm" onClick={preview} disabled={Boolean(busy)}>
                {busy === "preview" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" aria-hidden />} Compare lists
              </button>
              <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setDisconnect(true)}>
                <Unlink className="size-4" aria-hidden /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <a href="/api/integrations/anilist/start" className="k-btn k-btn-primary">
            Connect AniList <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </Panel>

      {plan && counts && (
        <Panel title="Sync preview" description="Nothing changes until you choose an action. Conflicts never silently overwrite: progress takes the higher value, other fields follow the most recent edit.">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[
              ["import", "New from AniList"],
              ["pull", "Updated on AniList"],
              ["export", "Only on KAZE"],
              ["push", "Updated on KAZE"],
              ["merge", "Changed on both"],
              ["noop", "Already identical"],
            ].map(([k, l]) => (
              <div key={k} className="k-card p-3">
                <dt className="text-xs text-muted">{l}</dt>
                <dd className="font-display text-2xl">{counts[k] ?? 0}</dd>
              </div>
            ))}
          </dl>
          {conflicts && conflicts.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold">Review {conflicts.length} merged entries</summary>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-muted">
                {conflicts.map((c) => (
                  <li key={c.mediaId}>
                    {entries[c.mediaId]?.media.title ?? plan.media.get(c.mediaId)?.media.title.romaji ?? c.mediaId}: {c.conflict.join(", ")} → {c.merged.status.toLowerCase()}, ep {c.merged.progress}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="k-btn k-btn-outline k-btn-sm" disabled={Boolean(busy)} onClick={() => apply("import")}>
              {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" aria-hidden />} Import only (AniList → KAZE)
            </button>
            <button className="k-btn k-btn-primary k-btn-sm" disabled={Boolean(busy)} onClick={() => apply("sync")}>
              {busy === "sync" ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" aria-hidden />} Two-way sync
            </button>
            <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setPlan(null)}>
              Cancel
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">Two-way sync sends up to 25 changes per batch and pauses between writes to respect AniList&apos;s rate limit.</p>
        </Panel>
      )}

      <ConfirmDialog
        open={disconnect}
        onOpenChange={setDisconnect}
        title="Disconnect AniList?"
        body={
          <>
            KAZE deletes its stored token. Your KAZE library stays as it is. To fully revoke access, also remove KAZE in{" "}
            <a href="https://anilist.co/settings/apps" target="_blank" rel="noreferrer" className="underline">
              AniList → Settings → Apps
            </a>
            .
          </>
        }
        confirmLabel="Disconnect"
        destructive
        onConfirm={async () => {
          const res = await fetch("/api/integrations/anilist/disconnect", { method: "POST" });
          setDisconnect(false);
          if (!res.ok) return toast.error("Couldn't disconnect");
          toast("AniList disconnected");
          qc.invalidateQueries({ queryKey: ["anilist-status"] });
        }}
      />
    </>
  );
}
