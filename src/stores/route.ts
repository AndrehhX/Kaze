"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { create } from "zustand";

/**
 * The current pathname, mirrored into a store. With Cache Components, reading
 * usePathname() suspends during prerendering; mirroring it lets navigation
 * chrome render immediately while only the "active" highlight waits.
 */
export const useRoute = create<{ path: string | null }>(() => ({ path: null }));

export function PathnameSync() {
  const path = usePathname();
  useEffect(() => {
    useRoute.setState({ path });
  }, [path]);
  return null;
}

export function useCurrentPath() {
  return useRoute((s) => s.path) ?? "";
}
