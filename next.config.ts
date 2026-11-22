import type { NextConfig } from "next";

const apkDownloadUrl =
  process.env.NEXT_PUBLIC_APK_URL ||
  "https://raw.githubusercontent.com/AndrehhX/Kaze/479c81ed2d8880b949b7ff2219b97c409f75065b/public/kaze.apk";

const isDev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; the theme script is inline too.
  `script-src 'self' 'unsafe-inline' https://bauval.org https://*.bauval.org${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: https://s4.anilist.co https://img1.ak.crunchyroll.com https://img.anili.st https://i.ytimg.com ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  // hls.js uses an inline data: WebVTT placeholder for subtitle tracks.
  "media-src 'self' blob: data: https:",
  `connect-src 'self' blob: data: https: ${supabaseOrigin} ${supabaseWs}${isDev ? " ws://localhost:*" : ""}`.trim(),
  "frame-src 'self' https://www.youtube-nocookie.com https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Servidor autónomo para la VPS (deploy/). En Vercel no tiene efecto.
  output: "standalone",
  compress: true,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "motion",
      "motion/react",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-dialog",
      "sonner",
      "zustand",
      "@tanstack/react-query",
      "clsx",
      "tailwind-merge",
    ],
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 50,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "img.anili.st" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path((?!robots\\.txt$).*)",
        has: [
          {
            type: "header",
            key: "user-agent",
            value:
              ".*(?:GoogleOther|Google-Extended|ElevenlabsCrawler|SERankingBacklinksBot|AhrefsBot|SemrushBot|MJ12bot|DotBot|Bytespider|GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|anthropic-ai|CCBot|Amazonbot|PetalBot|BLEXBot|DataForSeoBot|PerplexityBot|Meta-ExternalAgent|FacebookBot|YandexBot|Baiduspider|Sogou|Scrapy|SeekportBot|Barkrowler|ZoominfoBot).*",
          },
        ],
        destination: "/robots.txt",
        permanent: false,
      },
      {
        source: "/kaze.apk",
        destination: apkDownloadUrl,
        permanent: false,
      },
      {
        source: "/api/stream/proxy",
        destination: "https://orunei-stream.thealex230820.workers.dev/api/stream/proxy",
        permanent: true,
      },
      {
        source: "/api/stream/proxy/:path*",
        destination: "https://orunei-stream.thealex230820.workers.dev/api/stream/proxy/:path*",
        permanent: true,
      },
      {
        source: "/_next/image",
        destination: "/404",
        permanent: true,
      },
      {
        source: "/wp-admin/:path*",
        destination: "/404",
        permanent: true,
      },
      {
        source: "/wp-content/:path*",
        destination: "/404",
        permanent: true,
      },
      {
        source: "/wp-includes/:path*",
        destination: "/404",
        permanent: true,
      },
      {
        source: "/wp-login.php",
        destination: "/404",
        permanent: true,
      },
      {
        source: "/xmlrpc.php",
        destination: "/404",
        permanent: true,
      },
      {
        source: "/manga/:path+",
        destination: "/manga",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      // Blindaje de Rutas Privadas / Autenticadas (Cero Fugas de Sesión en CDN)
      {
        source: "/(library|profile|settings)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/api/(account|playback|auth)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
        ],
      },
      // Blindaje de Rutas Públicas (Caché Perimetral Edge $0 en Cloudflare)
      {
        source: "/anime/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/(discover|seasonal)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/api/anilist/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
      // Sección Manga en Mantenimiento: respuesta ultra ligera y cacheada en Edge
      {
        source: "/manga",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/ads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/(icon.svg|icon-192.png|icon-512.png|apple-touch-icon.png|manifest.json)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: `camera=(), microphone=(), geolocation=(), picture-in-picture=(self "https://www.youtube-nocookie.com"), fullscreen=(self "https://www.youtube-nocookie.com"), autoplay=(self "https://www.youtube-nocookie.com"), encrypted-media=(self "https://www.youtube-nocookie.com")`,
          },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
