import type { Metadata } from "next";
import { MangaMaintenance } from "@/components/manga/manga-maintenance";

export const metadata: Metadata = {
  title: "Manga en Mantenimiento · KAZE",
  description: "La sección de lectura y catálogo de manga se encuentra en optimización y mantenimiento preventivo.",
  robots: { index: false, follow: false },
};

export default function MangaLayout() {
  return <MangaMaintenance />;
}
