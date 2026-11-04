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
  title: { default: "KAZE — The Anime Universe", template: "%s · KAZE" },
  description: "Discover, track and watch anime together. Cinematic discovery powered by AniList, a personal library, watch parties and four hand-crafted visual themes.",
  applicationName: "KAZE",
  openGraph: { type: "website", siteName: "KAZE", title: "KAZE — The Anime Universe" },
  icons: { icon: "/icon.svg" },
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
        {/* Applies the saved theme before first paint — no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* Posters and covers load straight from AniList's CDN. */}
        <link rel="preconnect" href="https://s4.anilist.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://s4.anilist.co" />
        <link rel="preconnect" href="https://orunei-stream.thealex230820.workers.dev" crossOrigin="" />
        <link rel="dns-prefetch" href="https://orunei-stream.thealex230820.workers.dev" />
        <link rel="preconnect" href="https://afgvxmqapzikggmasskz.supabase.co" crossOrigin="" />
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
