"use client";

import Link from "next/link";
import { KeyRound, Link2, Palette, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentPath } from "@/stores/route";

const ITEMS = [
  { href: "/settings", label: "Overview", icon: Settings },
  { href: "/settings/appearance", label: "Appearance", icon: Palette },
  { href: "/settings/account", label: "Account", icon: KeyRound },
  { href: "/settings/privacy", label: "Privacy", icon: Shield },
  { href: "/settings/integrations", label: "Integrations", icon: Link2 },
];

export function SettingsNav() {
  const path = useCurrentPath();
  return (
    <nav aria-label="Settings" className="scrollbar-none -mx-[var(--k-gutter)] flex gap-1 overflow-x-auto px-[var(--k-gutter)] lg:sticky lg:top-[calc(var(--k-nav-h)+24px)] lg:mx-0 lg:flex-col lg:px-0">
      {ITEMS.map((i) => {
        const active = path === i.href;
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={cn("k-nav-item shrink-0 !justify-start", active && "bg-[var(--k-btn-ghost)] !text-fg")} data-active={active}>
            <i.icon className="size-4" aria-hidden /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
