import Link from "next/link";
import type { ReactNode } from "react";
import { DISCORD_INVITE_URL } from "@/components/shell/nav-config";

/** Plantilla de las páginas legales (/privacidad y /terminos): texto legible, sin adornos. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="container-k max-w-3xl py-10 md:py-14">
      <p className="k-label text-muted">Orunei · KAZE</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Última actualización: {updated}</p>
      <div className="mt-6 text-base leading-relaxed text-fg/90">{intro}</div>
      <div className="mt-8 space-y-8">{children}</div>
      <footer className="mt-12 border-t border-line pt-6 text-sm text-muted">
        ¿Dudas? Escríbenos en nuestro{" "}
        <a className="text-primary-ink underline" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
          servidor de Discord
        </a>
        . Ver también:{" "}
        <Link className="text-primary-ink underline" href="/privacidad">
          Política de privacidad
        </Link>{" "}
        ·{" "}
        <Link className="text-primary-ink underline" href="/terminos">
          Condiciones de uso
        </Link>
        .
      </footer>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-fg/85 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">{children}</div>
    </section>
  );
}
