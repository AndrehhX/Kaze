import type { Metadata } from "next";
import { WrappedView } from "@/components/wrapped/wrapped-view";

export const metadata: Metadata = {
  title: "KAZE Wrapped 2026 · Tu año en anime",
  description: "Descubre tu año en anime: horas vistas, tus animes y géneros favoritos, tu mes más otaku y tu personalidad. Compártelo con tus amigos.",
  alternates: { canonical: "/wrapped" },
};

export default function WrappedPage() {
  return <WrappedView year={2026} />;
}
