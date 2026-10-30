"use client";

import { Eye, ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Spoiler shield: content is blurred and inert until the reader explicitly reveals it. */
export function Spoiler({ active, children, className }: { active: boolean; children: ReactNode; className?: string }) {
  const [shown, setShown] = useState(false);
  if (!active || shown) return <div className={className}>{children}</div>;
  return (
    <div className={cn("relative", className)}>
      <div className="k-spoiler pointer-events-none max-h-24 overflow-hidden" aria-hidden inert>
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <button className="k-btn k-btn-outline k-btn-sm bg-surface" onClick={() => setShown(true)}>
          <ShieldAlert className="size-4 text-danger" aria-hidden /> Contains spoilers — <Eye className="size-4" aria-hidden /> Reveal
        </button>
      </div>
    </div>
  );
}
