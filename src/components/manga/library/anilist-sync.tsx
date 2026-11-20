"use client";

import { CloudDownload, CloudUpload, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AniListMangaListEntry } from "@/lib/anilist/manga-types";
import { applyRemoteToLocal, reconcileManga, remoteFromAniListManga, summarize, type MangaRemoteEntry, type MangaSyncDecision } from "@/lib/manga/sync";
import { useMangaLibrary } from "@/stores/manga";
import type { MangaLibraryEntry } from "@/lib/manga/types";

/**
 * Manga list sync with AniList. Same contract as the anime sync: preview first, nothing is overwritten silently,
 * page-level progress stays in KAZE. Shown inside Settings → Integrations when AniList is connected.
 */
export function AniListMangaSync({ lastSyncAt }: { lastSyncAt: number | null }) {
  const entries = useMangaLibrary((s) => s.entries);
  const importEntries = useMangaLibrary((s) => s.importEntries);
  const [busy, setBusy] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ decisions: MangaSyncDecision[]; media: Map<number, AniListMangaListEntry>; remote: Map<number, MangaRemoteEntry> } | null>(null);

  const preview = async () => {
    setBusy("preview");
    try {
      const res = await fetch("/api/integrations/anilist/manga-list");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const list = body.entries as AniListMangaListEntry[];
      const remote = list.map(remoteFromAniListManga);
      setPlan({ decisions: reconcileManga(Object.values(entries), remote, lastSyncAt), media: new Map(list.map((e) => [e.mediaId, e])), remote: new Map(remote.map((r) => [r.mediaId, r])) });
    } catch (err) {
      toast.error((err as Error).message || "No se pudo leer tu lista de manga de AniList");
    } finally {
      setBusy(null);
    }
  };

  const apply = async (direction: "import" | "sync") => {
    if (!plan) return;
    setBusy(direction);
    const local: MangaLibraryEntry[] = [];
    const push: { mediaId: number; status: string; progress: number; progressVolumes: number; score: number | null; notes: string; startedAt: string | null; completedAt: string | null }[] = [];
    for (const d of plan.decisions) {
      const prev = entries[d.mediaId];
      const media = plan.media.get(d.mediaId);
      const vols = d.volumes ?? 0;
      if (d.kind === "import" || d.kind === "pull") local.push(applyRemoteToLocal(d.remote, vols, prev, media));
      if (d.kind === "merge") {
        local.push(applyRemoteToLocal(d.merged, vols, prev, media));
        if (direction === "sync" && d.pushRemote) push.push({ ...d.merged, progressVolumes: vols });
      }
      if (direction === "sync" && (d.kind === "export" || d.kind === "push")) {
        const e = d.local;
        push.push({ mediaId: e.mangaId, status: e.status, progress: e.progress, progressVolumes: e.progressVolumes, score: e.score, notes: e.notes, startedAt: e.startedAt, completedAt: e.completedAt });
      }
    }
    const n = importEntries(local, { overwrite: true });
    let pushed = 0;
    let failed = 0;
    for (let i = 0; i < push.length; i += 25) {
      const res = await fetch("/api/integrations/anilist/manga-push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: push.slice(i, i + 25) }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "AniList rechazó la sincronización");
        break;
      }
      pushed += body.pushed;
      failed += body.failed;
      if (body.remaining) break;
    }
    setBusy(null);
    setPlan(null);
    toast.success(direction === "import" ? `Importados ${n} manga desde AniList` : `Sincronizado: ${n} actualizados aquí, ${pushed} enviados a AniList${failed ? `, ${failed} fallidos` : ""}`);
  };

  const counts = plan ? summarize(plan.decisions) : null;
  const merges = plan?.decisions.filter((d) => d.kind === "merge") as Extract<MangaSyncDecision, { kind: "merge" }>[] | undefined;
  return (
    <section className="k-card p-5" aria-labelledby="anilist-manga">
      <h2 id="anilist-manga" className="font-display text-lg">Lista de manga</h2>
      <p className="mt-1 text-sm text-muted">Compara tu lista de manga de AniList con la de KAZE antes de cambiar nada. AniList guarda capítulos y volúmenes; la página exacta donde te quedaste se queda en KAZE.</p>
      <button type="button" className="k-btn k-btn-primary k-btn-sm mt-4" onClick={preview} disabled={Boolean(busy)}>
        {busy === "preview" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />} Comparar listas de manga
      </button>
      {plan && counts && (
        <div className="mt-5">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[
              ["import", "Nuevos en AniList"],
              ["pull", "Actualizados en AniList"],
              ["export", "Solo en KAZE"],
              ["push", "Actualizados en KAZE"],
              ["merge", "Cambiados en ambos"],
              ["noop", "Idénticos"],
            ].map(([k, l]) => (
              <div key={k} className="km-frame p-3">
                <dt className="text-xs text-muted">{l}</dt>
                <dd className="km-number text-2xl">{counts[k] ?? 0}</dd>
              </div>
            ))}
          </dl>
          {merges && merges.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold">Revisar {merges.length} conflictos</summary>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-muted">
                {merges.map((c) => (
                  <li key={c.mediaId}>
                    {entries[c.mediaId]?.media.title ?? plan.media.get(c.mediaId)?.media.title.romaji ?? c.mediaId}: {c.conflict.join(", ")} → cap. {c.merged.progress}, vol. {c.volumes ?? 0}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="k-btn k-btn-outline k-btn-sm" disabled={Boolean(busy)} onClick={() => apply("import")}>
              {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" aria-hidden />} Solo importar (AniList → KAZE)
            </button>
            <button type="button" className="k-btn k-btn-primary k-btn-sm" disabled={Boolean(busy)} onClick={() => apply("sync")}>
              {busy === "sync" ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" aria-hidden />} Sincronizar en ambos sentidos
            </button>
            <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => setPlan(null)}>
              Cancelar
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">Las series de demostración de KAZE Originals nunca se envían a AniList.</p>
        </div>
      )}
    </section>
  );
}
