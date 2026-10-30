"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Horizontal, scroll-snapping content rail with keyboard-accessible paging buttons. */
export function Rail({ children, label, className, itemClassName }: { children: ReactNode[]; label: string; className?: string; itemClassName?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children.length]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className={cn("group/rail relative", className)}>
      <ul
        ref={ref}
        onScroll={update}
        aria-label={label}
        className="scrollbar-none -mx-[var(--k-gutter)] flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-[var(--k-gutter)] px-[var(--k-gutter)] pb-4 pt-1 sm:gap-4"
      >
        {children.map((child, i) => (
          <li key={i} className={cn("shrink-0 snap-start", itemClassName ?? "w-[38vw] xs:w-[30vw] sm:w-[22vw] md:w-[17vw] lg:w-[13.5vw] xl:w-[11.5vw] 3xl:w-[180px]")}>
            {child}
          </li>
        ))}
      </ul>
      <button
        type="button"
        aria-label={`Scroll ${label} backward`}
        onClick={() => page(-1)}
        disabled={edges.start}
        className="k-btn k-btn-icon k-panel absolute -left-3 top-[38%] z-10 hidden -translate-y-1/2 opacity-0 transition-opacity focus-visible:opacity-100 disabled:!opacity-0 group-hover/rail:opacity-100 md:inline-flex"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label={`Scroll ${label} forward`}
        onClick={() => page(1)}
        disabled={edges.end}
        className="k-btn k-btn-icon k-panel absolute -right-3 top-[38%] z-10 hidden -translate-y-1/2 opacity-0 transition-opacity focus-visible:opacity-100 disabled:!opacity-0 group-hover/rail:opacity-100 md:inline-flex"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
