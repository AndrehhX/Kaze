import type { Metadata } from "next";
import { ShelfPage } from "@/components/manga/vault/shelf-page";

export const metadata: Metadata = { title: "La Bóveda de manga", description: "Tu colección de manga como una estantería de tomos en 3D." };

export default function MangaShelfPage() {
  return <ShelfPage />;
}
