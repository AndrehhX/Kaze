"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { useSettings } from "@/stores/settings";
import { useLibrary } from "@/stores/library";
import { useProgress } from "@/stores/progress";
import { useLocal } from "@/stores/local";
import { AuthProvider } from "./auth-provider";
import { THEMES } from "@/lib/themes";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,
            gcTime: 60 * 60_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => count < 2 && (err as { status?: number }).status !== 404,
          },
        },
      }),
  );

  useEffect(() => {
    // Persisted stores skip SSR hydration to avoid markup mismatches; load them once mounted.
    void useSettings.persist.rehydrate();
    void useLibrary.persist.rehydrate();
    void useProgress.persist.rehydrate();
    void useLocal.persist.rehydrate();
  }, []);

  const motion = useSettings((s) => s.motion);
  const theme = useSettings((s) => s.theme);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion={motion === "reduce" ? "always" : motion === "full" ? "never" : "user"}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          theme={THEMES[theme].scheme}
          position="bottom-center"
          offset={88}
          toastOptions={{
            className: "k-panel !text-fg !font-sans",
            style: { borderRadius: "var(--k-radius-panel)", background: "var(--k-glass)", color: "var(--k-text)", border: "var(--k-card-border)" },
          }}
        />
      </MotionConfig>
    </QueryClientProvider>
  );
}
