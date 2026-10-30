import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

// Hosts that serve the authorized demo media (see src/lib/media/demo-catalog.ts).
const mediaHosts = [
  "https://test-streams.mux.dev",
  "https://devstreaming-cdn.apple.com",
  "https://demo.unified-streaming.com",
];

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; the theme script is inline too.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://s4.anilist.co https://img1.ak.crunchyroll.com https://img.anili.st https://i.ytimg.com ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  // hls.js uses an inline data: WebVTT placeholder for subtitle tracks.
  `media-src 'self' blob: data: ${mediaHosts.join(" ")}`,
  `connect-src 'self' https://graphql.anilist.co ${mediaHosts.join(" ")} ${supabaseOrigin} ${supabaseWs}${isDev ? " ws://localhost:*" : ""}`.trim(),
  "frame-src https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  devIndicators: false,
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
    // Banners (the LCP image) are resized to AVIF/WebP per device. Covers and
    // portraits are already small on AniList's CDN and load directly (see SafeImage).
    formats: ["image/avif", "image/webp"],
    // AniList file names are content-hashed, so optimized copies can be cached for long.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "img.anili.st" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: `camera=(), microphone=(), geolocation=(), picture-in-picture=(self "https://www.youtube-nocookie.com"), fullscreen=(self "https://www.youtube-nocookie.com"), autoplay=(self "https://www.youtube-nocookie.com"), encrypted-media=(self "https://www.youtube-nocookie.com")` },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
