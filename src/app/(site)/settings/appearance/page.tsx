import type { Metadata } from "next";
import { Suspense } from "react";
import { AppearanceSettings } from "@/components/settings/panels";

export const metadata: Metadata = { title: "Apariencia · Configuración" };

export default function Page() {
  return (
    <Suspense fallback={<div className="k-skeleton h-64" />}>
      <AppearanceSettings />
    </Suspense>
  );
}
