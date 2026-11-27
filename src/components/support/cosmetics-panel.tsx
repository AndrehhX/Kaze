"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/shell/user-menu";
import { Panel, Switch } from "@/components/settings/panels";
import { SupporterBadges, SupporterName } from "./supporter-name";
import { cn } from "@/lib/utils";
import { COMMENT_FRAMES, NAME_COLORS, NAME_GRADIENTS, PROFILE_EFFECTS, SUPPORTER_FRAMES, TIERS, type Equipped, type TierLevel } from "@/lib/support/tiers";

type Me = { supporter: { tier: number; expires_at: string | null; founder: boolean; show_on_wall: boolean; equipped: Equipped } | null; activeTier: 0 | TierLevel };

/** Ajustes → Apoyo: elegir los cosméticos de quien apoya (el servidor vuelve a comprobar el nivel al guardar). */
export function SupportCosmeticsPanel() {
  const status = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["support-me"],
    enabled: status === "signed-in",
    queryFn: async () => {
      const r = await fetch("/api/support/me");
      return r.ok ? ((await r.json()) as Me) : null;
    },
  });
  const [eq, setEq] = useState<Equipped>({});
  const [wall, setWall] = useState(true);
  const [busy, setBusy] = useState(false);
  const loaded = me.data?.supporter;
  useEffect(() => {
    if (!loaded) return;
    // Copia local editable de lo guardado en el servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEq(loaded.equipped ?? {});
    setWall(loaded.show_on_wall);
  }, [loaded]);

  if (status !== "signed-in")
    return (
      <Panel title="Apoya KAZE" description="Inicia sesión para ver tus cosméticos de apoyo.">
        <Link href="/apoyar" className="k-btn k-btn-outline k-btn-sm">
          Ver los niveles
        </Link>
      </Panel>
    );
  if (me.isLoading) return <div className="k-skeleton h-64 rounded-2xl" />;

  const tier = me.data?.activeTier ?? 0;
  const s = me.data?.supporter ?? null;
  const name = profile?.display_name || profile?.username || "Tú";
  const preview = s ? { tier: s.tier, expires_at: s.expires_at, founder: s.founder, equipped: eq } : null;

  const toggle = (slot: keyof Equipped, id: string) => setEq((cur) => ({ ...cur, [slot]: cur[slot] === id ? undefined : id }));

  const save = async () => {
    setBusy(true);
    const r = await fetch("/api/support/equip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ equipped: eq, showOnWall: wall }) }).catch(() => null);
    setBusy(false);
    const body = (await r?.json().catch(() => null)) as { error?: string } | null;
    if (!r?.ok) return toast.error(body?.error ?? "No se pudo guardar.");
    toast.success("Cosméticos guardados");
    qc.invalidateQueries({ queryKey: ["support-me"] });
    qc.invalidateQueries({ queryKey: ["supporter"] });
    qc.invalidateQueries({ queryKey: ["comments"] });
  };

  return (
    <>
      <Panel
        title="Apoya KAZE"
        description={
          tier ? (
            <>
              Apoyas con <strong>{TIERS[tier].emoji} {TIERS[tier].name}</strong>
              {s?.expires_at ? ` hasta el ${new Date(s.expires_at).toLocaleDateString("es", { day: "numeric", month: "long" })}` : ""}. ¡Gracias por mantener KAZE en pie!
            </>
          ) : s ? (
            "Tu apoyo venció. Tus cosméticos siguen guardados: si vuelves a apoyar, aparecen otra vez."
          ) : (
            "Todavía no apoyas. El anime sigue gratis; apoyar solo da cosméticos para la comunidad."
          )
        }
      >
        <div className="flex flex-wrap items-center gap-3 rounded-[min(var(--k-radius-btn),12px)] border border-line p-4">
          <Avatar src={profile?.avatar_url} name={name} size={40} frame={tier >= 2 ? eq.avatarFrame : null} />
          <div className={cn("min-w-0 flex-1", tier >= 2 && eq.commentFrame && `k-cframe k-cframe-${eq.commentFrame}`)}>
            <p className="text-sm">
              <SupporterName supporter={preview} className="font-semibold">
                {name}
              </SupporterName>{" "}
              <SupporterBadges supporter={preview} link={false} />
            </p>
            <p className="text-xs text-muted">Así se ve tu nombre en los comentarios.</p>
          </div>
        </div>
        {!tier && (
          <Link href="/apoyar" className="k-btn k-btn-primary k-btn-sm mt-4">
            Ver los niveles
          </Link>
        )}
      </Panel>

      <Panel title="Color del nombre" description={`${TIERS[1].emoji} Brisa o más.`}>
        <Swatches items={NAME_COLORS} selected={eq.nameColor} tier={tier} onPick={(id) => toggle("nameColor", id)} />
      </Panel>

      <Panel title="Nombre con degradado animado" description={`${TIERS[3].emoji} Tormenta. Si eliges uno, sustituye al color plano.`}>
        <div className="flex flex-wrap gap-2">
          {NAME_GRADIENTS.map((g) => (
            <Choice key={g.id} locked={tier < g.tier} active={eq.nameGradient === g.id} onClick={() => toggle("nameGradient", g.id)}>
              <span className={cn("k-grad-name font-bold", `k-grad-${g.id}`)}>{g.name}</span>
            </Choice>
          ))}
        </div>
      </Panel>

      <Panel title="Marco de avatar exclusivo" description={`${TIERS[2].emoji} Viento o más. Los marcos gratis siguen en Ajustes → Perfil.`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUPPORTER_FRAMES.map((f) => (
            <Choice key={f.id} locked={tier < f.tier} active={eq.avatarFrame === f.id} onClick={() => toggle("avatarFrame", f.id)} className="flex-col !py-3">
              <Avatar src={profile?.avatar_url} name={name} size={44} frame={f.id} />
              <span className="mt-2 text-xs font-semibold">{f.name}</span>
            </Choice>
          ))}
        </div>
      </Panel>

      <Panel title="Marco de comentario" description={`${TIERS[2].emoji} Viento o más.`}>
        <Swatches items={COMMENT_FRAMES} selected={eq.commentFrame} tier={tier} onPick={(id) => toggle("commentFrame", id)} />
      </Panel>

      <Panel title="Efecto animado del perfil" description={`${TIERS[2].emoji} Viento o más. Se apaga para quien tiene activado "reducir movimiento".`}>
        <div className="flex flex-wrap gap-2">
          {PROFILE_EFFECTS.map((f) => (
            <Choice key={f.id} locked={tier < f.tier} active={eq.profileEffect === f.id} onClick={() => toggle("profileEffect", f.id)}>
              <span aria-hidden>{f.icon}</span> {f.name}
            </Choice>
          ))}
        </div>
      </Panel>

      {s && (
        <Panel title="Muro de apoyo">
          <Switch id="sup-wall" label="Mostrar mi nombre en el muro de /apoyar" description="Solo tu nombre y tu avatar. Nunca se muestra cuánto apoyas." checked={wall} onChange={setWall} />
        </Panel>
      )}

      {s && (
        <div className="sticky bottom-24 z-10 flex justify-end lg:bottom-6">
          <button type="button" className="k-btn k-btn-primary shadow-[var(--k-shadow-pop)]" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar cosméticos"}
          </button>
        </div>
      )}
    </>
  );
}

function Choice({ locked, active, onClick, children, className }: { locked: boolean; active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "k-card relative flex items-center gap-2 px-3 py-2 text-sm transition-all",
        active ? "ring-2 ring-primary" : "hover:bg-[var(--k-btn-ghost)]",
        locked && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {children}
      {locked && <Lock className="absolute right-1.5 top-1.5 size-3 text-muted" aria-label="Bloqueado" />}
    </button>
  );
}

function Swatches({ items, selected, tier, onPick }: { items: { id: string; name: string; tier: TierLevel; swatch: string }[]; selected?: string; tier: number; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c) => (
        <Choice key={c.id} locked={tier < c.tier} active={selected === c.id} onClick={() => onPick(c.id)}>
          <span className="size-4 rounded-full" style={{ background: c.swatch }} aria-hidden /> {c.name}
        </Choice>
      ))}
    </div>
  );
}
