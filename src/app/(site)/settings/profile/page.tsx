import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileSettingsPanel } from "@/components/settings/profile-panel";

export const metadata: Metadata = {
  title: "Perfil de Orunei · Configuración",
  description: "Personaliza tu avatar, marco animado, portada, bio y vitrina de Orunei.",
};

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={<div className="k-skeleton h-96 w-full rounded-2xl" />}>
      <ProfileSettingsPanel />
    </Suspense>
  );
}
