"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useLibrary } from "@/stores/library";
import { useSettings } from "@/stores/settings";
import { useKazeMotion } from "@/lib/motion";

/** "Watch Completion Celebration": a brief, dismissible moment when a series is completed. */
export function CompletionCelebration() {
  const signal = useLibrary((s) => s.lastCompleted);
  const entry = useLibrary((s) => (s.lastCompleted ? s.entries[s.lastCompleted.mediaId] : undefined));
  const clear = useLibrary((s) => s.clearCompletedSignal);
  const enabled = useSettings((s) => s.gamification);
  const completedCount = useLibrary((s) => Object.values(s.entries).filter((e) => e.status === "COMPLETED").length);
  const { reduced } = useKazeMotion();

  const show = Boolean(signal && entry && enabled);

  useEffect(() => {
    if (!signal) return;
    if (!show) {
      clear();
      return;
    }
    const t = setTimeout(clear, 4200);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && clear();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [signal, show, clear]);

  return (
    <AnimatePresence>
      {show && entry && (
        <motion.div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-24 z-[110] mx-auto flex w-[min(92vw,460px)] items-center gap-4 overflow-hidden p-4 k-panel lg:bottom-8"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          onClick={clear}
        >
          {!reduced &&
            Array.from({ length: 14 }).map((_, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute left-12 top-1/2 h-px w-10 origin-left bg-gradient-to-r from-primary to-transparent"
                style={{ rotate: `${(i / 14) * 360}deg` }}
                initial={{ scaleX: 0, opacity: 1 }}
                animate={{ scaleX: [0, 1.6, 2.4], opacity: [1, 0.8, 0] }}
                transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
              />
            ))}
          <div className="k-poster relative h-24 w-16 shrink-0">
            {entry.media.cover && <Image src={entry.media.cover} alt="" fill sizes="64px" className="object-cover" unoptimized />}
          </div>
          <div className="min-w-0">
            <p className="k-label text-primary-ink">
              <span className="k-jp mr-1.5 text-base" lang="ja">
                完
              </span>
              Series completed
            </p>
            <p className="font-display mt-1 truncate text-lg leading-tight">{entry.media.title}</p>
            <p className="mt-1 text-xs text-muted">
              That&apos;s {completedCount} completed in your library.{" "}
              <Link href={`/community/reviews?write=${entry.mediaId}`} className="font-semibold text-primary-ink underline-offset-2 hover:underline">
                Write a review
              </Link>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
