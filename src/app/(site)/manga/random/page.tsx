import type { Metadata } from "next";
import { RandomVault } from "@/components/manga/vault/random-vault";

export const metadata: Metadata = { title: "Ruleta de manga", description: "Deja que la estantería elija tu próxima lectura entre los manga que cumplen tus filtros." };

export default function MangaRandomPage() {
  return <RandomVault />;
}
