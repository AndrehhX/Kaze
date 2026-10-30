"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Link2, LogIn, LogOut, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const item = "flex min-h-10 items-center gap-2.5 rounded-[min(var(--k-radius-btn),10px)] px-3 text-sm outline-none data-[highlighted]:bg-[var(--k-btn-ghost)]";

export function Avatar({ src, name, size = 32 }: { src: string | null | undefined; name: string; size?: number }) {
  return src ? (
    <Image src={src} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export async function signOut() {
  const db = getSupabaseBrowser();
  if (!db) return;
  const { error } = await db.auth.signOut();
  if (error) toast.error("Sign-out failed", { description: error.message });
  else toast("Signed out");
}

export function UserMenu() {
  const { status, profile, user } = useAuth();
  const router = useRouter();

  if (status === "loading") return <span className="k-skeleton size-8 !rounded-full" aria-hidden />;
  if (status !== "signed-in") {
    return (
      <Link href="/login" className="k-btn k-btn-primary k-btn-sm" aria-label="Sign in">
        <LogIn className="size-4" aria-hidden /> <span className="max-sm:hidden">Sign in</span>
      </Link>
    );
  }
  const name = profile?.display_name || profile?.username || user?.email || "You";
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button type="button" className="rounded-full" aria-label={`Account menu for ${name}`}>
          <Avatar src={profile?.avatar_url} name={name} />
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={10} className="k-panel z-[90] min-w-60 !bg-surface p-1.5">
          <div className="px-3 pb-2 pt-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            {profile && <p className="truncate text-xs text-muted">@{profile.username}</p>}
          </div>
          <DM.Separator className="my-1 h-px bg-line" />
          {profile && (
            <DM.Item className={item} onSelect={() => router.push(`/profile/${profile.username}`)}>
              <UserRound className="size-4" /> Your universe
            </DM.Item>
          )}
          <DM.Item className={item} onSelect={() => router.push("/settings")}>
            <Settings className="size-4" /> Settings
          </DM.Item>
          <DM.Item className={item} onSelect={() => router.push("/settings/integrations")}>
            <Link2 className="size-4" /> Connected accounts
          </DM.Item>
          <DM.Separator className="my-1 h-px bg-line" />
          <DM.Item className={item} onSelect={() => signOut().then(() => router.refresh())}>
            <LogOut className="size-4" /> Sign out
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
