import type { LibraryEntry, LibraryStatus } from "./types";

/**
 * AniList ⇄ KAZE list reconciliation.
 *
 * Rules (documented in docs/ARCHITECTURE.md):
 *  1. An entry that exists on one side only is imported/exported as-is.
 *  2. When both sides changed since the last sync, we never silently overwrite:
 *     - progress takes the maximum (watching forward is the common case),
 *     - status follows the side with the newer timestamp,
 *     - score/notes follow the newer side only if the other side is empty or older,
 *     - the pair is reported as a conflict so the UI can show what happened.
 *  3. When only one side changed since the last sync, that side wins.
 */

export type RemoteEntry = {
  mediaId: number;
  status: LibraryStatus;
  progress: number;
  score: number | null;
  notes: string;
  updatedAt: number; // ms
  startedAt: string | null;
  completedAt: string | null;
  repeat: number;
};

export type SyncDecision =
  | { kind: "import"; mediaId: number; remote: RemoteEntry }
  | { kind: "export"; mediaId: number; local: LibraryEntry }
  | { kind: "pull"; mediaId: number; remote: RemoteEntry }
  | { kind: "push"; mediaId: number; local: LibraryEntry }
  | { kind: "merge"; mediaId: number; merged: RemoteEntry; pushRemote: boolean; conflict: string[] }
  | { kind: "noop"; mediaId: number };

export function reconcile(local: LibraryEntry[], remote: RemoteEntry[], lastSyncAt: number | null): SyncDecision[] {
  const localMap = new Map(local.map((e) => [e.mediaId, e]));
  const remoteMap = new Map(remote.map((e) => [e.mediaId, e]));
  const ids = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const since = lastSyncAt ?? 0;
  const out: SyncDecision[] = [];

  for (const id of ids) {
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    if (l && !r) {
      out.push({ kind: "export", mediaId: id, local: l });
      continue;
    }
    if (!l && r) {
      out.push({ kind: "import", mediaId: id, remote: r });
      continue;
    }
    if (!l || !r) continue;

    if (sameContent(l, r)) {
      out.push({ kind: "noop", mediaId: id });
      continue;
    }
    const localChanged = l.updatedAt > since;
    const remoteChanged = r.updatedAt > since;

    if (localChanged && !remoteChanged) {
      out.push({ kind: "push", mediaId: id, local: l });
    } else if (remoteChanged && !localChanged) {
      out.push({ kind: "pull", mediaId: id, remote: r });
    } else {
      const conflict: string[] = [];
      const newerIsLocal = l.updatedAt >= r.updatedAt;
      const merged: RemoteEntry = {
        mediaId: id,
        status: newerIsLocal ? l.status : r.status,
        progress: Math.max(l.progress, r.progress),
        score: pick(l.score, r.score, newerIsLocal),
        notes: pick(l.notes || null, r.notes || null, newerIsLocal) ?? "",
        updatedAt: Math.max(l.updatedAt, r.updatedAt),
        startedAt: earliest(l.startedAt, r.startedAt),
        completedAt: newerIsLocal ? (l.completedAt ?? r.completedAt) : (r.completedAt ?? l.completedAt),
        repeat: Math.max(l.repeat, r.repeat),
      };
      if (l.status !== r.status) conflict.push("status");
      if (l.progress !== r.progress) conflict.push("progress");
      if ((l.score ?? null) !== (r.score ?? null)) conflict.push("score");
      if ((l.notes || "") !== (r.notes || "")) conflict.push("notes");
      const pushRemote = !sameContent(merged, r);
      out.push({ kind: "merge", mediaId: id, merged, pushRemote, conflict });
    }
  }
  return out;
}

function pick<T>(a: T | null, b: T | null, preferA: boolean): T | null {
  if (a == null) return b;
  if (b == null) return a;
  return preferA ? a : b;
}

function earliest(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function sameContent(l: Pick<LibraryEntry, "status" | "progress" | "score" | "notes">, r: Pick<RemoteEntry, "status" | "progress" | "score" | "notes">) {
  return l.status === r.status && l.progress === r.progress && (l.score ?? null) === (r.score ?? null) && (l.notes || "") === (r.notes || "");
}

export function fuzzyToIso(d: { year: number | null; month: number | null; day: number | null } | null | undefined): string | null {
  if (!d?.year) return null;
  const m = String(d.month ?? 1).padStart(2, "0");
  const day = String(d.day ?? 1).padStart(2, "0");
  return `${d.year}-${m}-${day}`;
}

export function isoToFuzzy(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  return { year: y || null, month: m || null, day: d || null };
}
