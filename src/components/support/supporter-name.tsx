import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TIERS, activeTier, oneSupporter, visibleCosmetics, type SupporterPublic } from "@/lib/support/tiers";

/** Insignia 風 (nivel activo) y ★ Fundador. Enlazan a /apoyar: así la gente descubre el apoyo viéndolo en otros. */
export function SupporterBadges({ supporter, size = "sm", link = true }: { supporter: unknown; size?: "sm" | "md"; link?: boolean }) {
  const s = oneSupporter(supporter);
  const tier = activeTier(s);
  if (!s || (!tier && !s.founder)) return null;
  const label = [tier ? `Apoya KAZE · ${TIERS[tier].name}` : null, s.founder ? "Fundador de KAZE" : null].filter(Boolean).join(" · ");
  const body = (
    <span className={cn("inline-flex items-center gap-1 align-middle", size === "md" ? "text-xs" : "text-[0.65rem]")}>
      {tier > 0 && (
        <span className={cn("k-sup-badge", `k-sup-${TIERS[tier as 1 | 2 | 3].id}`, size === "md" && "k-sup-badge-md")} aria-hidden>
          風
        </span>
      )}
      {s.founder && (
        <span className={cn("k-sup-founder", size === "md" && "k-sup-badge-md")} aria-hidden>
          ★
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
  return link ? (
    <Link href="/apoyar" title={label} className="inline-flex hover:opacity-80">
      {body}
    </Link>
  ) : (
    <span title={label}>{body}</span>
  );
}

/** Nombre con el color o el degradado que eligió quien apoya (solo si su nivel sigue activo). */
export function SupporterName({ supporter, children, className }: { supporter: unknown; children: ReactNode; className?: string }) {
  const eq = visibleCosmetics(oneSupporter(supporter));
  return <span className={cn(className, eq.nameGradient ? `k-grad-name k-grad-${eq.nameGradient}` : eq.nameColor ? `k-name-${eq.nameColor}` : null)}>{children}</span>;
}

/** Marco de avatar de apoyo, si lo tiene puesto (tiene prioridad sobre el marco gratis). */
export function supporterFrame(supporter: unknown): string | null {
  return visibleCosmetics(oneSupporter(supporter)).avatarFrame ?? null;
}

/** Clase del marco de comentario (Viento), o null. */
export function commentFrameClass(supporter: unknown): string | null {
  const f = visibleCosmetics(oneSupporter(supporter)).commentFrame;
  return f ? `k-cframe k-cframe-${f}` : null;
}

export type { SupporterPublic };
