"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, LogIn, LogOut, Paintbrush, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useGuestProfile } from "@/lib/profile/guest";
import { cn } from "@/lib/utils";

const item = "flex min-h-10 items-center gap-2.5 rounded-[min(var(--k-radius-btn),10px)] px-3 text-sm outline-none cursor-pointer data-[highlighted]:bg-[var(--k-btn-ghost)]";

export function Avatar({
  src,
  name,
  size = 32,
  frame,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  frame?: string | null;
}) {
  const frameClass =
    frame === "cosmic-fire"
      ? "p-[3px] bg-gradient-to-tr from-amber-500 via-rose-500 to-orange-400 shadow-[0_0_12px_rgba(255,80,0,0.6)] animate-pulse"
      : frame === "cyber-neon"
      ? "p-[3px] bg-gradient-to-tr from-cyan-400 via-fuchsia-500 to-emerald-400 shadow-[0_0_12px_rgba(0,240,255,0.6)]"
      : frame === "sakura"
      ? "p-[3px] bg-gradient-to-tr from-pink-400 via-rose-300 to-white shadow-[0_0_12px_rgba(255,102,170,0.5)]"
      : frame === "golden-aura"
      ? "p-[3px] bg-gradient-to-tr from-yellow-300 via-amber-400 to-yellow-600 shadow-[0_0_12px_rgba(255,215,0,0.7)]"
      : frame === "abyssal-vortex"
      ? "p-[3px] bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 shadow-[0_0_12px_rgba(138,43,226,0.6)]"
      : "";

  return (
    <span className={cn("relative inline-grid place-items-center rounded-full shrink-0", frameClass)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="rounded-full object-cover shrink-0 ring-1 ring-line/40"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-bold text-white shadow-sm"
          style={{ width: size, height: size, fontSize: size * 0.42 }}
          aria-hidden
        >
          {(name || "U").slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export async function signOut() {
  const db = getSupabaseBrowser();
  if (!db) return;
  const { error } = await db.auth.signOut();
  if (error) toast.error("Error al cerrar sesión", { description: error.message });
  else toast("Sesión cerrada");
}

export function UserMenu() {
  const { status, profile, user } = useAuth();
  const [guestProfile] = useGuestProfile();
  const router = useRouter();

  if (status === "loading") return <span className="k-skeleton size-8 !rounded-full" aria-hidden />;

  if (status !== "signed-in") {
    const guestName = guestProfile.display_name || "Invitado";
    return (
      <div className="flex items-center gap-2">
        <DM.Root modal={false}>
          <DM.Trigger asChild>
            <button
              type="button"
              className="rounded-full ring-1 ring-line/60 transition-transform hover:scale-105 active:scale-95"
              aria-label={`Menú de ${guestName}`}
            >
              <Avatar src={guestProfile.avatar_url} name={guestName} size={32} frame={guestProfile.avatar_frame} />
            </button>
          </DM.Trigger>
          <DM.Portal>
            <DM.Content align="end" sideOffset={10} className="k-panel z-[90] min-w-60 !bg-surface p-1.5 shadow-xl">
              <div className="px-3 pb-2 pt-2">
                <p className="truncate text-sm font-semibold">{guestName}</p>
                <p className="truncate text-xs text-muted">Perfil en este dispositivo</p>
              </div>
              <DM.Separator className="my-1 h-px bg-line" />
              <DM.Item asChild className={item}>
                <Link href="/profile" prefetch={true} className="flex w-full items-center gap-2.5">
                  <UserRound className="size-4 text-primary" /> Tu universo (Perfil)
                </Link>
              </DM.Item>
              <DM.Item asChild className={item}>
                <Link href="/settings/profile" prefetch={true} className="flex w-full items-center gap-2.5">
                  <Paintbrush className="size-4 text-accent" /> Personalizar perfil
                </Link>
              </DM.Item>
              <DM.Item asChild className={item}>
                <Link href="/settings" prefetch={true} className="flex w-full items-center gap-2.5">
                  <Settings className="size-4" /> Configuración
                </Link>
              </DM.Item>
              <DM.Separator className="my-1 h-px bg-line" />
              <DM.Item asChild className={item}>
                <Link href="/login" prefetch={true} className="flex w-full items-center gap-2.5">
                  <LogIn className="size-4" /> Iniciar sesión
                </Link>
              </DM.Item>
            </DM.Content>
          </DM.Portal>
        </DM.Root>
        <Link href="/login" className="k-btn k-btn-primary k-btn-sm" aria-label="Iniciar sesión">
          <LogIn className="size-4" aria-hidden /> <span className="max-sm:hidden">Iniciar sesión</span>
        </Link>
      </div>
    );
  }

  const name = profile?.display_name || profile?.username || user?.email || "Usuario";
  const username = profile?.username || "user";

  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>
        <button
          type="button"
          className="rounded-full ring-1 ring-line/60 transition-transform hover:scale-105 active:scale-95"
          aria-label={`Menú de cuenta de ${name}`}
        >
          <Avatar src={profile?.avatar_url} name={name} size={32} frame={profile?.avatar_frame} />
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={10} className="k-panel z-[90] min-w-60 !bg-surface p-1.5 shadow-xl">
          <div className="px-3 pb-2 pt-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">@{username}</p>
          </div>
          <DM.Separator className="my-1 h-px bg-line" />
          <DM.Item asChild className={item}>
            <Link href={`/profile/${encodeURIComponent(username)}`} prefetch={true} className="flex w-full items-center gap-2.5">
              <UserRound className="size-4 text-primary" /> Tu universo (Perfil)
            </Link>
          </DM.Item>
          <DM.Item asChild className={item}>
            <Link href="/settings/profile" prefetch={true} className="flex w-full items-center gap-2.5">
              <Paintbrush className="size-4 text-accent" /> Personalizar perfil
            </Link>
          </DM.Item>
          <DM.Item asChild className={item}>
            <Link href="/settings" prefetch={true} className="flex w-full items-center gap-2.5">
              <Settings className="size-4" /> Configuración
            </Link>
          </DM.Item>
          <DM.Item asChild className={item}>
            <Link href="/settings/integrations" prefetch={true} className="flex w-full items-center gap-2.5">
              <Link2 className="size-4" /> Cuentas conectadas
            </Link>
          </DM.Item>
          <DM.Separator className="my-1 h-px bg-line" />
          <DM.Item className={item} onSelect={() => signOut().then(() => router.refresh())}>
            <LogOut className="size-4" /> Cerrar sesión
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
