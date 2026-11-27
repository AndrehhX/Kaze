"use client";

import { Mail, MailX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Interruptor del resumen semanal por correo (los domingos, con los episodios nuevos de lo que sigues). */
export function DigestToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/account/digest")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled?: boolean } | null) => alive && setEnabled(d?.enabled ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (enabled === null) return null;

  const toggle = async () => {
    setBusy(true);
    const next = !enabled;
    const res = await fetch("/api/account/digest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: next }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast.error("No se pudo guardar. Inténtalo de nuevo.");
    setEnabled(next);
    toast(next ? "Te mandaremos el resumen los domingos" : "Ya no te llegará el resumen por correo");
  };

  return (
    <div className="mx-1 mb-2 flex items-center gap-3 rounded-[min(var(--k-radius-btn),12px)] border border-line px-3 py-2.5 text-sm">
      {enabled ? <Mail className="size-4 shrink-0 text-primary-ink" aria-hidden /> : <MailX className="size-4 shrink-0 text-muted" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Resumen semanal por correo</span>
        <span className="block text-xs text-muted">{enabled ? "Los domingos, con los episodios nuevos de lo que sigues." : "Desactivado."}</span>
      </span>
      <button
        type="button"
        className={enabled ? "k-btn k-btn-ghost k-btn-sm !min-h-8 text-xs" : "k-btn k-btn-primary k-btn-sm !min-h-8 text-xs"}
        onClick={toggle}
        disabled={busy}
        aria-pressed={enabled}
      >
        {busy ? "…" : enabled ? "Desactivar" : "Activar"}
      </button>
    </div>
  );
}
