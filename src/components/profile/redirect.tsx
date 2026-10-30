"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/stores/auth";

/** /profile → tu propio universo (perfil de cuenta o perfil personalizado del dispositivo). */
export function ProfileRedirect() {
  const { status, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "signed-in") {
      router.replace(profile?.username ? `/profile/${encodeURIComponent(profile.username)}` : "/profile/guest");
    } else {
      router.replace("/profile/guest");
    }
  }, [status, profile, router]);

  return <div className="k-skeleton container-k mt-10 h-64" aria-busy="true" />;
}
