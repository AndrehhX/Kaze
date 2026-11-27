import type { Metadata } from "next";
import { SupportPage } from "@/components/support/support-page";

export const metadata: Metadata = {
  title: "Apoya KAZE",
  description: "KAZE es gratis y lo seguirá siendo. Si te gusta, apoyar en Ko-fi ayuda a pagar el servidor y te da cosméticos para la comunidad.",
  alternates: { canonical: "/apoyar" },
};

export default function ApoyarPage() {
  return <SupportPage />;
}
