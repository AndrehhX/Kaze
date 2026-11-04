"use client";

import Script from "next/script";
import { DEFAULT_AD_CONFIG } from "@/lib/ads/config";

export function MonetagScript() {
  if (!DEFAULT_AD_CONFIG.enabled || !DEFAULT_AD_CONFIG.monetagZoneId) {
    return null;
  }

  return (
    <Script
      id="monetag-inpage-push"
      src="https://nap5k.com/tag.min.js"
      data-zone={DEFAULT_AD_CONFIG.monetagZoneId}
      strategy="lazyOnload"
    />
  );
}
