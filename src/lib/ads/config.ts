export interface AdConfiguration {
  enabled: boolean;
  monetagZoneId?: string;
  adsterraKey728x90?: string;
  adsterraNativeId?: string;
  customBannerUrl?: string;
  kofiUrl: string;
}

export const DEFAULT_AD_CONFIG: AdConfiguration = {
  enabled: process.env.NEXT_PUBLIC_DISABLE_ADS !== "true",
  monetagZoneId: process.env.NEXT_PUBLIC_MONETAG_ZONE_ID ?? "12187247",
  adsterraKey728x90: process.env.NEXT_PUBLIC_ADSTERRA_728X90_KEY ?? "9ab8bd629915bbaf089db67c630d53b8",
  adsterraNativeId: process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_ID ?? "b24b161e910f58e46e26ca5675ab3fca",
  customBannerUrl: process.env.NEXT_PUBLIC_AD_BANNER_URL,
  kofiUrl: "https://ko-fi.com/andrehwallet/goal?g=0",
};

/**
 * Comprueba si el usuario ocultó el banner para esta ubicación en las últimas 24 horas.
 */
export function isAdDismissed(placement: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(`kaze_ad_dismissed_${placement}`);
    if (!raw) return false;
    const expiresAt = Number.parseInt(raw, 10);
    if (Number.isNaN(expiresAt)) return false;
    if (Date.now() > expiresAt) {
      localStorage.removeItem(`kaze_ad_dismissed_${placement}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Guarda el descarte temporal del anuncio en localStorage.
 */
export function dismissAd(placement: string, hours: number = 24): void {
  if (typeof window === "undefined") return;
  try {
    const expiresAt = Date.now() + hours * 60 * 60 * 1000;
    localStorage.setItem(`kaze_ad_dismissed_${placement}`, expiresAt.toString());
  } catch {
    // Ignore localStorage quota / private browsing errors
  }
}
