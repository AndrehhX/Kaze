import type { Metadata } from "next";
import { CollectionsIndex } from "@/components/library/collections";

export const metadata: Metadata = { title: "Colecciones" };

export default function CollectionsPage() {
  return <CollectionsIndex />;
}
