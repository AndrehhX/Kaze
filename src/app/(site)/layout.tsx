import { Suspense } from "react";
import { SiteHeader } from "@/components/shell/site-header";
import { MobileNav } from "@/components/shell/mobile-nav";
import { PathnameSync } from "@/stores/route";
import { SiteFooter } from "@/components/shell/site-footer";
import { CommandPalette } from "@/components/shell/command-palette";
import { ThemeBackdrop } from "@/components/shell/backdrop";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { CompletionCelebration } from "@/components/anime/completion-celebration";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <ThemeBackdrop />
      {/* The pathname is runtime data: it streams in separately so the nav itself renders immediately. */}
      <Suspense fallback={null}>
        <PathnameSync />
      </Suspense>
      <SiteHeader />
      <OfflineBanner />
      <main id="main" className="relative min-h-[70dvh]">
        {children}
      </main>
      <SiteFooter />
      <MobileNav />
      <CommandPalette />
      <CompletionCelebration />
    </>
  );
}

