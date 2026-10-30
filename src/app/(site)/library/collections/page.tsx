import type { Metadata } from "next";
import { CollectionsIndex } from "@/components/library/collections";

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsPage() {
  return <CollectionsIndex />;
}
