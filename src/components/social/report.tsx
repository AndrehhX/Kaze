"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/stores/auth";
import { friendlyDbError } from "@/lib/social";

const REASONS = [
  ["spam", "Spam o publicidad"],
  ["harassment", "Acoso o intimidación"],
  ["spoilers", "Spoilers sin marcar"],
  ["hate", "Discurso de odio"],
  ["sexual", "Contenido sexual"],
  ["other", "Otro motivo"],
] as const;

export function ReportButton({ targetType, targetId, label = "Reportar" }: { targetType: "review" | "discussion" | "comment" | "profile" | "watch_party_message"; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const me = useAuth((s) => s.user?.id);
  if (!me) return null;
  const submit = async () => {
    const db = getSupabaseBrowser();
    if (!db) return;
    setBusy(true);
    const { error } = await db.from("reports").insert({ reporter_id: me, target_type: targetType, target_id: targetId, reason, details: details.slice(0, 1000) });
    setBusy(false);
    if (error && !/duplicate/i.test(error.message)) toast.error(friendlyDbError(error));
    else {
      toast.success("Reporte enviado", { description: "Gracias. Los moderadores lo revisarán." });
      setOpen(false);
    }
  };
  return (
    <>
      <button className="k-btn k-btn-ghost k-btn-sm !min-h-8 text-xs text-muted" onClick={() => setOpen(true)}>
        <Flag className="size-3.5" aria-hidden /> {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen} title="Reportar contenido" description="Los reportes son privados. Abusar de ellos puede limitar tu cuenta.">
        <form
          className="space-y-3 px-5 pb-5 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Reason</legend>
            {REASONS.map(([v, l]) => (
              <label key={v} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-[var(--k-radius-btn)] px-3 hover:bg-[var(--k-btn-ghost)]">
                <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} className="accent-[var(--k-primary)]" />
                <span className="text-sm">{l}</span>
              </label>
            ))}
          </fieldset>
          <textarea className="k-input text-sm" maxLength={1000} placeholder="¿Algo que deban saber los moderadores? (opcional)" value={details} onChange={(e) => setDetails(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="k-btn k-btn-primary k-btn-sm" disabled={busy}>
              {busy ? "Enviando…" : "Enviar reporte"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
