import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { Providers } from "@/components/providers/providers";
import { DEFAULT_THEME, themeBootScript } from "@/lib/themes";
import { siteUrl } from "@/lib/env";

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
    <html lang="en" data-theme={DEFAULT_THEME} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint — no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* Posters and covers load straight from AniList's CDN. */}
        <link rel="preconnect" href="https://s4.anilist.co" crossOrigin="" />
      </head>
      <body className="antialiased">
        <a href="#main" className="k-btn k-btn-primary fixed left-3 top-3 z-[100] -translate-y-24 focus:translate-y-0">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
