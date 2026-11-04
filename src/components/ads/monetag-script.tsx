"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { DEFAULT_AD_CONFIG } from "@/lib/ads/config";

export function MonetagScript() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!DEFAULT_AD_CONFIG.enabled || !DEFAULT_AD_CONFIG.monetagZoneId) {
      return;
    }

    // Trigger on first user interaction or after a 3.5s idle window to preserve LCP/TBT scores
    const trigger = () => {
      setShouldLoad(true);
      cleanup();
    };

    const timer = setTimeout(trigger, 3500);

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", trigger);
      window.removeEventListener("pointerdown", trigger);
      window.removeEventListener("keydown", trigger);
      window.removeEventListener("touchstart", trigger);
    };

    window.addEventListener("scroll", trigger, { passive: true, once: true });
    window.addEventListener("pointerdown", trigger, { passive: true, once: true });
    window.addEventListener("keydown", trigger, { passive: true, once: true });
    window.addEventListener("touchstart", trigger, { passive: true, once: true });

    return cleanup;
  }, []);

  if (!DEFAULT_AD_CONFIG.enabled || !DEFAULT_AD_CONFIG.monetagZoneId || !shouldLoad) {
    return null;
  }

  return (
    <Script
      id="monetag-inpage-push"
      src="https://nap5k.com/tag.min.js"
      data-zone={DEFAULT_AD_CONFIG.monetagZoneId}
      strategy="afterInteractive"
    />
  );
}
