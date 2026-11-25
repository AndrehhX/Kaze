import type { Metadata } from "next";
import { CommunityHub, CommunityTabs } from "@/components/social/community";

export const metadata: Metadata = { title: "Comunidad", description: "Reseñas, debates y actividad de la comunidad de KAZE.", alternates: { canonical: "/community" } };

export default function CommunityPage() {
  return (
    <>
      <CommunityTabs active="hub" />
      <CommunityHub />
    </>
  );
}
