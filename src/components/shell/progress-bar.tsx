"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Ultra-fast top loading laser bar for instant tactile feedback on every click/navigation.
 * Zero external dependencies.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Forcibly clear any stuck pointer-events or scroll locks from modals/drawers
    if (typeof document !== "undefined") {
      document.body.style.pointerEvents = "";
      document.body.removeAttribute("data-scroll-locked");
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    // When pathname changes, complete and dismiss the progress bar
    if (loading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pathname, loading]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Find the closest anchor tag
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external links, anchors, or new tabs
      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        target.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey
      ) {
        return;
      }

      // If it's navigating to another internal route
      const current = window.location.pathname;
      const targetUrl = new URL(href, window.location.href);
      if (targetUrl.pathname !== current) {
        setLoading(true);
        setProgress(35);
        setTimeout(() => setProgress(75), 100);
      }
    };

    document.addEventListener("click", handleClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2.5px] overflow-hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_10px_var(--k-primary)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "100ms" : "250ms",
        }}
      />
    </div>
  );
}
