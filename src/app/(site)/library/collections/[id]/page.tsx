import type { Metadata } from "next";
import { CollectionDetail } from "@/components/library/collections";

export const metadata: Metadata = { title: "Collection" };

export default async function CollectionPage({ params }: PageProps<"/library/collections/[id]">) {
  const { id } = await params;
  return <CollectionDetail id={id} />;
}
