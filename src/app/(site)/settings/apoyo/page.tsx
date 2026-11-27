import type { Metadata } from "next";
import { SupportCosmeticsPanel } from "@/components/support/cosmetics-panel";

export const metadata: Metadata = { title: "Apoyo · Configuración" };

export default function SupportSettingsPage() {
  return <SupportCosmeticsPanel />;
}
