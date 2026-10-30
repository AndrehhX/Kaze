"use client";

import { motion } from "motion/react";
import Image, { type ImageProps } from "next/image";
import { useState, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";

/** Staggered in-view reveal container. Children should be <RevealItem>. */
export function Reveal({ children, className, as = "div", once = true }: { children: ReactNode; className?: string; as?: "div" | "ul" | "section"; once?: boolean }) {
  const { stagger } = useKazeMotion();
  const Comp = motion[as];
  return (
    <Comp className={className} variants={stagger} initial="hidden" whileInView="show" viewport={{ once, margin: "0px 0px -8% 0px" }}>
      {children}
    </Comp>
  );
}

export function RevealItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
  const { reveal } = useKazeMotion();
  const Comp = motion[as];
  return (
    <Comp className={className} variants={reveal}>
      {children}
    </Comp>
  );
}

/** AniList covers, character and staff portraits are already sized for cards. */
export function isPreSized(src: ImageProps["src"]) {
  return typeof src === "string" && /\/media\/anime\/cover\/|\/media\/character\/|\/media\/staff\/|\/user\/avatar\/|i\.ytimg\.com/.test(src);
}

/** next/image with a graceful broken-image fallback and a fade-in on load. */
export function SafeImage({ className, alt, fallbackLabel, tint, ...props }: ImageProps & { fallbackLabel?: string; tint?: string | null }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  if (!props.src || state === "error") {
    return (
      <div
        className={cn("absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-muted", className)}
        style={{ background: tint ? `linear-gradient(160deg, ${tint}55, var(--k-elevated))` : "var(--k-elevated)" }}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="size-5 opacity-60" aria-hidden />
        {fallbackLabel && <span className="clamp-3 text-xs font-medium">{fallbackLabel}</span>}
      </div>
    );
  }
  return (
    <Image
      unoptimized={isPreSized(props.src)}
      {...props}
      alt={alt}
      className={cn("transition-[opacity,scale] duration-700", state === "loading" ? "scale-[1.02] opacity-0" : "scale-100 opacity-100", className)}
      onLoad={() => setState("ok")}
      onError={() => setState("error")}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("k-skeleton", className)} aria-hidden />;
}

export function SectionHeader({
  title,
  jp,
  kicker,
  action,
  id,
  className,
}: {
  title: string;
  jp?: string;
  kicker?: string;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {kicker && <p className="k-label mb-2 text-primary-ink">{kicker}</p>}
        <h2 id={id} className="font-display text-section flex items-baseline gap-3">
          <span className="truncate">{title}</span>
          {jp && (
            <span className="k-jp hidden text-sm font-normal tracking-normal normal-case text-muted sm:inline" lang="ja">
              {jp}
            </span>
          )}
        </h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  jp,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  jp?: string;
}) {
  const { reduced } = useKazeMotion();
  return (
    <div className={cn("k-card relative flex flex-col items-center overflow-hidden px-6 py-12 text-center", className)}>
      {jp && (
        <span aria-hidden className="k-jp pointer-events-none absolute -right-3 -top-6 select-none text-[7rem] leading-none text-fg opacity-[0.04]" lang="ja">
          {jp}
        </span>
      )}
      {icon && (
        <motion.div
          className="mb-4 grid size-14 place-items-center rounded-full bg-[var(--k-btn-ghost)] text-primary-ink"
          animate={reduced ? undefined : { y: [0, -5, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          {icon}
        </motion.div>
      )}
      <h3 className="font-display text-lg">{title}</h3>
      {body && <div className="mt-2 max-w-md text-sm text-muted">{body}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorPanel({ title = "Something went wrong", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="k-card flex flex-col items-start gap-3 p-6">
      <p className="k-label text-danger">Error</p>
      <h3 className="font-display text-lg">{title}</h3>
      {message && <p className="text-sm text-muted">{message}</p>}
      {onRetry && (
        <button className="k-btn k-btn-outline k-btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span className={cn("k-chip !min-h-6 border-accent/60 !bg-transparent text-[0.6875rem] font-semibold uppercase tracking-wider", className)} title="Open-licensed demo media, not licensed anime">
      Demo media
    </span>
  );
}
