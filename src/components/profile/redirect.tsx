"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/stores/auth";

/** /profile → your own universe (account profile, or the on-device guest profile). */
export function ProfileRedirect() {
  const { status, profile } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "loading" || (status === "signed-in" && !profile)) return;
    router.replace(profile ? `/profile/${profile.username}` : "/profile/guest");
  }, [status, profile, router]);
  return <div className="k-skeleton container-k mt-10 h-64" aria-busy="true" />;
}
