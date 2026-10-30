import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSettings } from "@/components/settings/panels";

export const metadata: Metadata = { title: "Account · Settings" };

export default function Page() {
  return (
    <Suspense fallback={<div className="k-skeleton h-64" />}>
      <AccountSettings />
    </Suspense>
  );
}
