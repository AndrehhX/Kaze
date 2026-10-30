import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsOverview } from "@/components/settings/panels";

export const metadata: Metadata = { title: "Settings · Settings" };

export default function Page() {
  return (
    <Suspense fallback={<div className="k-skeleton h-64" />}>
      <SettingsOverview />
    </Suspense>
  );
}
