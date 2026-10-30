import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchPartiesIndex } from "@/components/watch-party/parties";

export const metadata: Metadata = { title: "Salas de Cine · Watch Parties" };

export default function Page() {
  return (
    <div className="container-k pt-8">
      <p className="k-label text-primary-ink">Visualización sincronizada</p>
      <h1 className="font-display text-title mt-2">Salas de Cine (Watch Parties)</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Mira anime en tiempo real con amigos en perfecta sincronía. El anfitrión controla la reproducción y la transmisión se mantiene alineada automáticamente en todos los dispositivos.
      </p>
      <Suspense fallback={<div className="k-skeleton mt-8 h-64" />}>
        <WatchPartiesIndex />
      </Suspense>
    </div>
  );
}
