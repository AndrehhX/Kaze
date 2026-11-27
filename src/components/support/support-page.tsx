"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Heart, Server, Sparkles, Vote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/shell/user-menu";
import { cn } from "@/lib/utils";
import { CURRENT_POLL, FOUNDER_LIMIT, KOFI_MEMBERSHIP_URL, KOFI_URL, MONTHLY_COSTS, MONTHLY_GOAL, TIERS, TIER_LEVELS, type TierLevel } from "@/lib/support/tiers";

type Stats = {
  goal: number;
  raised: number;
  activeCount: number;
  foundersLeft: number;
  wall: { username: string; display_name: string; avatar_url: string | null; tier: number; founder: boolean; active: boolean }[];
  poll: { id: string; tally: Record<string, number> };
};
type Me = { supporter: { tier: number; expires_at: string | null; founder: boolean; show_on_wall: boolean } | null; activeTier: 0 | TierLevel; vote: string | null };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const usd = (n: number) => `${n.toLocaleString("es", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} US$`;
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

export function SupportPage() {
  const status = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const signedIn = status === "signed-in";
  const qc = useQueryClient();

  const stats = useQuery({ queryKey: ["support-stats"], queryFn: async () => (await fetch("/api/support/stats")).json() as Promise<Stats>, staleTime: 60_000 });
  const me = useQuery({
    queryKey: ["support-me"],
    enabled: signedIn,
    queryFn: async () => {
      const r = await fetch("/api/support/me");
      return r.ok ? ((await r.json()) as Me) : null;
    },
  });

  const s = stats.data;
  const goal = s?.goal ?? MONTHLY_GOAL;
  const raised = s?.raised ?? 0;
  const pct = Math.min(100, Math.round((raised / goal) * 100));
  const month = MESES[new Date().getMonth()];
  const tier = me.data?.activeTier ?? 0;

  return (
    <div className="container-k max-w-5xl py-10 md:py-14">
      {/* ── Mensaje ── */}
      <header className="max-w-3xl">
        <p className="k-label text-primary-ink">Apoya KAZE · 風</p>
        <h1 className="font-display text-title mt-2">KAZE es gratis y lo seguirá siendo.</h1>
        <p className="mt-4 text-base leading-relaxed text-fg/85">
          Lo hace una sola persona y se paga de su bolsillo: servidor, dominio y correo. Si te gusta y puedes, apoyar ayuda a que siga en pie. A cambio te damos cosméticos para que se note en la comunidad.
          <strong className="font-semibold text-fg"> Nadie tiene que pagar para ver nada.</strong>
        </p>
      </header>

      {/* ── Barra del mes ── */}
      <section className="k-card mt-8 p-5 sm:p-6" aria-labelledby="meta-mes">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="meta-mes" className="flex items-center gap-2 font-display text-lg">
            <Server className="size-5 text-primary" aria-hidden /> Servidor de {month}
          </h2>
          <p className="text-sm text-muted">
            <span className="text-2xl font-black text-fg">{usd(raised)}</span> de {usd(goal)} cubiertos
          </p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--k-btn-ghost)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Gastos del mes cubiertos">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-700" style={{ width: `${Math.max(pct, raised > 0 ? 3 : 0)}%` }} />
        </div>
        <ul className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-3">
          {MONTHLY_COSTS.map((c) => (
            <li key={c.label} className="flex justify-between gap-2 rounded-[min(var(--k-radius-btn),12px)] border border-line px-3 py-2">
              <span>{c.label}</span>
              <span className="font-semibold text-fg">{usd(c.usd)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {pct >= 100 ? "¡Este mes ya está cubierto! Lo que sobre se guarda para los meses flojos y para mejorar el servidor." : !s?.activeCount ? "Todavía nadie apoya este mes. Si te animas, tu nombre puede ser el primero del muro." : `${s.activeCount} ${s.activeCount === 1 ? "persona apoya" : "personas apoyan"} ahora mismo. Gracias de verdad.`}
        </p>
      </section>

      {/* ── Niveles ── */}
      <section className="mt-10" aria-labelledby="niveles">
        <h2 id="niveles" className="font-display text-xl">Niveles</h2>
        <p className="mt-1 text-sm text-muted">Membresía mensual en Ko-fi. Puedes cancelarla cuando quieras desde Ko-fi.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {TIER_LEVELS.map((lvl) => {
            const t = TIERS[lvl];
            const mine = tier === lvl;
            return (
              <article key={lvl} className={cn("k-card relative flex flex-col p-5", mine && "ring-2 ring-primary")}>
                {mine && <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-white">Tu nivel</span>}
                <p className="text-2xl" aria-hidden>
                  {t.emoji}
                </p>
                <h3 className="mt-1 font-display text-lg" style={{ color: t.color }}>
                  {t.name}
                </h3>
                <p className="mt-1">
                  <span className="text-3xl font-black">{t.price}</span> <span className="text-sm text-muted">US$ / mes</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {t.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {perk}
                    </li>
                  ))}
                </ul>
                <a href={KOFI_MEMBERSHIP_URL} target="_blank" rel="noopener noreferrer" className={cn("k-btn mt-5 w-full", lvl === 2 ? "k-btn-primary" : "k-btn-outline")}>
                  Apoyar con {t.name} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </article>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
          <p className="k-card p-4">
            <strong className="text-fg">★ Fundador:</strong> los primeros {FOUNDER_LIMIT} en apoyar se quedan esta insignia para siempre, aunque luego dejen de apoyar.{" "}
            {s ? <span className="font-semibold text-fg">Quedan {s.foundersLeft}.</span> : null}
          </p>
          <p className="k-card p-4">
            <strong className="text-fg">¿Prefieres una sola vez?</strong> Cualquier{" "}
            <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" className="text-primary-ink underline">
              apoyo puntual en Ko-fi
            </a>{" "}
            da 30 días del nivel que corresponda al importe (desde 2 US$).
          </p>
        </div>
      </section>

      {/* ── Vincular ── */}
      <section className="k-card mt-10 p-5 sm:p-6" aria-labelledby="vincular">
        <h2 id="vincular" className="flex items-center gap-2 font-display text-lg">
          <Sparkles className="size-5 text-primary" aria-hidden /> Cómo se activa
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-fg/85">
          <li>
            En Ko-fi, escribe tu usuario de Orunei en el mensaje {signedIn && profile ? <CopyHandle handle={`@${profile.username}`} /> : <code className="rounded bg-[var(--k-btn-ghost)] px-1.5">@tu_usuario</code>}. Puedes marcar el mensaje como privado.
          </li>
          <li>O usa en Ko-fi el mismo correo de tu cuenta de Orunei.</li>
          <li>Se activa solo en unos segundos. Después elige tus cosméticos en <Link href="/settings/apoyo" className="text-primary-ink underline">Ajustes → Apoyo</Link>.</li>
        </ol>
        {signedIn && me.data?.supporter && (
          <p className="mt-4 rounded-[min(var(--k-radius-btn),12px)] bg-primary/10 px-4 py-3 text-sm">
            {tier ? (
              <>
                <Heart className="mr-1 inline size-4 text-primary" aria-hidden />
                Apoyas con <strong>{TIERS[tier].name}</strong> hasta el {me.data.supporter.expires_at ? fecha(me.data.supporter.expires_at) : "—"}. ¡Gracias!
              </>
            ) : (
              <>Tu apoyo venció{me.data.supporter.founder ? ", pero tu insignia de Fundador se queda para siempre" : ""}. Tus cosméticos siguen guardados por si vuelves.</>
            )}
          </p>
        )}
        {signedIn && <ClaimForm onDone={() => qc.invalidateQueries({ queryKey: ["support-me"] })} />}
        {!signedIn && status !== "loading" && (
          <p className="mt-4 text-sm text-muted">
            <Link href="/login?next=/apoyar" className="font-semibold text-primary-ink">
              Inicia sesión
            </Link>{" "}
            para ver tu estado y vincular un pago.
          </p>
        )}
      </section>

      {/* ── Encuesta ── */}
      <Poll stats={s} me={me.data ?? null} onVoted={() => qc.invalidateQueries({ queryKey: ["support-stats"] })} />

      {/* ── Muro ── */}
      <section className="mt-10" aria-labelledby="muro">
        <h2 id="muro" className="font-display text-xl">Quienes mantienen KAZE en pie</h2>
        {s && s.wall.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aún no hay nadie en el muro. El primer nombre puede ser el tuyo.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-3">
            {(s?.wall ?? []).map((w) => (
              <li key={w.username}>
                <Link href={`/profile/${w.username}`} className={cn("k-card flex items-center gap-2 py-2 pl-2 pr-3 text-sm hover:shadow-[var(--k-hover-glow)]", !w.active && "opacity-70")}>
                  <Avatar src={w.avatar_url} name={w.display_name || w.username} size={28} />
                  <span className="font-semibold">{w.display_name || w.username}</span>
                  {w.active && <span aria-label={TIERS[(Math.min(3, Math.max(1, w.tier)) as TierLevel)].name}>{TIERS[(Math.min(3, Math.max(1, w.tier)) as TierLevel)].emoji}</span>}
                  {w.founder && (
                    <span className="text-amber-500" title="Fundador">
                      ★
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Preguntas ── */}
      <section className="mt-10 grid gap-4 text-sm md:grid-cols-3" aria-label="Preguntas frecuentes">
        {[
          { q: "¿Tengo que pagar para ver anime?", a: "No. Todo el catálogo, el reproductor, la app y las funciones sociales son gratis. Apoyar solo da cosméticos." },
          { q: "¿Qué pasa si dejo de apoyar?", a: "Tus cosméticos se ocultan, pero no se borran: si vuelves, aparecen otra vez. La insignia de Fundador no se pierde nunca." },
          { q: "¿Mi pago está seguro?", a: "Lo procesa Ko-fi (con PayPal o tarjeta). Orunei nunca ve tus datos de pago; solo recibe el aviso de que apoyaste." },
        ].map((f) => (
          <div key={f.q} className="k-card p-4">
            <h3 className="font-semibold">{f.q}</h3>
            <p className="mt-1.5 text-muted">{f.a}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function CopyHandle({ handle }: { handle: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded bg-[var(--k-btn-ghost)] px-1.5 font-mono text-fg hover:text-primary-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(handle);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      aria-label={`Copiar ${handle}`}
    >
      {handle} {done ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
    </button>
  );
}

function ClaimForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [tx, setTx] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button type="button" className="mt-4 text-xs text-muted underline hover:text-fg" onClick={() => setOpen(true)}>
        ¿Apoyaste con otro correo y sin poner tu usuario? Vincula el pago aquí
      </button>
    );
  return (
    <form
      className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await fetch("/api/support/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transactionId: tx, email }) }).catch(() => null);
        setBusy(false);
        const body = (await r?.json().catch(() => null)) as { error?: string } | null;
        if (!r?.ok) return toast.error(body?.error ?? "No se pudo vincular.");
        toast.success("¡Listo! Tu apoyo ya está en tu cuenta.");
        onDone();
        setOpen(false);
      }}
    >
      <label className="sr-only" htmlFor="kofi-tx">
        Código de transacción de Ko-fi
      </label>
      <input id="kofi-tx" className="k-input" placeholder="Código del recibo de Ko-fi" value={tx} onChange={(e) => setTx(e.target.value)} required minLength={6} />
      <label className="sr-only" htmlFor="kofi-email">
        Correo con el que pagaste en Ko-fi
      </label>
      <input id="kofi-email" className="k-input" type="email" placeholder="Correo que usaste en Ko-fi" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <button className="k-btn k-btn-primary" disabled={busy}>
        {busy ? "…" : "Vincular"}
      </button>
    </form>
  );
}

function Poll({ stats, me, onVoted }: { stats: Stats | undefined; me: Me | null; onVoted: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [voted, setVoted] = useState<string | null>(null);
  const tally = stats?.poll.tally ?? {};
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  const canVote = (me?.activeTier ?? 0) >= 3;
  const myVote = voted ?? me?.vote ?? null;
  return (
    <section className="k-card mt-10 p-5 sm:p-6" aria-labelledby="encuesta">
      <h2 id="encuesta" className="flex items-center gap-2 font-display text-lg">
        <Vote className="size-5 text-primary" aria-hidden /> {CURRENT_POLL.question}
      </h2>
      <p className="mt-1 text-sm text-muted">Votan quienes apoyan con {TIERS[3].emoji} Tormenta. Los resultados los ve todo el mundo.</p>
      <ul className="mt-4 space-y-2">
        {CURRENT_POLL.options.map((o) => {
          const n = tally[o.id] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const mine = myVote === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={!canVote || busy !== null}
                onClick={async () => {
                  setBusy(o.id);
                  const r = await fetch("/api/support/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ option: o.id }) }).catch(() => null);
                  setBusy(null);
                  if (!r?.ok) return toast.error("No se pudo guardar tu voto.");
                  setVoted(o.id);
                  toast.success("¡Voto guardado!");
                  onVoted();
                }}
                className={cn("relative w-full overflow-hidden rounded-[min(var(--k-radius-btn),12px)] border border-line px-4 py-2.5 text-left text-sm", canVote && "hover:border-primary", mine && "border-primary")}
                aria-pressed={mine}
              >
                <span className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} aria-hidden />
                <span className="relative flex justify-between gap-3">
                  <span>
                    {mine && <Check className="mr-1 inline size-4 text-primary" aria-hidden />}
                    {o.label}
                  </span>
                  <span className="font-semibold text-muted">{busy === o.id ? "…" : `${pct}%`}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">
        {total} {total === 1 ? "voto" : "votos"}
      </p>
    </section>
  );
}
