import type { Metadata } from "next";
import { CollectionDetail } from "@/components/library/collections";

export const metadata: Metadata = { title: "Colección" };

export function generateStaticParams() {
  return [{ id: "demo" }];
}

export default async function CollectionPage({ params }: PageProps<"/library/collections/[id]">) {
  const { id } = await params;
  return <CollectionDetail id={id} />;
}
