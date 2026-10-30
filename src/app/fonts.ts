import { Geist, Geist_Mono, Noto_Sans_JP, Shippori_Mincho, Space_Grotesk, Zen_Maru_Gothic } from "next/font/google";

export const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
export const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap", weight: ["500", "700"] });
// Japanese faces are large; don't preload — the browser fetches only the unicode ranges a page uses.
export const notoJp = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-noto-jp", display: "swap", weight: ["400", "700"], preload: false });
export const shippori = Shippori_Mincho({ subsets: ["latin"], variable: "--font-shippori", display: "swap", weight: ["500", "800"], preload: false });
export const zenMaru = Zen_Maru_Gothic({ subsets: ["latin"], variable: "--font-zen-maru", display: "swap", weight: ["500", "700"], preload: false });

export const fontVariables = [geist, geistMono, spaceGrotesk, notoJp, shippori, zenMaru].map((f) => f.variable).join(" ");
