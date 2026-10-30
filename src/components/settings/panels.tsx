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
    { href: "/settings/profile", title: "Perfil de Orunei", body: "Avatar, marcos animados, portada, bio, temas y vitrina" },
    { href: "/settings/appearance", title: "Apariencia", body: `${THEMES[theme].name} · efectos y animaciones` },
    { href: "/settings/account", title: "Cuenta", body: status === "signed-in" ? `Conectado como @${profile?.username ?? "…"}` : "Perfil local en este dispositivo" },
    { href: "/settings/privacy", title: "Privacidad", body: profile ? `Perfil: ${profile.visibility}` : "Visibilidad del perfil y actividad" },
    { href: "/settings/integrations", title: "Integraciones", body: "Conecta AniList, importa y sincroniza tu lista" },
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
      <Panel title="Tema visual" description={signedIn ? "Tu tema acompaña a tu cuenta en todos tus dispositivos." : "Guardado en este dispositivo. Inicia sesión para sincronizarlo."}>
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
      <Panel title="Movimiento y animaciones" description="Las animaciones comunican estado; tú decides cuánta fluidez visual prefieres.">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Motion preference">
          {(
            [
              ["system", "Seguir el sistema", "Respeta el ajuste de reducir movimiento del sistema"],
              ["reduce", "Reducido", "Solo transiciones suaves, sin movimientos bruscos"],
              ["full", "Completo", "Todas las transiciones cinemáticas fluidas"],
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
        <Switch id="ambient-fx" label="Efectos ambientales" description="Pétalos de sakura, estelas de luz y destellos sutiles en el fondo." checked={ambient} onChange={setAmbient} />
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
    else toast.success("Revisa tu bandeja de entrada para confirmar el cambio de correo");
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
      toast.success("Contraseña actualizada con éxito");
      if (reset) router.replace("/settings/account");
    }
  };
  const deleteAccount = async () => {
    setBusy("delete");
    const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: confirmText }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? "Error al eliminar la cuenta");
    toast.success(body.note ?? "Tu cuenta ha sido eliminada correctamente");
    await db.auth.signOut();
    localStorage.removeItem("kaze:library");
    localStorage.removeItem("kaze:progress");
    router.replace("/");
  };

  return (
    <>
      {reset && <p className="mb-6 rounded-[var(--k-radius-card)] bg-primary/15 p-4 text-sm">Has seguido un enlace de recuperación. Elige una nueva contraseña a continuación.</p>}
      <Panel title="Correo electrónico" description={user.emailConfirmed ? "Verificado" : "Pendiente de verificación — revisa tu correo."}>
        <form onSubmit={updateEmail} className="flex flex-wrap gap-2">
          <label htmlFor="acc-email" className="sr-only">Email</label>
          <input id="acc-email" type="email" className="k-input flex-1" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button className="k-btn k-btn-outline" disabled={busy === "email" || email === user.email}>
            {busy === "email" && <Loader2 className="size-4 animate-spin" />} Actualizar correo
          </button>
        </form>
      </Panel>
      <Panel title="Contraseña">
        <form onSubmit={updatePassword} className="space-y-2">
          <label htmlFor="acc-pw" className="text-sm font-semibold">Nueva contraseña</label>
          <div className="flex flex-wrap gap-2">
            <input id="acc-pw" type="password" className="k-input flex-1" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" aria-invalid={Boolean(pwErr)} />
            <button className="k-btn k-btn-outline" disabled={busy === "pw" || !pw}>
              {busy === "pw" && <Loader2 className="size-4 animate-spin" />} Cambiar contraseña
            </button>
          </div>
          {pwErr ? <p className="text-xs text-danger">{pwErr}</p> : <p className="text-xs text-muted">Mínimo 8 caracteres con una letra y un número.</p>}
        </form>
      </Panel>
      <Panel title="Sesiones activas" description="Cierra sesión en los demás dispositivos si usaste un equipo compartido o extraviado.">
        <div className="flex flex-wrap gap-2">
          <button className="k-btn k-btn-outline k-btn-sm" onClick={() => setConfirmOthers(true)}>
            Cerrar sesión en otros dispositivos
          </button>
          <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => signOut().then(() => router.replace("/"))}>
            <LogOut className="size-4" aria-hidden /> Cerrar sesión en este equipo
          </button>
        </div>
      </Panel>
      <Panel title="Eliminar cuenta" description="Elimina permanentemente tu perfil, biblioteca, reseñas, comentarios, amigos y cuentas conectadas. Esta acción no se puede deshacer.">
        <button className="k-btn k-btn-sm bg-danger text-white" onClick={() => setDel(true)}>
          <Trash2 className="size-4" aria-hidden /> Eliminar mi cuenta
        </button>
      </Panel>
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title="Cerrar sesión en otros dispositivos?"
        body="Se cerrará la sesión en todos los demás navegadores conectados a esta cuenta."
        confirmLabel="Cerrar las demás sesiones"
        onConfirm={async () => {
          const { error } = await db.auth.signOut({ scope: "others" });
          setConfirmOthers(false);
          if (error) toast.error(error.message);
          else toast.success("Las demás sesiones se han cerrado");
        }}
      />
      <Dialog open={del} onOpenChange={setDel} title="¿Eliminar tu cuenta definitivamente?" description="Escribe ELIMINAR para confirmar.">
        <div className="space-y-3 px-5 pb-5 pt-2">
          <label htmlFor="del-confirm" className="sr-only">Type DELETE</label>
          <input id="del-confirm" className="k-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ELIMINAR" autoComplete="off" />
          <div className="flex justify-end gap-2">
            <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setDel(false)}>Cancelar</button>
            <button className="k-btn k-btn-sm bg-danger text-white" disabled={confirmText !== "ELIMINAR" && confirmText !== "DELETE" || busy === "delete"} onClick={deleteAccount}>
              {busy === "delete" ? "Eliminando…" : "Eliminar para siempre"}
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
      <Panel title="Gamificación y Logros" description="Insignias, hitos y metas de temporada. Totalmente opcional y sin presiones.">
        <Switch id="gami" label="Mostrar insignias y celebraciones de logros" checked={gamification} onChange={setGamification} />
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
    toast.success("Privacidad actualizada con éxito");
  };
  return (
    <Panel title="Perfil y actividad" description="Protegido en el servidor mediante seguridad por filas (RLS). Tu información siempre segura.">
      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-semibold">Quién puede ver tu perfil</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["public", "friends", "private"] as const).map((v) => (
            <button key={v} disabled={saving} aria-pressed={profile.visibility === v} onClick={() => save({ visibility: v })} className={cn("k-card p-3 text-left text-sm", profile.visibility === v && "ring-2 ring-primary")}>
              <span className="font-semibold capitalize">{v}</span>
              <span className="mt-1 block text-xs text-muted">{v === "public" ? "Cualquier persona, incluidos visitantes" : v === "friends" ? "Solo amigos aceptados" : "Solo tú (privado)"}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="divide-y divide-line">
        <Switch id="p-lists" label="Compartir mis listas de anime" checked={profile.show_lists} onChange={(v) => save({ show_lists: v })} disabled={saving} />
        <Switch id="p-hist" label="Compartir mi historial de visualización" description="Progreso y animes que estás viendo actualmente." checked={profile.show_watch_history} onChange={(v) => save({ show_watch_history: v })} disabled={saving} />
        <Switch id="p-favs" label="Compartir mis animes favoritos" checked={profile.show_favorites} onChange={(v) => save({ show_favorites: v })} disabled={saving} />
        <Switch id="p-act" label="Compartir mi actividad" description="Animes empezados, completados, calificaciones y reseñas en el feed de tus amigos." checked={profile.show_activity} onChange={(v) => save({ show_activity: v })} disabled={saving} />
        <Switch id="p-online" label="Mostrar cuándo estoy en línea" description="Desactivado por defecto." checked={profile.show_online_status} onChange={(v) => save(v ? { show_online_status: true } : { show_online_status: false, last_seen_at: null } as Partial<typeof profile>)} disabled={saving} />
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
