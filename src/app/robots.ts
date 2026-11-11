import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const disallowedBots = [
    "GoogleOther",
    "Google-Extended",
    "ElevenlabsCrawler",
    "SERankingBacklinksBot",
    "AhrefsBot",
    "SemrushBot",
    "MJ12bot",
    "DotBot",
    "Bytespider",
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "anthropic-ai",
    "CCBot",
    "Amazonbot",
    "PetalBot",
    "BLEXBot",
    "DataForSeoBot",
    "PerplexityBot",
    "Meta-ExternalAgent",
    "FacebookBot",
    "YandexBot",
    "Baiduspider",
    "Sogou",
    "Scrapy",
    "SeekportBot",
    "Barkrowler",
    "ZoominfoBot",
  ];

  const generalDisallow = [
    "/api/",
    "/auth/callback",
    "/watch/",
    "/watch-parties",
    "/library",
    "/settings/",
    "/friends",
    "/profile/",
    "/discover?*",
    "/seasonal?*",
  ];

  return {
    rules: [
      ...disallowedBots.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
      {
        userAgent: "*",
        allow: "/",
        disallow: generalDisallow,
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: generalDisallow,
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: generalDisallow,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
