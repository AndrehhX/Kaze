import type { Metadata } from "next";
import { MangaStatsView } from "@/components/manga/library/stats";

export const metadata: Metadata = { title: "Estadísticas de lectura" };

export default function MangaStatsPage() {
  return <MangaStatsView />;
}
