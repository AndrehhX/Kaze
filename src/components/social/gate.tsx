"use client";

import Link from "next/link";
import { LogIn, Server } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/stores/auth";
import { useCurrentPath } from "@/stores/route";
import { EmptyState, Skeleton } from "@/components/ui/primitives";

/** Renders children only for signed-in users; otherwise an honest explanation. */
export function AuthGate({ children, feature, jp = "門" }: { children: ReactNode; feature: string; jp?: string }) {
  const status = useAuth((s) => s.status);
  const path = useCurrentPath() || "/";
  if (status === "loading") return <Skeleton className="h-40" />;
  if (status === "unconfigured") return <BackendMissing feature={feature} />;
  if (status === "signed-out")
    return (
      <EmptyState
        icon={<LogIn className="size-6" />}
        jp={jp}
        title={`Inicia sesión para usar ${feature}`}
        body="Tu cuenta mantiene tu biblioteca, amigos y configuración sincronizados en todos tus dispositivos."
        action={
          <>
            <Link href={`/login?next=${encodeURIComponent(path)}`} className="k-btn k-btn-primary k-btn-sm">
              Sign in
            </Link>
            <Link href="/register" className="k-btn k-btn-outline k-btn-sm">
              Create account
            </Link>
          </>
        }
      />
    );
  return <>{children}</>;
}

export function BackendMissing({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon={<Server className="size-6" />}
      jp="未"
      title={`${feature} no está configurado en este entorno`}
      body={
        <>
          Accounts and social features run on Supabase. Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and apply the migrations — see the README. Catalog browsing, the player and your on-device library work
          without it.
        </>
      }
    />
  );
}
