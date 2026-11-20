import type { Metadata } from "next";
import { MangaCollectionsView } from "@/components/manga/library/collections";

export const metadata: Metadata = { title: "Colecciones de manga" };

export default function MangaCollectionsPage() {
  return <MangaCollectionsView />;
}
