import type { Metadata } from "next";
import { MoodExplorer } from "@/components/discover/mood-explorer";

export const metadata: Metadata = { title: "Explorador de emociones" };

export default function MoodsPage() {
  return <MoodExplorer />;
}
