import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { Providers } from "@/components/providers/providers";
import { DEFAULT_THEME, themeBootScript } from "@/lib/themes";
import { siteUrl } from "@/lib/env";
import { Analytics } from "@vercel/analytics/react";
import { MonetagScript } from "@/components/ads/monetag-script";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KAZE — Ver Anime Online Gratis en HD 1080p · Orunei",
    template: "%s · KAZE (Orunei)",
  },
  description:
    "Kaze (Orunei): Tu plataforma para ver anime online gratis en HD 1080p con audio Latino y Sub Español. Miles de episodios sin cortes ni anuncios invasivos, sincronizado con AniList.",
  applicationName: "KAZE",
  keywords: [
    "kaze",
    "kaze anime",
    "orunei",
    "orunei anime",
    "anime free",
    "ver anime gratis",
    "ver anime online",
    "anime online hd",
    "anime latino",
    "anime sub español",
    "anime 1080p",
    "kaze orunei",
    "orunei v2",
  ],
  authors: [{ name: "KAZE Team" }],
  creator: "KAZE",
  publisher: "KAZE",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "KAZE Anime · Orunei",
    title: "KAZE — Ver Anime Online Gratis en HD 1080p · Orunei",
    description:
      "Kaze (Orunei): Mira anime gratis en HD con doblaje Latino y subtitulado al español. Reproducción ultra rápida y sin publicidad molesta.",
    url: siteUrl,
    locale: "es_LA",
    alternateLocale: ["es_ES", "en_US"],
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "KAZE Anime Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KAZE — Ver Anime Online Gratis en HD 1080p · Orunei",
    description: "Kaze (Orunei): Disfruta de anime online gratis en HD 1080p sin molestos popups.",
    images: ["/icon.svg"],
  },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080810" },
    { media: "(prefers-color-scheme: light)", color: "#fff9fb" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" translate="no" data-theme={DEFAULT_THEME} className={`${fontVariables} notranslate`} suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <meta name="monetag" content="8770d2148e28c17ef3c8edcf87c6ff48" />
        {/* JSON-LD Schema estructurado para Google Search */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "KAZE Anime",
              alternateName: ["Orunei", "Kaze", "Orunei Anime", "KAZE Orunei"],
              url: siteUrl,
              description: "Plataforma para ver anime online gratis en HD con audio Latino y Sub Español.",
              inLanguage: "es",
              potentialAction: {
                "@type": "SearchAction",
                target: `${siteUrl}/discover?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        {/* Applies the saved theme before first paint — no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* Posters and covers load straight from AniList's CDN. */}
        <link rel="preconnect" href="https://s4.anilist.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://s4.anilist.co" />
        <link rel="dns-prefetch" href="https://orunei-stream.thealex230820.workers.dev" />
        <link rel="dns-prefetch" href="https://afgvxmqapzikggmasskz.supabase.co" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <a href="#main" className="k-btn k-btn-primary fixed left-3 top-3 z-[100] -translate-y-24 focus:translate-y-0">
          Saltar al contenido
        </a>
        <Providers>{children}</Providers>
        <MonetagScript />
        <Analytics />
      </body>
    </html>
  );
}
