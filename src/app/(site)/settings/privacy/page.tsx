import type { Metadata } from "next";
import { Suspense } from "react";
import { PrivacySettings } from "@/components/settings/panels";

export const metadata: Metadata = { title: "Privacy · Settings" };

export default function Page() {
  return (
    <Suspense fallback={<div className="k-skeleton h-64" />}>
      <PrivacySettings />
    </Suspense>
  );
}
