import type { Metadata } from "next";
import { Suspense } from "react";
import { PrivacySettings } from "@/components/settings/panels";

export const metadata: Metadata = { title: "Privacidad · Configuración" };

export default function Page() {
  return (
    <Suspense fallback={<div className="k-skeleton h-64" />}>
      <PrivacySettings />
    </Suspense>
  );
}
