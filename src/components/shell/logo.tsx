import Link from "next/link";
import { cn } from "@/lib/utils";

export function KazeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="kz-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--k-primary)" />
          <stop offset="1" stopColor="var(--k-accent)" />
        </linearGradient>
      </defs>
      <path d="M7 30 L18 10 M15 32 L29 7 M24 31 L34 14" stroke="url(#kz-g)" strokeWidth="3.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2 rounded-md", className)}>
      <KazeMark className="transition-transform duration-500 group-hover:-rotate-6" />
      <span className="font-display text-xl leading-none tracking-[0.06em] !normal-case">KAZE</span>
      <span className="sr-only">home</span>
      <span className="k-jp -ml-0.5 text-sm text-primary-ink" lang="ja" aria-hidden>
        風
      </span>
    </Link>
  );
}
