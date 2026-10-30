import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscussionThread } from "@/components/social/discussions";

export const metadata: Metadata = { title: "Discussion" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: PageProps<"/community/discussions/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return (
    <div className="mt-6 max-w-4xl">
      <Link href="/community/discussions" className="k-btn k-btn-ghost k-btn-sm mb-4">
        ← All discussions
      </Link>
      <DiscussionThread id={id} />
    </div>
  );
}
