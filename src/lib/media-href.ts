/**
 * Social rows (reviews, discussions, activity) store a media snapshot. Manga snapshots carry `kind: "manga"`
 * (or a print format), so links can point at the right section. Anime remains the default.
 */
export function isMangaSnapshot(s: { kind?: string | null; format?: string | null } | null | undefined) {
  return Boolean(s && (s.kind === "manga" || s.format === "MANGA" || s.format === "NOVEL" || s.format === "ONE_SHOT"));
}

export function mediaHref(id: number | null | undefined, snapshot?: { kind?: string | null; format?: string | null; slug?: string | null } | null) {
  if (!id) return "#";
  if (isMangaSnapshot(snapshot)) return snapshot?.slug ? `/manga/${snapshot.slug}` : `/manga/${id}`;
  return `/anime/${id}`;
}
