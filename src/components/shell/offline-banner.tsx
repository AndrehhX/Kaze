"use client";

import { AnimatePresence, motion } from "motion/react";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/hooks";

export function OfflineBanner() {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed left-1/2 top-3 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          <WifiOff className="size-4" aria-hidden /> You&apos;re offline — library changes are saved on this device.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
