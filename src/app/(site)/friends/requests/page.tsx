import type { Metadata } from "next";
import Link from "next/link";
import { RequestsPage } from "@/components/social/friends";

export const metadata: Metadata = { title: "Solicitudes de amistad" };

export default function Page() {
  return (
    <div className="container-k pt-8">
      <Link href="/friends" className="k-btn k-btn-ghost k-btn-sm">← Amigos</Link>
      <h1 className="font-display text-title mt-4">Solicitudes de amistad</h1>
      <RequestsPage />
    </div>
  );
}
