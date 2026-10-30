import type { Metadata } from "next";
import { Roulette } from "@/components/discover/roulette";

export const metadata: Metadata = { title: "Anime Roulette" };

export default function RoulettePage() {
  return <Roulette />;
}
