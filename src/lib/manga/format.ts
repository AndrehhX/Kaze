import { statusLabel } from "@/lib/utils";

/** Plain formatting helpers shared by server and client components. */
export function mangaStatusLabel(status: string | null | undefined) {
  if (status === "RELEASING") return "En publicación";
  return statusLabel(status);
}

/** Chapter/volume counts exactly as AniList knows them — unknown stays unknown. */
export function lengthLabel(m: { chapters: number | null; volumes: number | null; status?: string | null }) {
  const parts = [m.chapters ? `${m.chapters} cap.` : null, m.volumes ? `${m.volumes} vol.` : null].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return m.status === "RELEASING" ? "En curso" : "Extensión desconocida";
}
