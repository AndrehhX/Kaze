"use client";

import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useKazeMotion } from "@/lib/motion";

/** Accessible modal (focus trap, Esc, focus restore via Radix) with theme-aware motion. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  hideTitle,
  side = "center",
  trigger,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
  side?: "center" | "bottom" | "right";
  trigger?: ReactNode;
}) {
  const { reduced, m } = useKazeMotion();

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.pointerEvents = "";
        document.body.removeAttribute("data-scroll-locked");
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
    };
  }, []);
  const panelMotion =
    side === "bottom"
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
      : side === "right"
        ? { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } }
        : { initial: { opacity: 0, scale: 0.96, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.97, y: 8 } };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                {...(reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : panelMotion)}
                transition={reduced ? { duration: 0.1 } : side === "center" ? m.spring : { type: "spring", stiffness: 380, damping: 38 }}
                className={cn(
                  "k-panel fixed z-[81] flex max-h-[min(88dvh,900px)] flex-col overflow-hidden !bg-surface outline-none",
                  side === "center" && "left-1/2 top-1/2 w-[min(94vw,640px)] -translate-x-1/2 -translate-y-1/2",
                  side === "bottom" && "inset-x-0 bottom-0 max-h-[90dvh] w-full !rounded-b-none pb-safe",
                  side === "right" && "inset-y-0 right-0 h-dvh max-h-dvh w-[min(92vw,440px)] !rounded-r-none",
                  className,
                )}
              >
                <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", hideTitle && "sr-only")}>
                  <div>
                    <D.Title className="font-display text-xl">{title}</D.Title>
                    {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
                  </div>
                </div>
                <D.Close className="k-btn k-btn-ghost k-btn-icon k-btn-sm absolute right-3 top-3 z-10" aria-label="Close">
                  <X className="size-4" />
                </D.Close>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} className="w-[min(94vw,460px)]">
      <div className="px-5 pb-5 pt-2 text-sm text-muted">{body}</div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => onOpenChange(false)}>
          Cancel
        </button>
        <button
          className={cn("k-btn k-btn-sm", destructive ? "bg-danger text-white" : "k-btn-primary")}
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
