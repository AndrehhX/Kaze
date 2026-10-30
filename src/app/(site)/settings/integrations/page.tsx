import type { Metadata } from "next";
import { Suspense } from "react";
import { IntegrationSettings } from "@/components/settings/panels";

export const metadata: Metadata = { title: "Integraciones · Configuración" };

export default function Page() {
  return (
    <Suspense fallback={<div className="k-skeleton h-64" />}>
      <IntegrationSettings />
    </Suspense>
  );
}
